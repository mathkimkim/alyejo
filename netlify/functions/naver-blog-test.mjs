import { filterTravelBlogs } from './_naver-blog-filter.mjs';
function clean(s=''){
  return String(s).replace(/<[^>]*>/g,'').replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim();
}
export default async(req)=>{
  try{
    const clientId=Netlify.env.get('NAVER_CLIENT_ID')||'';
    const clientSecret=Netlify.env.get('NAVER_CLIENT_SECRET')||'';
    if(!clientId||!clientSecret)return Response.json({ok:false,error:'NAVER API 환경변수 없음'},{status:500});
    const u=new URL(req.url);
    const q=(u.searchParams.get('q')||'후쿠오카 여행').slice(0,100);
    const sort=u.searchParams.get('sort')==='sim'?'sim':'date';
    const params=new URLSearchParams({query:q,display:'10',start:'1',sort,format:'json'});
    const r=await fetch('https://naverapihub.apigw.ntruss.com/search/v1/blog?'+params,{
      headers:{
        'X-NCP-APIGW-API-KEY-ID':clientId,
        'X-NCP-APIGW-API-KEY':clientSecret
      }
    });
    const j=await r.json().catch(()=>({}));
    if(!r.ok)return Response.json({ok:false,status:r.status,error:j},{status:r.status});
    const items=(j.items||[]).map((x,i)=>({
      rank:i+1,title:clean(x.title),description:clean(x.description),
      bloggerName:clean(x.bloggername||''),postDate:x.postdate||'',link:x.link||''
    }));
    const {kept,excluded}=filterTravelBlogs(items);
    return Response.json({ok:true,query:q,sort,total:j.total||0,rawCount:items.length,count:kept.length,items:kept,excluded});
  }catch(e){return Response.json({ok:false,error:String(e?.message||e)},{status:500})}
};
export const config={path:'/api/naver-blog-test'};
