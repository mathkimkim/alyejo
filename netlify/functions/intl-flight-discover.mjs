import { discoverMrt } from './_intl-flight-lib.mjs';

export default async (req)=>{
  try{
    const u=new URL(req.url);
    const dep=u.searchParams.get('dep')||'ICN';
    const period=Number(u.searchParams.get('period')||5);
    const region=u.searchParams.get('region')||'all';
    const targetPrice=Number(u.searchParams.get('targetPrice')||300000);
    const departureDate=u.searchParams.get('departureDate');

    const result=await discoverMrt({dep,period,region,targetPrice,departureDate});

    return Response.json({
      dep,period,region,targetPrice,departureDate,
      windowStart:result.windowStart,
      windowEnd:result.windowEnd,
      bulkCount:result.bulkCount,
      resolvedAirportCount:result.resolvedAirportCount,
      unresolvedCount:result.unresolvedCount,
      successCount:result.successCount,
      failedCount:result.failedCount,
      count:result.rows.length,
      cached:result.cached,
      destinations:result.rows
    });
  }catch(e){
    return Response.json({error:String(e?.message||e)},{status:400});
  }
};

export const config={path:'/api/intl-flight-discover'};
