import { getStore } from '@netlify/blobs';

function hash(s){
  let h=0;
  for(const ch of String(s||'')) h=((h<<5)-h+ch.charCodeAt(0))|0;
  return Math.abs(h);
}

const CITY_TIPS={
  FUK:{
    flag:'🇯🇵',
    food:'하카타 라멘 · 모츠나베 · 멘타이코',
    spots:'텐진 · 캐널시티 · 모모치 해변',
    nearby:'다자이후나 유후인을 하루 근교 일정으로 붙이기 좋아요.'
  },
  NRT:{flag:'🇯🇵',food:'스시 · 라멘 · 돈카츠',spots:'시부야 · 신주쿠 · 아사쿠사',nearby:'하루 여유가 있으면 요코하마나 가마쿠라를 붙여도 좋아요.'},
  HND:{flag:'🇯🇵',food:'스시 · 라멘 · 돈카츠',spots:'시부야 · 신주쿠 · 아사쿠사',nearby:'하루 여유가 있으면 요코하마나 가마쿠라를 붙여도 좋아요.'},
  KIX:{flag:'🇯🇵',food:'타코야키 · 오코노미야키 · 쿠시카츠',spots:'도톤보리 · 우메다 · 오사카성',nearby:'교토나 고베를 하루 일정으로 함께 보기 좋아요.'},
  CTS:{flag:'🇯🇵',food:'미소라멘 · 징기스칸 · 해산물',spots:'오도리공원 · 스스키노 · 삿포로 맥주박물관',nearby:'오타루를 반나절~하루 일정으로 붙이기 좋아요.'},
  OKA:{flag:'🇯🇵',food:'오키나와 소바 · 타코라이스 · 아구돼지',spots:'국제거리 · 슈리성 일대 · 아메리칸빌리지',nearby:'렌터카가 있으면 중북부 해안 쪽까지 동선이 넓어져요.'},
  TPE:{flag:'🇹🇼',food:'우육면 · 샤오롱바오 · 야시장 먹거리',spots:'시먼딩 · 중정기념당 · 타이베이101',nearby:'지우펀이나 스펀을 하루 근교 일정으로 많이 묶어요.'},
  HKG:{flag:'🇭🇰',food:'딤섬 · 완탕면 · 에그타르트',spots:'침사추이 · 센트럴 · 빅토리아피크',nearby:'짧은 일정이면 홍콩섬과 구룡을 나눠 보는 동선이 편해요.'},
  BKK:{flag:'🇹🇭',food:'팟타이 · 똠얌꿍 · 망고찰밥',spots:'왕궁 · 왓아룬 · 아이콘시암',nearby:'아유타야를 하루 근교 일정으로 붙일 수 있어요.'},
  DAD:{flag:'🇻🇳',food:'미꽝 · 반미 · 해산물',spots:'미케비치 · 한시장 · 용다리',nearby:'호이안을 저녁 일정이나 하루 코스로 함께 보기 좋아요.'},
  SGN:{flag:'🇻🇳',food:'쌀국수 · 반미 · 분짜',spots:'벤탄시장 · 중앙우체국 · 응우옌후에',nearby:'메콩델타나 꾸찌터널을 근교 일정으로 많이 선택해요.'},
  HAN:{flag:'🇻🇳',food:'쌀국수 · 분짜 · 에그커피',spots:'호안끼엠 · 올드쿼터 · 서호',nearby:'닌빈이나 하롱베이를 하루 이상 일정으로 붙이기 좋아요.'},
  SIN:{flag:'🇸🇬',food:'칠리크랩 · 카야토스트 · 호커센터',spots:'마리나베이 · 가든스바이더베이 · 차이나타운',nearby:'도시가 compact해서 짧은 일정에도 주요 명소를 묶기 편해요.'},
  GUM:{flag:'🇬🇺',food:'차모로 바비큐 · 해산물',spots:'투몬비치 · 사랑의절벽 · 쇼핑몰',nearby:'렌터카가 있으면 남부 드라이브 코스를 함께 보기 좋아요.'},
  SYD:{flag:'🇦🇺',food:'브런치 · 피시앤칩스 · 스테이크',spots:'오페라하우스 · 하버브리지 · 본다이비치',nearby:'블루마운틴을 하루 근교 일정으로 붙이기 좋아요.'},
  LAX:{flag:'🇺🇸',food:'타코 · 버거 · 브런치',spots:'산타모니카 · 그리피스천문대 · 할리우드',nearby:'도시가 넓어서 렌터카와 이동시간을 넉넉하게 잡는 편이 좋아요.'},
  CDG:{flag:'🇫🇷',food:'크루아상 · 스테이크프리트 · 디저트',spots:'에펠탑 · 루브르 · 몽마르트르',nearby:'베르사유를 반나절~하루 일정으로 붙이기 좋아요.'},
  LHR:{flag:'🇬🇧',food:'피시앤칩스 · 애프터눈티 · 펍 음식',spots:'웨스트민스터 · 타워브리지 · 코벤트가든',nearby:'도보와 지하철을 섞으면 중심 관광지 이동이 편해요.'}
};

