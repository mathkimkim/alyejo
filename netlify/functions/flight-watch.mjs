import { getStore } from '@netlify/blobs';
import { searchRange, dateRange } from './_flight-lib.mjs';
const store=getStore({name:'flight-alert',consistency:'strong'});

export default async (req)=>{
  try{
    if(req.method==='GET'){
      const v=await store.get('watch',{type:'json'});
      return Response.json(v||{enabled:false});
    }
    if(req.method==='DELETE'){
      await store.delete('watch');
      return Response.json({ok:true,enabled:false});
    }
    if(req.method!=='POST') return new Response('Method Not Allowed',{status:405});
    const body=await req.json();
    const start=body.start,end=body.end||body.start,adults=Math.max(1,Math.min(9,Number(body.adults||1)));
    dateRange(start,end,5);
    if(!body.subscription?.endpoint) return Response.json({error:'푸시 구독 정보가 없습니다.'},{status:400});
    const flights=await searchRange(start,end,adults);
    const value={enabled:true,route:'CJU-GMP',start,end,adults,subscription:body.subscription,baseline:flights.map(x=>x.key),lastFlights:flights,updatedAt:new Date().toISOString()};
    await store.setJSON('watch',value);
    return Response.json({ok:true,enabled:true,count:flights.length,start,end,adults});
  }catch(e){return Response.json({error:String(e?.message||e)},{status:400})}
};
export const config={path:'/api/flight-watch'};
