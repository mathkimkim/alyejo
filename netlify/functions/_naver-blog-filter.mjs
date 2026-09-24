// Search metadata is only a first pass. Exact blog IDs are confirmed exclusions
// from the Fukuoka review; provider names catch clearly branded operator blogs.
const EXCLUDED_IDS=new Set(['wpdbsrud','tripinstyle']);
const PROVIDER_NAME=/(마이리얼트립|여기어때|야놀자|트립닷컴|클룩|투어비스|하나투어|모두투어|인터파크투어|트립인스타일|myrealtrip|trip\.com|klook|yanolja)/i;

export function exclusionReason(item){
  let id='';
  try{
    const u=new URL(String(item.link||''));
    if(['blog.naver.com','m.blog.naver.com'].includes(u.hostname)){
      id=(u.pathname.split('/').filter(Boolean)[0]||'').toLowerCase();
    }
  }catch{}
  if(EXCLUDED_IDS.has(id))return '운영 블로그 제외 ID';
  if(PROVIDER_NAME.test(String(item.bloggerName||item.bloggername||'')))return '여행 예약업체 블로그명';
  return '';
}

export function filterTravelBlogs(items){
  const kept=[],excluded=[];
  for(const item of items){
    const reason=exclusionReason(item);
    if(reason)excluded.push({...item,reason});
    else kept.push(item);
  }
  return {kept,excluded};
}
