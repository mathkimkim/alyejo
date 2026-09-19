import { searchRange } from './_flight-lib.mjs';

export default async (req) => {
  try {
    const u=new URL(req.url);
    const start=u.searchParams.get('start'), end=u.searchParams.get('end')||start;
    const adults=Math.max(1,Math.min(9,Number(u.searchParams.get('adults')||1)));
    if(!start) return Response.json({error:'start 날짜가 필요합니다.'},{status:400});
    const flights=await searchRange(start,end,adults);
    return Response.json({route:'CJU-GMP',start,end,adults,count:flights.length,flights});
  } catch(e) {
    return Response.json({error:String(e?.message||e)},{status:400});
  }
};
export const config={path:'/api/flight-search'};
