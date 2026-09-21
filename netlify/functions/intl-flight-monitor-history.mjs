import { getStore } from '@netlify/blobs';

export default async(req)=>{
  if(req.method!=='GET') return new Response('Method Not Allowed',{status:405});

  const adminKey=Netlify.env.get('THREADS_TEST_KEY');
  const supplied=req.headers.get('x-admin-key')||'';
  if(!adminKey || supplied!==adminKey){
    return Response.json({error:'관리자 키가 올바르지 않습니다.'},{status:401});
  }

  const store=getStore({name:'intl-flight-alert',consistency:'strong'});
  let runs=await store.get('monitor-runs',{type:'json'});
  runs=Array.isArray(runs)?runs:[];

  const cutoff=Date.now()-24*60*60*1000;
  runs=runs.filter(x=>new Date(x.startedAt||0).getTime()>=cutoff)
    .sort((a,b)=>new Date(b.startedAt)-new Date(a.startedAt));

  return Response.json({
    latest:runs[0]||null,
    runs:runs.slice(0,24),
    schedule:'hourly'
  });
};

export const config={path:'/api/intl-flight-monitor-history'};
