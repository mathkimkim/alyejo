export function dateRange(start, end, maxDays = 5) {
  const a = new Date(start + 'T00:00:00+09:00');
  const b = new Date(end + 'T00:00:00+09:00');
  if (!Number.isFinite(a.getTime()) || !Number.isFinite(b.getTime()) || b < a) throw new Error('날짜 범위를 확인하세요.');
  const out = [];
  for (let d = new Date(a); d <= b && out.length < maxDays; d.setDate(d.getDate()+1)) out.push(d.toISOString().slice(0,10));
  if (new Date(a.getTime() + (maxDays-1)*86400000) < b) throw new Error('MVP에서는 최대 5일까지 감시할 수 있습니다.');
  return out;
}

export async function searchSerp(date, adults = 1) {
  const key = Netlify.env.get('SERPAPI_KEY');
  if (!key) throw new Error('SERPAPI_KEY 환경변수가 없습니다.');
  const q = new URLSearchParams({
    engine:'google_flights', departure_id:'CJU', arrival_id:'GMP',
    outbound_date:date, type:'2', adults:String(adults), currency:'KRW',
    hl:'ko', api_key:key
  });
  const r = await fetch('https://serpapi.com/search.json?' + q.toString());
  const j = await r.json();
  if (!r.ok || j?.error) throw new Error(j?.error || ('SerpApi HTTP ' + r.status));
  const groups = [...(j.best_flights||[]), ...(j.other_flights||[])];
  const rows = [];
  for (const g of groups) {
    const legs = Array.isArray(g.flights) ? g.flights : [];
    if (!legs.length) continue;
    const first = legs[0], last = legs[legs.length-1];
    if (first?.departure_airport?.id !== 'CJU' || last?.arrival_airport?.id !== 'GMP') continue;
    if (legs.length !== 1) continue;
    const flightNo = first.flight_number || '';
    const dep = first?.departure_airport?.time || '';
    const arr = first?.arrival_airport?.time || '';
    const airline = first.airline || '';
    const price = Number(g.price || 0);
    const keyId = [date, flightNo, dep].join('|');
    rows.push({ key:keyId, date, airline, flightNumber:flightNo, departure:dep, arrival:arr, price, duration:first.duration||null });
  }
  const map = new Map();
  for (const x of rows) if (!map.has(x.key) || (x.price && x.price < map.get(x.key).price)) map.set(x.key,x);
  return [...map.values()].sort((a,b)=>(a.date+a.departure).localeCompare(b.date+b.departure));
}

export async function searchRange(start,end,adults=1){
  const dates=dateRange(start,end,5);
  const parts=await Promise.all(dates.map(d=>searchSerp(d,adults)));
  return parts.flat();
}
