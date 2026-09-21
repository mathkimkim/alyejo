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
  return new Date(Date.UTC(y,m-1,d) + delta*86400000).toISOString().slice(0,10);
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

export async function flightPartnerLink({dep,arr,departureDate,returnDate}) {
  dep=cleanAirport(dep);
  arr=cleanAirport(arr);
  departureDate=validateDate(departureDate);
  returnDate=validateDate(returnDate);
  if(returnDate<departureDate) throw new Error('귀국일은 출발일 이후여야 합니다.');

  const cacheKey=['partner-flight-link-v1',dep,arr,departureDate,returnDate].join(':');
  const cached=await cacheStore.get(cacheKey,{type:'json'});
  if(cached?.mylink) return {url:cached.mylink,partner:true,cached:true,mylinkId:cached.mylinkId||null,landingUrl:cached.landingUrl||''};

  const landingResponse=await post('/v1/products/flight/fare-query-landing-url',{
    depAirportCd:dep,
    arrAirportCd:arr,
    tripTypeCd:'RT',
    depDate:departureDate,
    arrDate:returnDate,
    adult:1,
    cabinClass:'ECONOMY'
  });

  const landingUrl=typeof landingResponse?.data==='string'
    ? landingResponse.data
    : (landingResponse?.data?.url||landingResponse?.data?.landingUrl||'');
  if(!landingUrl || !/^https:\/\/([a-z0-9-]+\.)*myrealtrip\.com\//i.test(landingUrl)){
    throw new Error('항공 운임 조회 랜딩 URL을 생성하지 못했습니다.');
  }

  const mylinkResponse=await post('/v1/mylink',{targetUrl:landingUrl});
  const mylink=mylinkResponse?.data?.mylink||'';
  if(!mylink) throw new Error('마이링크를 생성하지 못했습니다.');

  await cacheStore.setJSON(cacheKey,{
    at:new Date().toISOString(),
    mylink,
    mylinkId:mylinkResponse?.data?.mylinkId||null,
    landingUrl
  });

  return {url:mylink,partner:true,cached:false,mylinkId:mylinkResponse?.data?.mylinkId||null,landingUrl};
}

export async function searchMrt({ dep, arr, start, end, period, forceFresh=false }) {
  dep=cleanAirport(dep); arr=cleanAirport(arr); start=validateDate(start); end=validateDate(end); period=validatePeriod(period);
  const cacheKey=['route',dep,arr,start,end,period].join(':');
  const cached=await cacheStore.get(cacheKey,{type:'json'});
  if(!forceFresh && cached?.at && Array.isArray(cached?.rows) && Date.now()-new Date(cached.at).getTime()<CACHE_MS) return {rows:cached.rows,cached:true,cachedAt:cached.at};

  const j=await post('/v1/products/flight/calendar',{depCityCd:dep,arrCityCd:arr,period,startDate:start,endDate:end});
  const rows=(Array.isArray(j?.data)?j.data:[]).map(x=>({
    key:[x.departureDate,x.returnDate,x.airline||''].join('|'),
    fromCity:x.fromCity,toCity:x.toCity,period:x.period,
    departureDate:x.departureDate,returnDate:x.returnDate,
    totalPrice:Number(x.totalPrice||0),airline:x.airline||'',transfer:x.transfer??null
  })).sort((a,b)=>a.departureDate.localeCompare(b.departureDate)||a.totalPrice-b.totalPrice);

  await cacheStore.setJSON(cacheKey,{at:new Date().toISOString(),rows});
  return {rows,cached:false,cachedAt:null};
}

