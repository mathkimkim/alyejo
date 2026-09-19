import { getStore } from '@netlify/blobs';

const cacheStore = getStore({ name: 'myrealtrip-flight-cache', consistency: 'strong' });
const CACHE_MS = 30 * 60 * 1000;

function cleanAirport(v) {
  const s = String(v || '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(s)) throw new Error('공항코드는 IATA 3자리로 입력하세요. 예: ICN, NRT');
  return s;
}

function validateDate(v) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v || ''))) throw new Error('날짜 형식을 확인하세요.');
  return v;
}

export async function searchMrt({ dep, arr, start, end, period }) {
  dep = cleanAirport(dep);
  arr = cleanAirport(arr);
  start = validateDate(start);
  end = validateDate(end);
  period = Number(period);
  if (!Number.isInteger(period) || period < 3 || period > 7) throw new Error('여행기간은 3~7일로 입력하세요.');

  const cacheKey = [dep, arr, start, end, period].join(':');
  const cached = await cacheStore.get(cacheKey, { type: 'json' });
  if (cached?.at && Array.isArray(cached?.rows) && Date.now() - new Date(cached.at).getTime() < CACHE_MS) {
    return { rows: cached.rows, cached: true, cachedAt: cached.at };
  }

  const apiKey = Netlify.env.get('MYREALTRIP_API_KEY');
  if (!apiKey) throw new Error('MYREALTRIP_API_KEY 환경변수가 없습니다.');

  const r = await fetch('https://partner-ext-api.myrealtrip.com/v1/products/flight/calendar', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      depCityCd: dep,
      arrCityCd: arr,
      period,
      startDate: start,
      endDate: end
    })
  });

  const j = await r.json().catch(() => ({}));
  if (!r.ok || j?.result?.status >= 400) {
    throw new Error(j?.result?.message || j?.message || ('마이리얼트립 API HTTP ' + r.status));
  }

  const rows = (Array.isArray(j?.data) ? j.data : []).map(x => ({
    key: [x.departureDate, x.returnDate, x.airline || ''].join('|'),
    fromCity: x.fromCity,
    toCity: x.toCity,
    period: x.period,
    departureDate: x.departureDate,
    returnDate: x.returnDate,
    totalPrice: Number(x.totalPrice || 0),
    airline: x.airline || '',
    transfer: x.transfer ?? null
  })).sort((a,b) => a.departureDate.localeCompare(b.departureDate));

  await cacheStore.setJSON(cacheKey, { at: new Date().toISOString(), rows });
  return { rows, cached: false, cachedAt: null };
}
