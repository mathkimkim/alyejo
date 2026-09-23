async function call(url,token){
  const r=await fetch(url,{headers:{Authorization:'Bearer '+token}});
  const j=await r.json().catch(()=>({}));
  return {
    ok:r.ok,status:r.status,
    error:j?.error?{message:j.error.message||'',type:j.error.type||'',code:j.error.code||null,subcode:j.error.error_subcode||null,trace:j.error.fbtrace_id||''}:null,
    data:Array.isArray(j?.data)?j.data.slice(0,10).map(x=>({
      id:x.id||'',username:x.username||'',text:String(x.text||'').slice(0,500),
      permalink:x.permalink||'',timestamp:x.timestamp||'',media_type:x.media_type||''
    })):j?.id?{id:j.id,username:j.username||''}:null
  };
}
export default async(req)=>{
  try{
    const token=Netlify.env.get('THREADS_ACCESS_TOKEN')||'';
    if(!token)return Response.json({ok:false,error:'THREADS_ACCESS_TOKEN 없음'},{status:500});
    const u=new URL(req.url);
    const q=(u.searchParams.get('q')||'후쿠오카').slice(0,80);
    const me=await call('https://graph.threads.net/v1.0/me?fields=id,username',token);
    const variants=[
      ['minimal','https://graph.threads.net/v1.0/keyword_search?'+new URLSearchParams({q,search_type:'TOP'})],
      ['fields','https://graph.threads.net/v1.0/keyword_search?'+new URLSearchParams({q,search_type:'TOP',fields:'id,media_type,permalink,username,text,timestamp'})],
      ['default_keyword','https://graph.threads.net/v1.0/keyword_search?'+new URLSearchParams({q,search_type:'TOP',search_mode:'KEYWORD',limit:'10',fields:'id,media_type,permalink,username,text,timestamp'})]
    ];
    const tests=[];
    for(const [name,url] of variants)tests.push({name,...await call(url,token)});
    const good=tests.find(x=>x.ok);
    return Response.json({ok:!!good,q,tokenCheck:me,workingVariant:good?.name||null,tests});
  }catch(e){
    return Response.json({ok:false,error:String(e?.message||e)},{status:500});
  }
};
export const config={path:'/api/threads-keyword-test'};