async function airportIndex() {
  const cacheKey='airport-index-v3';
  const cached=await cacheStore.get(cacheKey,{type:'json'});
  if(cached?.at && cached?.byAirport && cached?.byCity && Date.now()-new Date(cached.at).getTime()<24*60*60*1000) return cached;

  const j=await post('/v1/products/flight/airports',{sort:'airportCode',order:'asc',size:10000,page:0});
  const byAirport={},byCity={};

  for(const x of (j?.data?.airports||[])){
    const airportCode=x?.airport?.code;
    const cityCode=x?.city?.code;
    if(!airportCode) continue;

    const meta={
      airportCode,
      airportName:x?.airport?.koName||x?.airport?.enName||airportCode,
      cityCode:cityCode||'',
      cityName:x?.city?.koName||x?.city?.enName||'',
      countryCode:x?.isoCode||x?.country?.code||'',
      countryName:x?.country?.koName||x?.country?.enName||''
    };

    byAirport[airportCode]=meta;
    if(cityCode){
      if(!byCity[cityCode]) byCity[cityCode]=[];
      byCity[cityCode].push(meta);
    }
  }

  const value={at:new Date().toISOString(),byAirport,byCity};
  await cacheStore.setJSON(cacheKey,value);
  return value;
}

const SEA=['TH','VN','PH','MY','SG','ID','KH','LA','MM','BN','TL'];
const EAST_ASIA=['JP','CN','HK','MO','TW','MN'];
const SOUTH_ASIA=['IN','PK','BD','LK','NP','BT','MV','AF'];
const CENTRAL_ASIA=['KZ','KG','TJ','TM','UZ'];
const MIDDLE_EAST=['AE','SA','QA','BH','KW','OM','YE','IL','JO','LB','IQ','IR','TR'];

const WESTERN_EUROPE=['FR','DE','BE','NL','LU','CH','AT','IE','GB'];
const SOUTHERN_EUROPE=['IT','ES','PT','GR','HR','SI','MT','CY','MC','SM','VA','AL','ME','MK','BA'];
const NORTHERN_EUROPE=['DK','NO','SE','FI','IS','EE','LV','LT'];
const EASTERN_EUROPE=['PL','CZ','SK','HU','RO','BG','RS','MD','UA','BY'];
const EUROPE=[...new Set([...WESTERN_EUROPE,...SOUTHERN_EUROPE,...NORTHERN_EUROPE,...EASTERN_EUROPE])];

const NORTH_AMERICA=['US','CA','MX','GL','BM','BZ','CR','SV','GT','HN','NI','PA','BS','BB','CU','DO','HT','JM','TT','AG','DM','GD','KN','LC','VC','PR','VI','KY','AW','CW','SX','TC','VG'];
const SOUTH_AMERICA=['AR','BO','BR','CL','CO','EC','FK','GF','GY','PY','PE','SR','UY','VE'];
const AUSTRALIA=['AU'];
const NEW_ZEALAND=['NZ'];
const SOUTH_PACIFIC=['FJ','PG','NC','PF','WS','TO','VU','SB','GU','MP','FM','PW','MH','KI','NR','TV'];
const OCEANIA=[...AUSTRALIA,...NEW_ZEALAND,...SOUTH_PACIFIC];

const GULF=['AE','SA','QA','BH','KW','OM'];
const LEVANT_TURKEY=['IL','JO','LB','TR'];
const OTHER_MIDDLE_EAST=['YE','IQ','IR'];

const NORTH_AFRICA=['EG','MA','TN','DZ','LY','SD'];
const EAST_AFRICA=['ET','KE','TZ','UG','RW','DJ','ER','SO','SC','MU','MG','KM'];
const SOUTHERN_AFRICA=['ZA','NA','BW','ZM','ZW','MZ','MW','LS','SZ','AO'];
const WEST_CENTRAL_AFRICA=['NG','GH','SN','CI','CM','GA','CG','CD','BJ','TG','GM','GN','GW','LR','SL','ML','NE','BF','CF','TD','GQ','ST','CV','BI'];
const AFRICA=[...new Set([...NORTH_AFRICA,...EAST_AFRICA,...SOUTHERN_AFRICA,...WEST_CENTRAL_AFRICA])];

