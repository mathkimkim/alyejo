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

const CITY_GUIDES={
  FUK:{
    stay:'처음이면 하카타역 주변, 쇼핑·저녁 일정이 많으면 텐진 쪽이 편해요.',
    transit:'공항에서 시내가 가까워 지하철 중심으로 움직이기 편합니다.',
    short:'하카타·텐진 → 다자이후 → 모모치·오호리공원',
    long:'하카타·텐진 → 다자이후 → 유후인 당일치기 → 모모치·오호리공원',
    extra:'유후인은 주말·성수기라면 열차나 버스 좌석을 미리 확인하는 편이 좋아요.'
  },
  NRT:{stay:'첫 여행이면 신주쿠·시부야·우에노처럼 교통이 편한 역세권이 무난해요.',transit:'JR·지하철 노선이 많아 숙소와 주요 일정의 노선을 먼저 맞추면 이동이 편해요.',short:'시부야·하라주쿠 → 아사쿠사·스카이트리 → 신주쿠',long:'시부야·하라주쿠 → 아사쿠사 → 긴자·도쿄역 → 요코하마 또는 가마쿠라',extra:'출퇴근 시간대 전철은 붐빌 수 있어 큰 짐 이동은 시간을 여유 있게 잡는 편이 좋아요.'},
  HND:{stay:'첫 여행이면 신주쿠·시부야·우에노처럼 교통이 편한 역세권이 무난해요.',transit:'JR·지하철 노선이 많아 숙소와 주요 일정의 노선을 먼저 맞추면 이동이 편해요.',short:'시부야·하라주쿠 → 아사쿠사·스카이트리 → 신주쿠',long:'시부야·하라주쿠 → 아사쿠사 → 긴자·도쿄역 → 요코하마 또는 가마쿠라',extra:'출퇴근 시간대 전철은 붐빌 수 있어 큰 짐 이동은 시간을 여유 있게 잡는 편이 좋아요.'},
  KIX:{stay:'먹거리·야간 일정 위주면 난바, 교통과 쇼핑을 함께 보면 우메다 쪽이 편해요.',transit:'오사카 시내는 전철 중심으로 이동하고 교토·고베를 붙일 때는 철도 동선을 먼저 잡는 게 좋아요.',short:'난바·도톤보리 → 우메다 → 오사카성',long:'난바·도톤보리 → 우메다 → 교토 하루 → 고베 또는 오사카 시내',extra:'USJ를 넣는 날은 다른 일정을 많이 붙이지 않는 편이 편합니다.'},
  CTS:{stay:'삿포로역은 이동, 스스키노는 식사·야간 일정에 편해요.',transit:'시내는 지하철이 편하고 오타루는 JR로 당일치기하기 좋아요.',short:'오도리·삿포로역 → 스스키노 → 오타루',long:'삿포로 시내 → 오타루 → 근교 온천 또는 비에이·후라노 계절 일정',extra:'겨울에는 눈 때문에 이동시간이 늘 수 있어 일정 사이 여유를 두는 게 좋아요.'},
  OKA:{stay:'차 없이 시내 위주면 나하, 바다·리조트 중심이면 중북부 숙소가 편해요.',transit:'나하 시내는 모노레일, 중북부까지 넓게 볼 계획이면 렌터카가 편한 편이에요.',short:'국제거리·슈리 → 아메리칸빌리지 → 해변',long:'나하 → 중부 해안 → 북부 드라이브 → 국제거리',extra:'렌터카 이용 시 주차 가능 여부와 반납 시간을 숙소·항공편에 맞춰 확인하세요.'},
  TPE:{stay:'첫 여행이면 타이베이역·시먼딩 주변이 이동하기 편해요.',transit:'MRT가 잘 되어 있어 시내 이동이 쉽고 지우펀·스펀은 버스·철도 동선을 따로 잡는 게 좋아요.',short:'시먼딩 → 중정기념당·융캉제 → 타이베이101',long:'타이베이 시내 → 지우펀·스펀 하루 → 야시장·카페 일정',extra:'야시장은 저녁에 넣고 낮에는 도심 명소를 묶으면 동선이 깔끔해요.'},
  BKK:{stay:'첫 여행이면 BTS·MRT 역 가까운 숙소가 이동하기 편해요.',transit:'BTS·MRT와 택시를 섞되 출퇴근 시간 도로 정체를 고려하는 게 좋아요.',short:'왕궁·왓아룬 → 시암·쇼핑 → 야시장',long:'왕궁·왓아룬 → 시암 → 아유타야 하루 → 야시장·마사지',extra:'사원 방문일에는 어깨·무릎을 가릴 수 있는 복장을 준비하는 편이 좋아요.'},
  DAD:{stay:'해변 휴양이면 미케비치, 시내 접근성을 보면 한강 주변이 편해요.',transit:'다낭 시내와 호이안을 함께 볼 때는 차량 이동 시간을 감안해 일정을 묶는 게 좋아요.',short:'미케비치 → 한시장·한강 → 호이안 저녁',long:'다낭 시내 → 호이안 → 바나힐 또는 휴양일 → 미케비치',extra:'호이안은 늦은 오후부터 저녁까지 잡으면 낮과 야경을 함께 보기 좋아요.'},
  SIN:{stay:'MRT역 가까운 숙소를 잡으면 주요 관광지 이동이 편해요.',transit:'MRT 중심으로 대부분 이동 가능하고 더운 시간에는 실내 일정을 섞는 게 좋아요.',short:'마리나베이 → 가든스바이더베이 → 차이나타운',long:'마리나베이 → 센토사 → 차이나타운·리틀인디아 → 호커센터',extra:'실내 냉방이 강한 곳이 많아 얇은 겉옷 하나가 유용해요.'},
  HKG:{stay:'침사추이는 관광·야경, 센트럴은 홍콩섬 일정에 편해요.',transit:'MTR과 페리를 함께 쓰면 구룡과 홍콩섬 이동이 편합니다.',short:'침사추이 → 센트럴 → 빅토리아피크',long:'침사추이 → 센트럴 → 피크 → 란타우 또는 테마파크 일정',extra:'옥토퍼스 카드 같은 교통 결제수단을 준비하면 대중교통 이용이 편해요.'}
};

