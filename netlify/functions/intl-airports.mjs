import { airportCatalog } from './_intl-flight-lib.mjs';

export default async(req)=>{
  try{
    if(req.method!=='GET') return new Response('Method Not Allowed',{status:405});
    const airports=await airportCatalog();
    return Response.json({airports,count:airports.length});
  }catch(e){
    return Response.json({error:String(e?.message||e)},{status:500});
  }
};

export const config={path:'/api/intl-airports'};
