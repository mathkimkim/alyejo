import { trackableAirportCatalog } from './_intl-flight-lib.mjs';

export default async(req)=>{
  try{
    if(req.method!=='GET') return new Response('Method Not Allowed',{status:405});
    const u=new URL(req.url);
    const dep=u.searchParams.get('dep')||'ICN';
    const period=Number(u.searchParams.get('period')||5);
    const result=await trackableAirportCatalog({dep,period});
    return Response.json(result);
  }catch(e){
    return Response.json({error:String(e?.message||e)},{status:500});
  }
};

export const config={path:'/api/intl-airports'};