function tripDays(item){
  const s=new Date(item.departureDate+'T00:00:00Z');
  const e=new Date(item.returnDate+'T00:00:00Z');
  return Math.max(1,Math.round((e-s)/86400000)+1);
}

const COUNTRY_FALLBACK={
  '일본':{flag:'🇯🇵',food:'라멘 · 스시 · 지역별 현지 음식',spots:'도심 상권 · 전통거리 · 전망 명소',nearby:'철도 이동이 편해서 근교 도시를 하루 일정으로 붙이기 좋아요.'},
  '태국':{flag:'🇹🇭',food:'팟타이 · 똠얌 · 야시장 먹거리',spots:'사원 · 야시장 · 쇼핑몰',nearby:'마사지와 야시장 일정을 저녁에 넣기 좋아요.'},
  '베트남':{flag:'🇻🇳',food:'쌀국수 · 반미 · 지역 음식',spots:'구시가지 · 시장 · 카페거리',nearby:'도시별 근교 투어를 하루 일정으로 붙이기 좋아요.'},
  '대만':{flag:'🇹🇼',food:'우육면 · 샤오롱바오 · 야시장 먹거리',spots:'야시장 · 도심 명소 · 전망대',nearby:'철도로 근교를 하루 일정으로 다녀오기 편해요.'}
};

function weekdayCount(item){
  const s=new Date(item.departureDate+'T00:00:00Z');
  const e=new Date(item.returnDate+'T00:00:00Z');
  let n=0;
  for(let d=new Date(s);d<=e;d.setUTCDate(d.getUTCDate()+1)){
    const day=d.getUTCDay();
    if(day>=1&&day<=5)n++;
  }
  return n;
}

function guideFor(item){
  const tip=CITY_TIPS[item.toCity]||COUNTRY_FALLBACK[item.countryName]||{
    flag:'🌏',
    food:'현지 대표 음식과 로컬 마켓',
    spots:'도심 대표 명소와 현지 거리',
    nearby:'여행기간이 길다면 근교 도시를 하루 일정으로 붙여보세요.'
  };
  const guide=CITY_GUIDES[item.toCity]||{
    stay:'숙소는 주요 역이나 대중교통 접근성이 좋은 지역부터 비교해보세요.',
    transit:'공항↔도심 이동과 주요 관광지 사이 이동시간을 먼저 확인하면 일정 짜기가 쉬워요.',
    short:tip.spots,
    long:tip.spots+' → '+tip.nearby.replace(/\.$/,''),
    extra:'인기 명소·교통편은 출발 전에 운영시간과 예약 필요 여부를 한 번 확인하세요.'
  };
  return {tip,guide};
}