const COUNTRY_FALLBACK={
  '일본':{flag:'🇯🇵',food:'라멘 · 스시 · 지역별 현지 음식',spots:'도심 상권 · 전통거리 · 전망 명소',nearby:'철도 이동이 편해서 근교 도시를 하루 일정으로 붙이기 좋아요.'},
  '태국':{flag:'🇹🇭',food:'팟타이 · 똠얌 · 야시장 먹거리',spots:'사원 · 야시장 · 쇼핑몰',nearby:'마사지와 야시장 일정을 저녁에 넣기 좋아요.'},
  '베트남':{flag:'🇻🇳',food:'쌀국수 · 반미 · 지역 음식',spots:'구시가지 · 시장 · 카페거리',nearby:'도시별 근교 투어를 하루 일정으로 붙이기 좋아요.'},
  '대만':{flag:'🇹🇼',food:'우육면 · 샤오롱바오 · 야시장 먹거리',spots:'야시장 · 도심 명소 · 전망대',nearby:'철도로 근교를 하루 일정으로 다녀오기 편해요.'}
};

function replyText(item){
  const city=item.cityName||item.toCity;
  const tip=CITY_TIPS[item.toCity]||COUNTRY_FALLBACK[item.countryName]||{
    flag:'🌏',
    food:'현지 대표 음식과 로컬 마켓',
    spots:'도심 대표 명소와 현지 거리',
    nearby:'여행기간이 길다면 근교 도시를 하루 일정으로 붙여보세요.'
  };
  const variants=[
    `${tip.flag} ${city} 간다면 이것도 참고 👀\n\n🍜 ${tip.food}\n📍 ${tip.spots}\n🚃 ${tip.nearby}\n\n항공권 가격은 위 글에서 실시간으로 확인하세요 👆`,
    `${tip.flag} ${city} 여행 메모해두세요.\n\n먹거리 👉 ${tip.food}\n가볼 곳 👉 ${tip.spots}\n근교 팁 👉 ${tip.nearby}\n\n항공권은 위 게시물에서 확인 👆`,
    `✈️ ${city} 가게 된다면?\n\n🍽️ ${tip.food}\n📸 ${tip.spots}\n🧳 ${tip.nearby}\n\n특가 항공권은 위 글 링크에서 확인할 수 있어요 👆`
  ];
  return variants[hash(item.rootPostId)%variants.length];
}

async function postReply(rootPostId,text,accessToken){
  const params=new URLSearchParams({
    media_type:'TEXT',
    text,
    reply_to_id:rootPostId,
    auto_publish_text:'true'
  });
  const response=await fetch('https://graph.threads.net/v1.0/me/threads',{
    method:'POST',
    headers:{
      Authorization:'Bearer '+accessToken,
      'Content-Type':'application/x-www-form-urlencoded'
    },
    body:params
  });
  const result=await response.json().catch(()=>({}));
  if(!response.ok){
    const error=new Error(result?.error?.message||'Threads 답글 게시 실패');
    error.code=result?.error?.code||response.status;
    throw error;
  }
  return result;
}

export default async()=>{
  const accessToken=Netlify.env.get('THREADS_ACCESS_TOKEN')||'';
  if(!accessToken) return;

  const store=getStore({name:'intl-flight-alert',consistency:'strong'});
  let queue=await store.get('threads-reply-queue',{type:'json'});
  queue=Array.isArray(queue)?queue:[];

  const now=Date.now();
  const due=queue.filter(x=>x.status==='pending' && new Date(x.dueAt).getTime()<=now).slice(0,10);

  for(const item of due){
    try{
      const result=await postReply(item.rootPostId,replyText(item),accessToken);
      item.status='posted';
      item.replyPostId=result?.id||null;
      item.postedAt=new Date().toISOString();
      item.attempts=Number(item.attempts||0)+1;
      item.lastError=null;
    }catch(e){
      item.attempts=Number(item.attempts||0)+1;
      item.lastError=String(e?.message||e);
      item.lastTriedAt=new Date().toISOString();
      if(item.attempts>=3) item.status='failed';
    }
  }

  const cutoff=Date.now()-7*24*60*60*1000;
  queue=queue.filter(x=>x.status==='pending'||new Date(x.postedAt||x.queuedAt||0).getTime()>=cutoff).slice(-300);
  await store.setJSON('threads-reply-queue',queue);
};

export const config={schedule:'*/5 * * * *'};