function continentKey(cc){
  if(MIDDLE_EAST.includes(cc)) return 'middleeast';
  if(EUROPE.includes(cc) || ['RU'].includes(cc)) return 'europe';
  if(NORTH_AMERICA.includes(cc)) return 'northamerica';
  if(SOUTH_AMERICA.includes(cc)) return 'southamerica';
  if(AFRICA.includes(cc)) return 'africa';
  if(OCEANIA.includes(cc)) return 'oceania';
  if([...EAST_ASIA,...SEA,...SOUTH_ASIA,...CENTRAL_ASIA,'KR'].includes(cc)) return 'asia';
  return 'other';
}

export async function airportCatalog(){
  const index=await airportIndex();
  const airports=Object.values(index.byAirport).map(x=>({
    airportCode:x.airportCode,
    airportName:x.airportName,
    cityCode:x.cityCode,
    cityName:x.cityName,
    countryCode:x.countryCode,
    countryName:x.countryName,
    continent:continentKey(x.countryCode)
  })).sort((a,b)=>(a.countryName+a.cityName+a.airportCode).localeCompare(b.countryName+b.cityName+b.airportCode,'ko'));
  return airports;
}

function normalizeCodes(v){
  if(Array.isArray(v)) return [...new Set(v.map(x=>String(x||'').trim().toUpperCase()).filter(Boolean))];
  return [...new Set(String(v||'').split(',').map(x=>x.trim().toUpperCase()).filter(Boolean))];
}

function selectedAirportMetas(index,countries,airports){
  const countrySet=new Set(normalizeCodes(countries));
  const airportSet=new Set(normalizeCodes(airports));
  const out=[];
  for(const meta of Object.values(index.byAirport)){
    if(airportSet.has(meta.airportCode) || countrySet.has(meta.countryCode)) out.push(meta);
  }
  const map=new Map(out.map(x=>[x.airportCode,x]));
  return [...map.values()];
}

function matchesToken(cc, token){
  if(token==='all') return true;
  if(token==='asia') return [...EAST_ASIA,...SEA,...SOUTH_ASIA,...CENTRAL_ASIA,...MIDDLE_EAST].includes(cc);
  if(token==='japan') return cc==='JP';
  if(token==='seasia') return SEA.includes(cc);
  if(token==='greater_china') return ['CN','HK','MO','TW'].includes(cc);
  if(token==='other_asia') return [...SOUTH_ASIA,...CENTRAL_ASIA,'MN'].includes(cc);
  if(token==='europe') return EUROPE.includes(cc);
  if(token==='western_europe') return WESTERN_EUROPE.includes(cc);
  if(token==='southern_europe') return SOUTHERN_EUROPE.includes(cc);
  if(token==='northern_europe') return NORTHERN_EUROPE.includes(cc);
  if(token==='eastern_europe') return EASTERN_EUROPE.includes(cc);
  if(token==='northamerica') return NORTH_AMERICA.includes(cc);
  if(token==='southamerica') return SOUTH_AMERICA.includes(cc);
  if(token==='usa') return cc==='US';
  if(token==='canada') return cc==='CA';
  if(token==='mexico') return cc==='MX';
  if(token==='oceania') return OCEANIA.includes(cc);
  if(token==='australia') return AUSTRALIA.includes(cc);
  if(token==='newzealand') return NEW_ZEALAND.includes(cc);
  if(token==='south_pacific') return SOUTH_PACIFIC.includes(cc);
  if(token==='middleeast') return MIDDLE_EAST.includes(cc);
  if(token==='gulf') return GULF.includes(cc);
  if(token==='uae') return cc==='AE';
  if(token==='levant_turkey') return LEVANT_TURKEY.includes(cc);
  if(token==='other_middleeast') return OTHER_MIDDLE_EAST.includes(cc);
  if(token==='africa') return AFRICA.includes(cc);
  if(token==='north_africa') return NORTH_AFRICA.includes(cc);
  if(token==='east_africa') return EAST_AFRICA.includes(cc);
  if(token==='southern_africa') return SOUTHERN_AFRICA.includes(cc);
  if(token==='west_central_africa') return WEST_CENTRAL_AFRICA.includes(cc);
  return false;
}

