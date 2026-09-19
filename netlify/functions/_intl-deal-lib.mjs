import { getStore } from '@netlify/blobs';

const cacheStore = getStore({ name: 'myrealtrip-intl-cache', consistency: 'strong' });
const CACHE_MS = 30 * 60 * 1000;

function validateAirport(code) {
  const v = String(code || '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(v)) throw new Error('공항코드는 IATA 3자리로 입력하세요. 예: ICN, NRT');
  return v;
}
function validateDate(v) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v||''))) throw new Error('날짜 형식을 확인하세요.');
  return v;
}
function validateRange(startDate,endDate){
  validateDate(startDate); validateDate(endDate);
  const a=Date.parse(startDate+'T00:00:00Z'), b=Date.parse(endDate+'T00:00:00Z');
  if(!Number.isFinite(a)||!Number.isFinite(b)||b<a) throw new Error('조회 기간을 확인하세요.');
  const days=Math.floor((b-a)/86400000)+1;
  if(days>31) throw new Error('조회 기간은 최대 31일까지 가능합니다.');
}

export async function searchIntl({depCityCd,arrCityCd,period,startDate,endDate,force=false}) {
  const dep=validateAirport(depCityCd), arr=validateAirport(arrCityCd);
  const p=Number(period);
  if(!Number.isInteger(p)||p<3||p>7) throw new Error('여행기간은 3~7일만 가능합니다.');
  validateRange(startDate,endDate);

  const cacheKey = [dep,arr,p,startDate,endDate].join(':');
  if(!force){
    const cached=await cacheStore.get(cacheKey,{type:'json'});
    if(cached?.at && Array.isArray(cached?.data) && Date.now()-new Date(cached.at).getTime()<CACHE_MS) {
      return { data:cached.data, cached:true, cachedAt:cached.at };
    }
  }

  const apiKey=Netlify.env.get('MYREALTRIP_API_KEY');
  if(!apiKey) throw new Error('MYREALTRIP_API_KEY 환경변수가 없습니다.');

  const r=await fetch('https://partner-ext-api.myrealtrip.com/v1/products/flight/calendar',{
    method:'POST',
    headers:{'Authorization':'Bearer '+apiKey,'Content-Type':'application/json'},
    body:JSON.stringify({depCityCd:dep,arrCityCd:arr,period:p,startDate,endDate})
  });
  const j=await r.json().catch(()=>null);
  if(!r.ok || j?.result?.status>=400) throw new Error(j?.result?.message || ('마이리얼트립 API HTTP '+r.status));

  const data=(Array.isArray(j?.data)?j.data:[]).map(x=>({
    fromCity:x.fromCity||dep,
    toCity:x.toCity||arr,
    period:Number(x.period||p),
    departureDate:x.departureDate,
    returnDate:x.returnDate,
    totalPrice:Number(x.totalPrice||0),
    airline:x.airline||null,
    transfer:x.transfer
  })).sort((a,b)=>a.totalPrice-b.totalPrice || String(a.departureDate).localeCompare(String(b.departureDate)));

  const at=new Date().toISOString();
  await cacheStore.setJSON(cacheKey,{at,data});
  return {data,cached:false,cachedAt:at};
}
