const SAMPLE = {
  city:'후쿠오카', origin:'인천', departureDate:'2026-10-15',
  returnDate:'2026-10-18', price:189000
};

function dateOK(s){ return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s+'T00:00:00Z').getTime()); }
function won(n){ return Number(n).toLocaleString('ko-KR')+'원'; }
function clean(s){ return String(s||'').replace(/<[^>]*>/g,'').replace(/&(?:quot|#34);/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim(); }

export function buildPreview(data){
  const city='후쿠오카';
  const first = [
    '✈️ '+city+' 항공권 확인 메모',
    '',
    data.origin+' → '+city+' 왕복 '+won(data.price),
    data.departureDate+' ~ '+data.returnDate,
    '',
    '💰 가격: 표시된 금액이 결제 단계에서도 같은지 확인하세요.',
    '🏨 숙소: 공항·기차 이동이 중요하면 하카타, 쇼핑과 저녁 일정 중심이면 텐진을 비교해보세요.',
    '🚇 이동: 공항에서 시내까지의 교통편과 숙소까지의 마지막 구간을 함께 확인하세요.',
    '✅ 예약 전: 수하물, 출도착 시각, 변경·취소 조건을 확인하세요.'
  ].join('\n');
  const second = [
    '🇯🇵 '+city+' 여행 일정 아이디어',
    '',
    '🗓️ 일정: 하카타·텐진을 묶고, 하루는 오호리공원·모모치 해변 쪽으로 잡아보세요.',
    '🍜 먹거리: 하카타 라멘, 모츠나베, 멘타이코를 취향에 맞춰 골라보세요.',
    '📍 관광: 캐널시티·오호리공원·모모치 해변의 이동 동선을 비교해보세요.',
    '🚃 근교: 여유가 있다면 다자이후를 넣고, 유후인은 왕복 이동시간과 좌석 예약을 먼저 확인하세요.'
  ].join('\n');
  return {first,second};
}

async function blogCandidates(){
  const id=Netlify.env.get('NAVER_CLIENT_ID');
  const secret=Netlify.env.get('NAVER_CLIENT_SECRET');
  if(!id||!secret) return {ok:false,error:'NAVER API 설정 없음',items:[]};
  const query=new URLSearchParams({query:'후쿠오카 여행',display:'10',start:'1',sort:'date'});
  const r=await fetch('https://naverapihub.apigw.ntruss.com/search/v1/blog?'+query,{
    headers:{'X-NCP-APIGW-API-KEY-ID':id,'X-NCP-APIGW-API-KEY':secret}
  });
  if(!r.ok) return {ok:false,status:r.status,items:[]};
  const j=await r.json();
  return {ok:true,total:j.total||0,items:(j.items||[]).slice(0,5).map(x=>({
    title:clean(x.title),date:x.postdate||'',link:x.link||''
  }))};
}

export default async function(req){
  if(req.method!=='GET') return Response.json({error:'Method Not Allowed'},{status:405});
  const p=new URL(req.url).searchParams;
  const sample=!['price','departureDate','returnDate'].some(k=>p.has(k));
  const data={
    city:'후쿠오카',
    origin:clean(p.get('origin')||SAMPLE.origin).slice(0,20),
    departureDate:p.get('departureDate')||SAMPLE.departureDate,
    returnDate:p.get('returnDate')||SAMPLE.returnDate,
    price:Number(p.get('price')||SAMPLE.price)
  };
  if(!dateOK(data.departureDate)||!dateOK(data.returnDate)||
     data.returnDate<data.departureDate||!Number.isInteger(data.price)||
     data.price<1||data.price>100000000){
    return Response.json({error:'날짜 또는 가격 형식이 올바르지 않습니다.'},{status:400});
  }
  const replies=buildPreview(data);
  let sources;
  try{ sources=await blogCandidates(); }
  catch(e){ sources={ok:false,error:String(e?.message||e),items:[]}; }
  return Response.json({
    ok:true,mode:'preview',published:false,sample,
    note:sample?'예시 항공권 데이터입니다. 실제 가격이 아닙니다.':'입력한 항공권 데이터로 만든 미리보기입니다.',
    flight:data,replies,blogSearch:sources
  });
}
export const config={path:'/api/threads-reply-preview'};
