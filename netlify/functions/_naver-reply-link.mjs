import { filterTravelBlogs } from './_naver-blog-filter.mjs';

function clean(s=''){
  return String(s).replace(/<[^>]*>/g,'').replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim();
}
function safeBlogUrl(raw){
  try{
    const u=new URL(String(raw||'').trim());
    if(!['blog.naver.com','m.blog.naver.com'].includes(u.hostname))return '';
    const parts=u.pathname.split('/').filter(Boolean);
    if(parts.length<2 || !/^\d+$/.test(parts[1]))return '';
    return 'https://blog.naver.com/'+parts[0]+'/'+parts[1];
  }catch{return ''}
}
function blogId(url){
  try{return new URL(url).pathname.split('/').filter(Boolean)[0]?.toLowerCase()||'';}
  catch{return ''}
}

export async function selectReplyBlog(stage,other){
  const id=Netlify.env.get('NAVER_CLIENT_ID');
  const secret=Netlify.env.get('NAVER_CLIENT_SECRET');
  if(!id||!secret)throw Error('NAVER API 환경변수 없음');
  const query=Number(stage)===1?'후쿠오카 숙소 교통 여행 후기':'후쿠오카 일정 맛집 관광 여행 후기';
  const params=new URLSearchParams({query,display:'30',start:'1',sort:'date'});
  const response=await fetch('https://naverapihub.apigw.ntruss.com/search/v1/blog?'+params,{
    headers:{'X-NCP-APIGW-API-KEY-ID':id,'X-NCP-APIGW-API-KEY':secret}
  });
  if(!response.ok)throw Error('NAVER 블로그 검색 HTTP '+response.status);
  const data=await response.json();
  const rows=(data.items||[]).map(x=>({
    title:clean(x.title),description:clean(x.description),
    bloggerName:clean(x.bloggername),link:safeBlogUrl(x.link),postDate:x.postdate||''
  }));
  const {kept}=filterTravelBlogs(rows);
  const excludedUrl=other?.url||'';
  const excludedId=blogId(excludedUrl);
  const category=Number(stage)===1?/(숙소|호텔|교통|공항|하카타|텐진)/:/(일정|맛집|관광|다자이후|유후인|라멘|오호리)/;
  const sales=/(예약|특가|할인|패키지|투어|판매|쿠폰|구매)/;
  const choice=kept.find(x=>x.link&&x.link!==excludedUrl&&blogId(x.link)!==excludedId&&
    category.test(x.title+' '+x.description)&&!sales.test(x.title));
  return choice?{url:choice.link,title:choice.title,bloggerName:choice.bloggerName,postDate:choice.postDate,description:choice.description,query}:null;
}