function inRegions(meta, regionExpr){
  const tokens=String(regionExpr||'all').split(',').map(x=>x.trim()).filter(Boolean);
  if(!tokens.length||tokens.includes('all')) return true;
  const cc=meta?.countryCode||'';
  return tokens.some(t=>matchesToken(cc,t));
}

async function bulkLowest(dep, period) {
  const cacheKey=['discover-bulk',dep,period].join(':');
  const cached=await cacheStore.get(cacheKey,{type:'json'});
  if(cached?.at && Array.isArray(cached?.rows) && Date.now()-new Date(cached.at).getTime()<CACHE_MS) return {rows:cached.rows,cached:true};

  const j=await post('/v1/products/flight/calendar/bulk-lowest',{depCityCd:dep,period});
  const rows=(Array.isArray(j?.data)?j.data:[]).map(x=>({
    fromCity:x.fromCity,toCity:x.toCity,period:x.period,
    departureDate:x.departureDate,returnDate:x.returnDate,
    totalPrice:Number(x.totalPrice||0),averagePrice:Number(x.averagePrice||0)
  }));

  await cacheStore.setJSON(cacheKey,{at:new Date().toISOString(),rows});
  return {rows,cached:false};
}

function resolveBulkDestinations(rows,index,region,targetPrice){
  const resolved=[];
  let unresolvedCount=0;

  for(const x of rows){
    if(!(x.totalPrice>0 && x.totalPrice<=targetPrice)) continue;

    const direct=index.byAirport[x.toCity];
    const airports=direct?[direct]:(index.byCity[x.toCity]||[]);

    if(!airports.length){
      unresolvedCount++;
      continue;
    }

    for(const meta of airports){
      if(!inRegions(meta,region)) continue;
      resolved.push({
        ...x,
        ...meta,
        toCity:meta.airportCode,
        sourceDestinationCode:x.toCity,
        referenceLowest:x.totalPrice
      });
    }
  }

  const dedup=new Map();
  for(const x of resolved){
    const prev=dedup.get(x.airportCode);
    if(!prev || x.referenceLowest<prev.referenceLowest) dedup.set(x.airportCode,x);
  }

  return {resolved:[...dedup.values()],unresolvedCount};
}

export async function discoverMrt({dep,period,region='all',targetPrice=99999999,departureDate,countries=[],airports=[]}) {
  dep=cleanAirport(dep); period=validatePeriod(period); departureDate=validateDate(departureDate);
  targetPrice=Math.max(1,Number(targetPrice||0));

  const windowStart=shiftDate(departureDate,-2);
  const windowEnd=shiftDate(departureDate,2);

  const index=await airportIndex();
  const explicit=normalizeCodes(countries).length>0 || normalizeCodes(airports).length>0;
  let candidates=[],cached=false,bulkCount=0,unresolvedCount=0;

  if(explicit){
    candidates=selectedAirportMetas(index,countries,airports).map(x=>({...x,referenceLowest:0,sourceDestinationCode:x.airportCode}));
  }else{
    const bulk=await bulkLowest(dep,period);
    cached=bulk.cached;
    bulkCount=bulk.rows.length;
    const expanded=resolveBulkDestinations(bulk.rows,index,region,targetPrice);
    candidates=expanded.resolved;
    unresolvedCount=expanded.unresolvedCount;
  }

  const checked=await Promise.allSettled(candidates.map(async c=>{
    const exact=await searchMrt({dep,arr:c.airportCode,start:windowStart,end:windowEnd,period});
    return exact.rows
      .filter(x=>x.totalPrice>0 && x.totalPrice<=targetPrice)
      .map(x=>({
        ...x,
        toCity:c.airportCode,
        airportName:c.airportName,
        cityName:c.cityName,
        countryCode:c.countryCode,
        countryName:c.countryName,
        sourceDestinationCode:c.sourceDestinationCode,
        referenceLowest:c.referenceLowest
      }));
  }));

  const successCount=checked.filter(x=>x.status==='fulfilled').length;
  const failedCount=checked.length-successCount;
  const rows=checked.filter(x=>x.status==='fulfilled').flatMap(x=>x.value||[])
    .sort((a,b)=>a.departureDate.localeCompare(b.departureDate)||a.totalPrice-b.totalPrice);

  return {rows,cached,departureDate,windowStart,windowEnd,bulkCount,resolvedAirportCount:candidates.length,
    unresolvedCount,successCount,failedCount};
}

