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

export async function selectReplyBlog(stage,other,destination={toCity:'FUK',cityName:'후쿠오카'},excludedUrls=[]){
  const id=Netlify.env.get('NAVER_CLIENT_ID');
  const secret=Netlify.env.get('NAVER_CLIENT_SECRET');
  if(!id||!secret)throw Error('NAVER API 환경변수 없음');
  const aliases={FUK:'후쿠오카',MFM:'마카오',NRT:'도쿄',HND:'도쿄',KIX:'오사카',CTS:'삿포로',OKA:'오키나와',TPE:'타이베이',HKG:'홍콩',BKK:'방콕',DAD:'다낭',SGN:'호치민',HAN:'하노이',SIN:'싱가포르',GUM:'괌',SYD:'시드니',LAX:'로스앤젤레스',CDG:'파리',LHR:'런던'};
  const city=aliases[String(destination.toCity||'').toUpperCase()]||String(destination.cityName||'').replace(/[()]/g,'').trim();
  if(!city||city.length>30)throw Error('목적지 이름을 확인할 수 없습니다.');
  const names=[city];
  if(city==='북경')names.push('베이징');
  if(city==='베이징')names.push('북경');
  const topic=Number(stage)===1?' 숙소 교통 여행 후기':' 일정 맛집 관광 여행 후기';
  const queries=[...names.map(name=>({query:name+topic,sort:'date'})),
    ...names.map(name=>({query:name+(Number(stage)===1?' 호텔 후기':' 여행 일정 후기'),sort:'sim'}))];
  const excludedUrl=other?.url||'';
  const excludedId=blogId(excludedUrl);
  const used=new Set(excludedUrls.map(safeBlogUrl).filter(Boolean));
  const category=Number(stage)===1?/(숙소|호텔|교통|공항|하카타|텐진|지하철|이동)/:/(일정|맛집|관광|다자이후|유후인|라멘|오호리|코스|명소)/;
  const sales=/(예약|특가|할인|패키지|투어|판매|쿠폰|구매)/;
  const destinationText=s=>names.length>1?String(s).replace(/베이징덕/g,''):String(s);
  for(const {query,sort} of queries){
    const params=new URLSearchParams({query,display:'100',start:'1',sort});
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
    const choice=kept.find(x=>x.link&&x.link!==excludedUrl&&!used.has(x.link)&&blogId(x.link)!==excludedId&&
      names.some(name=>destinationText(x.title+' '+x.description).includes(name))&&category.test(x.title+' '+x.description)&&!sales.test(x.title));
    if(choice)return {url:choice.link,title:choice.title,bloggerName:choice.bloggerName,postDate:choice.postDate,description:choice.description,query};
  }
  return null;
}
