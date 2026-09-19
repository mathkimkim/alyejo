export function dateRange(start, end, maxDays = 5) {
  const parse = value => {
    const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) throw new Error('날짜 범위를 확인하세요.');
    const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
    const ts = Date.UTC(y, mo - 1, d);
    const check = new Date(ts);
    if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) {
      throw new Error('날짜 범위를 확인하세요.');
    }
    return ts;
  };

  const a = parse(start);
  const b = parse(end);
  if (b < a) throw new Error('날짜 범위를 확인하세요.');

  const dayMs = 86400000;
  const count = Math.floor((b - a) / dayMs) + 1;
  if (count > maxDays) throw new Error('MVP에서는 최대 5일까지 감시할 수 있습니다.');

  return Array.from({ length: count }, (_, i) =>
    new Date(a + i * dayMs).toISOString().slice(0, 10)
  );
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