const LIVE_META={
  FUK:{lat:33.5902,lon:130.4017,currency:'JPY',countryCode:'JP',unit:100},
  NRT:{lat:35.6762,lon:139.6503,currency:'JPY',countryCode:'JP',unit:100},
  HND:{lat:35.6762,lon:139.6503,currency:'JPY',countryCode:'JP',unit:100},
  KIX:{lat:34.6937,lon:135.5023,currency:'JPY',countryCode:'JP',unit:100},
  CTS:{lat:43.0618,lon:141.3545,currency:'JPY',countryCode:'JP',unit:100},
  OKA:{lat:26.2124,lon:127.6809,currency:'JPY',countryCode:'JP',unit:100},
  TPE:{lat:25.0330,lon:121.5654,currency:'TWD',countryCode:'TW',unit:100},
  HKG:{lat:22.3193,lon:114.1694,currency:'HKD',countryCode:'HK',unit:100},
  BKK:{lat:13.7563,lon:100.5018,currency:'THB',countryCode:'TH',unit:100},
  DAD:{lat:16.0544,lon:108.2022,currency:'VND',countryCode:'VN',unit:1000},
  SGN:{lat:10.8231,lon:106.6297,currency:'VND',countryCode:'VN',unit:1000},
  HAN:{lat:21.0278,lon:105.8342,currency:'VND',countryCode:'VN',unit:1000},
  SIN:{lat:1.3521,lon:103.8198,currency:'SGD',countryCode:'SG',unit:1},
  GUM:{lat:13.4443,lon:144.7937,currency:'USD',countryCode:'US',unit:1},
  SYD:{lat:-33.8688,lon:151.2093,currency:'AUD',countryCode:'AU',unit:1},
  LAX:{lat:34.0522,lon:-118.2437,currency:'USD',countryCode:'US',unit:1},
  CDG:{lat:48.8566,lon:2.3522,currency:'EUR',countryCode:'FR',unit:1},
  LHR:{lat:51.5074,lon:-0.1278,currency:'GBP',countryCode:'GB',unit:1}
};

async function fetchJson(url){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),5000);
  try{
    const r=await fetch(url,{signal:controller.signal});
    if(!r.ok) throw Error('HTTP '+r.status);
    return await r.json();
  }finally{clearTimeout(timer)}
}

async function liveExchange(meta){
  if(!meta?.currency) return null;
  try{
    const d=await fetchJson('https://api.frankfurter.dev/v2/rate/'+meta.currency.toLowerCase()+'/krw');
    const rate=Number(d?.rate);
    if(!rate) return null;
    const unit=meta.unit||1;
    return {currency:meta.currency,unit,krw:Math.round(rate*unit),date:d.date||''};
  }catch{return null}
}

async function liveWeather(item,meta){
  if(!meta?.lat||!meta?.lon) return null;
  const dep=new Date(item.departureDate+'T00:00:00Z');
  const daysAway=Math.ceil((dep-Date.now())/86400000);
  if(daysAway<0||daysAway>15) return {available:false,daysAway};
  try{
    const url='https://api.open-meteo.com/v1/forecast?latitude='+meta.lat+'&longitude='+meta.lon+
      '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=16';
    const d=await fetchJson(url);
    const i=(d?.daily?.time||[]).indexOf(item.departureDate);
    if(i<0) return {available:false,daysAway};
    return {
      available:true,
      max:Math.round(Number(d.daily.temperature_2m_max?.[i])),
      min:Math.round(Number(d.daily.temperature_2m_min?.[i])),
      rain:Math.round(Number(d.daily.precipitation_probability_max?.[i]||0))
    };
  }catch{return null}
}

async function liveHolidays(item,meta){
  if(!meta?.countryCode) return null;
  try{
    const start=new Date(item.departureDate+'T00:00:00Z');
    const end=new Date(item.returnDate+'T00:00:00Z');
    const years=[...new Set([start.getUTCFullYear(),end.getUTCFullYear()])];
    const all=[];
    for(const y of years){
      const d=await fetchJson('https://date.nager.at/api/v3/publicholidays/'+y+'/'+meta.countryCode);
      if(Array.isArray(d)) all.push(...d);
    }
    return all.filter(h=>{
      const x=new Date(h.date+'T00:00:00Z');
      return x>=start&&x<=end;
    }).slice(0,3);
  }catch{return null}
}

