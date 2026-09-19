import { getStore } from '@netlify/blobs';

const cacheStore = getStore({ name: 'myrealtrip-flight-cache', consistency: 'strong' });
const CACHE_MS = 30 * 60 * 1000;

function apiKey() {
  const key = Netlify.env.get('MYREALTRIP_API_KEY');
  if (!key) throw new Error('MYREALTRIP_API_KEY 환경변수가 없습니다.');
  return key;
}

function cleanAirport(v) {
  const s = String(v || '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(s)) throw new Error('공항코드는 IATA 3자리로 입력하세요. 예: ICN, NRT');
  return s;
}

function validateDate(v) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v || ''))) throw new Error('날짜 형식을 확인하세요.');
  return v;
}

function validatePeriod(v) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 3 || n > 7) throw new Error('여행기간은 3~7일로 입력하세요.');
  return n;
}

function shiftDate(date, delta) {
  validateDate(date);
  const [y,m,d] = date.split('-').map(Number);
  const t = Date.UTC(y,m-1,d) + delta * 86400000;
  return new Date(t).toISOString().slice(0,10);
}

async function post(path, body) {
  const r = await fetch('https://partner-ext-api.myrealtrip.com' + path, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + apiKey(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j?.result?.status >= 400) throw new Error(j?.result?.message || j?.message || ('마이리얼트립 API HTTP ' + r.status));
  return j;
}

export async function searchMrt({ dep, arr, start, end, period }) {
  dep = cleanAirport(dep); arr = cleanAirport(arr); start = validateDate(start); end = validateDate(end); period = validatePeriod(period);
  const cacheKey = ['route',dep,arr,start,end,period].join(':');
  const cached = await cacheStore.get(cacheKey, { type: 'json' });
  if (cached?.at && Array.isArray(cached?.rows) && Date.now() - new Date(cached.at).getTime() < CACHE_MS) return { rows: cached.rows, cached: true, cachedAt: cached.at };

  const j = await post('/v1/products/flight/calendar', { depCityCd: dep, arrCityCd: arr, period, startDate: start, endDate: end });
  const rows = (Array.isArray(j?.data) ? j.data : []).map(x => ({
    key: [x.departureDate, x.returnDate, x.airline || ''].join('|'),
    fromCity: x.fromCity, toCity: x.toCity, period: x.period,
    departureDate: x.departureDate, returnDate: x.returnDate,
    totalPrice: Number(x.totalPrice || 0), airline: x.airline || '', transfer: x.transfer ?? null
  })).sort((a,b) => a.departureDate.localeCompare(b.departureDate));

  await cacheStore.setJSON(cacheKey, { at: new Date().toISOString(), rows });
  return { rows, cached: false, cachedAt: null };
}

async function airportMap() {
  const cacheKey = 'airport-map-v1';
  const cached = await cacheStore.get(cacheKey, { type:'json' });
  if (cached?.at && cached?.map && Date.now() - new Date(cached.at).getTime() < 24*60*60*1000) return cached.map;
  const j = await post('/v1/products/flight/airports', { sort:'airportCode', order:'asc', size:10000, page:0 });
  const map = {};
  for (const x of (j?.data?.airports || [])) {
    const c=x?.airport?.code;
    if(c) map[c]={airportName:x?.airport?.koName||x?.airport?.enName||c, cityName:x?.city?.koName||x?.city?.enName||'', countryCode:x?.country?.code||'', countryName:x?.country?.koName||x?.country?.enName||''};
  }
  await cacheStore.setJSON(cacheKey,{at:new Date().toISOString(),map});
  return map;
}

function inRegion(meta, region){
  if(region==='all') return true;
  const cc=meta?.countryCode||'';
  if(region==='japan') return cc==='JP';
  if(region==='seasia') return ['TH','VN','PH','MY','SG','ID','KH','LA','MM','BN','TL'].includes(cc);
  return true;
}

async function bulkLowest(dep, period) {
  const cacheKey = ['discover-bulk',dep,period].join(':');
  const cached = await cacheStore.get(cacheKey,{type:'json'});
  if(cached?.at && Array.isArray(cached?.rows) && Date.now()-new Date(cached.at).getTime()<CACHE_MS) return {rows:cached.rows,cached:true};
  const j = await post('/v1/products/flight/calendar/bulk-lowest',{depCityCd:dep,period});
  const rows=(Array.isArray(j?.data)?j.data:[]).map(x=>({
    fromCity:x.fromCity,toCity:x.toCity,period:x.period,
    departureDate:x.departureDate,returnDate:x.returnDate,
    totalPrice:Number(x.totalPrice||0),averagePrice:Number(x.averagePrice||0)
  }));
  await cacheStore.setJSON(cacheKey,{at:new Date().toISOString(),rows});
  return {rows,cached:false};
}

export async function discoverMrt({ dep, period, region='all', targetPrice=99999999, departureDate }) {
  dep = cleanAirport(dep);
  period = validatePeriod(period);
  departureDate = validateDate(departureDate);
  targetPrice = Math.max(1,Number(targetPrice||0));
  region = ['all','japan','seasia'].includes(region) ? region : 'all';

  const windowStart = shiftDate(departureDate,-2);
  const windowEnd = shiftDate(departureDate,2);

  const bulk = await bulkLowest(dep,period);
  const amap = await airportMap();

  // 전체 기간 최저가가 목표가격보다 높은 목적지는 ±2일 창에서도 목표가 이하가 될 수 없으므로 안전하게 제외합니다.
  const candidates = bulk.rows
    .map(x=>({...x,...(amap[x.toCity]||{airportName:x.toCity,cityName:'',countryCode:'',countryName:''})}))
    .filter(x=>inRegion(x,region))
    .filter(x=>x.totalPrice>0 && x.totalPrice<=targetPrice);

  const checked = await Promise.allSettled(candidates.map(async c=>{
    const exact = await searchMrt({dep,arr:c.toCity,start:windowStart,end:windowEnd,period});
    const best = exact.rows
      .filter(x=>x.totalPrice>0 && x.totalPrice<=targetPrice)
      .sort((a,b)=>a.totalPrice-b.totalPrice)[0];
    if(!best) return null;
    return {
      ...best,
      airportName:c.airportName,
      cityName:c.cityName,
      countryCode:c.countryCode,
      countryName:c.countryName,
      referenceLowest:c.totalPrice
    };
  }));

  const rows = checked
    .filter(x=>x.status==='fulfilled' && x.value)
    .map(x=>x.value)
    .sort((a,b)=>a.totalPrice-b.totalPrice);

  return {
    rows,
    cached: bulk.cached,
    departureDate,
    windowStart,
    windowEnd,
    candidateCount:candidates.length
  };
}
