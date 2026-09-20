import { getStore } from '@netlify/blobs';

const store=getStore({name:'flight-alert',consistency:'strong'});

export default async (req)=>{
  try{
    if(req.method!=='GET') return new Response('Method Not Allowed',{status:405});
    const history=await store.get('recent-alerts',{type:'json'});
    const alerts=Array.isArray(history)?history:[];
    return Response.json({alerts,count:alerts.length});
  }catch(e){
    return Response.json({error:String(e?.message||e)},{status:500});
  }
};

export const config={path:'/api/flight-alert-history'};
