import { flightPartnerLink } from './_intl-flight-lib.mjs';

export default async(req)=>{
  if(req.method!=='GET') return new Response('Method Not Allowed',{status:405});
  try{
    const result=await flightPartnerLink({
      dep:'ICN',
      arr:'FUK',
      departureDate:'2026-09-25',
      returnDate:'2026-09-28'
    });
    return Response.json({
      ok:true,
      test:'ICN → FUK / 2026-09-25 → 2026-09-28',
      partnerLink:result.url,
      mylinkId:result.mylinkId||null,
      partner:true,
      cached:result.cached,
      landingUrl:result.landingUrl||''
    });
  }catch(e){
    return Response.json({ok:false,error:String(e?.message||e)},{status:502});
  }
};

export const config={path:'/api/mylink-check'};