export async function trackMrt({dep,period,region='all',departureDate,limit=50,countries=[],airports=[]}) {
  dep=cleanAirport(dep); period=validatePeriod(period); departureDate=validateDate(departureDate);
  const windowStart=shiftDate(departureDate,-2);
  const windowEnd=shiftDate(departureDate,2);
  const index=await airportIndex();
  const explicit=normalizeCodes(countries).length>0 || normalizeCodes(airports).length>0;
  let candidates;
  if(explicit){
    candidates=selectedAirportMetas(index,countries,airports).map(x=>({...x,referenceLowest:0,sourceDestinationCode:x.airportCode}));
  }else{
    const bulk=await bulkLowest(dep,period);
    const expanded=resolveBulkDestinations(bulk.rows,index,region,Number.MAX_SAFE_INTEGER);
    candidates=expanded.resolved.sort((a,b)=>a.referenceLowest-b.referenceLowest)
      .slice(0,Math.max(1,Math.min(50,Number(limit)||50)));
  }

  const checked=await Promise.allSettled(candidates.map(async c=>{
    const exact=await searchMrt({dep,arr:c.airportCode,start:windowStart,end:windowEnd,period});
    return exact.rows
      .filter(x=>x.totalPrice>0)
      .map(x=>({
        ...x,
        toCity:c.airportCode,
        airportName:c.airportName,
        cityName:c.cityName,
        countryCode:c.countryCode,
        countryName:c.countryName,
        sourceDestinationCode:c.sourceDestinationCode,
        referenceLowest:c.referenceLowest
      }));
  }));

  const rows=checked
    .filter(x=>x.status==='fulfilled')
    .flatMap(x=>x.value||[])
    .sort((a,b)=>a.departureDate.localeCompare(b.departureDate)||a.totalPrice-b.totalPrice);

  return {
    rows,
    windowStart,
    windowEnd,
    trackedAirportCount:candidates.length,
    successCount:checked.filter(x=>x.status==='fulfilled').length,
    failedCount:checked.filter(x=>x.status==='rejected').length
  };
}

export async function trackableAirportCatalog({dep='ICN',period=5}={}) {
  dep=cleanAirport(dep);
  period=validatePeriod(period);
  const [bulk,index]=await Promise.all([bulkLowest(dep,period),airportIndex()]);
  const expanded=resolveBulkDestinations(bulk.rows,index,'all',Number.MAX_SAFE_INTEGER);
  const airports=expanded.resolved.map(x=>({
    airportCode:x.airportCode,
    airportName:x.airportName,
    cityCode:x.cityCode,
    cityName:x.cityName,
    countryCode:x.countryCode,
    countryName:x.countryName,
    continent:continentKey(x.countryCode),
    referenceLowest:x.referenceLowest
  })).sort((a,b)=>(a.countryName+a.cityName+a.airportCode).localeCompare(b.countryName+b.cityName+b.airportCode,'ko'));

  return {
    airports,
    count:airports.length,
    dep,
    period,
    cached:bulk.cached,
    unresolvedCount:expanded.unresolvedCount
  };
}
