export default async(req)=>{
  try{
    const token=Netlify.env.get('THREADS_ACCESS_TOKEN')||'';
    if(!token) return Response.json({ok:false,error:'THREADS_ACCESS_TOKEN 없음'},{status:500});
    const u=new URL(req.url);
    const q=(u.searchParams.get('q')||'후쿠오카').slice(0,80);
    const params=new URLSearchParams({
      q,
      search_type:'TOP',
      search_mode:'KEYWORD',
      limit:'10',
      fields:'id,media_type,permalink,username,text,timestamp,is_quote_post'
    });
    const r=await fetch('https://graph.threads.net/keyword_search?'+params,{
      headers:{Authorization:'Bearer '+token}
    });
    const j=await r.json().catch(()=>({}));
    if(!r.ok){
      return Response.json({
        ok:false,status:r.status,
        error:j?.error?.message||'Threads keyword search 실패',
        code:j?.error?.code||null,
        type:j?.error?.type||null
      },{status:r.status});
    }
    const rows=(j.data||[]).map(x=>({
      id:x.id,username:x.username||'',text:String(x.text||'').slice(0,500),
      permalink:x.permalink||'',timestamp:x.timestamp||'',media_type:x.media_type||''
    }));
    return Response.json({ok:true,q,searchType:'TOP',count:rows.length,results:rows});
  }catch(e){
    return Response.json({ok:false,error:String(e?.message||e)},{status:500});
  }
};
export const config={path:'/api/threads-keyword-test'};