async function secondReplyLive(item){
  const city=item.cityName||item.toCity;
  const {tip}=guideFor(item);
  const meta=LIVE_META[item.toCity];
  const [weather,fx,holidays]=await Promise.all([
    liveWeather(item,meta),
    liveExchange(meta),
    liveHolidays(item,meta)
  ]);

  let weatherText='출발일이 아직 장기예보 범위 밖이에요. 출발 약 2주 전 실제 예보를 다시 확인하세요.';
  if(weather?.available) weatherText=`출발일 예보 기준 ${weather.min}~${weather.max}℃ · 강수확률 최고 ${weather.rain}%예요. 예보는 바뀔 수 있으니 출발 직전 다시 확인하세요.`;

  let fxText='목적지 통화의 최신 환율을 출발 전에 다시 확인하세요.';
  if(fx) fxText=`현재 기준 ${fx.unit.toLocaleString('ko-KR')} ${fx.currency} ≈ ${fx.krw.toLocaleString('ko-KR')}원${fx.date?' ('+fx.date+' 기준)':''}. 카드 외에 소액 현금도 준비해두면 편해요.`;

  let holidayText='여행기간에 확인된 공식 공휴일 정보가 없습니다. 지역 축제·대형행사는 별도로 확인하는 게 좋아요.';
  if(Array.isArray(holidays)&&holidays.length){
    holidayText='여행기간 중 공식 공휴일: '+holidays.map(h=>h.date+' '+(h.localName||h.name)).join(' · ')+' — 교통·영업시간·숙박 혼잡을 미리 확인하세요.';
  }else if(holidays===null){
    holidayText='공식 공휴일 데이터를 확인하지 못했어요. 출발 전에 현지 공휴일·축제·대형행사를 다시 확인하세요.';
  }

  return [
    `📌 ${city} 출발 전에 추가로 체크할 3가지`,
    '',
    '🌦️ 날씨·옷차림',
    weatherText,
    '',
    '💴 환율·결제',
    fxText,
    '',
    '📅 현지 공휴일·행사',
    holidayText,
    '',
    `${tip.flag} 최신 정보는 변동될 수 있으니 출발 직전에 한 번 더 확인하세요.`
  ].join('\n');
}

function firstReply(item){
  const city=item.cityName||item.toCity;
  const {tip,guide}=guideFor(item);
  return [
    `${tip.flag} ${city} 가기 전에 먼저 체크할 3가지`,
    '',
    '🚇 공항 → 시내',
    guide.transit,
    '',
    '🏨 숙소 어디에?',
    guide.stay,
    '',
    '⚠️ 목적지 팁',
    guide.extra,
    '',
    '항공권 예약 전에는 실제 예약화면에서 수하물 · 출도착 공항 · 변경/취소 조건을 꼭 확인하세요.'
  ].join('\n');
}

function secondReply(item){
  const city=item.cityName||item.toCity;
  const {tip}=guideFor(item);
  return [
    `📌 ${city} 출발 전에 추가로 체크할 3가지`,
    '',
    '🌦️ 날씨·옷차림',
    '여행 날짜가 가까워지면 현지 예보를 확인하고, 먼 일정이라면 해당 시기의 평년 기후를 참고하세요.',
    '',
    '💴 환율·결제',
    '출발 전 최신 환율을 확인하고 카드 사용이 어려운 곳에 대비해 소액 현금도 준비해두면 편해요.',
    '',
    '📅 현지 연휴·행사',
    '여행기간과 현지 공휴일·축제·대형행사가 겹치는지 확인하세요. 숙박비와 교통 혼잡에 영향을 줄 수 있어요.',
    '',
    `${tip.flag} 실제 날씨·환율·행사 정보는 출발 전에 최신 정보로 다시 확인하세요.`
  ].join('\n');
}

function replyText(item){
  return Number(item.stage||1)===2?secondReply(item):firstReply(item);
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
  const store=getStore({name:'intl-flight-alert',consistency:'strong'});
  let queue=await store.get('threads-reply-queue',{type:'json'});
  queue=Array.isArray(queue)?queue:[];
  const now=new Date().toISOString();
  let cancelled=0;
  for(const item of queue){
    if(item.status==='pending'){
      item.status='cancelled';
      item.cancelledAt=now;
      item.cancelReason='all_threads_replies_disabled';
      cancelled++;
    }
  }
  await store.setJSON('threads-reply-queue',queue.slice(-300));
  console.log('threads-replies-disabled',{cancelled});
};
export const config={schedule:'*/5 * * * *'};
