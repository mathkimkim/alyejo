import { getStore } from '@netlify/blobs';
import webpush from 'web-push';
import { discoverMrt, trackMrt, searchMrt, flightPartnerLink } from './_intl-flight-lib.mjs';

const store=getStore({name:'intl-flight-alert',consistency:'strong'});
const PRICE_DROP_ALERT_RATE=0.10;

function bestMap(rows){
  const out={};
  for(const x of rows){
    const old=out[x.toCity];
    if(!old || x.totalPrice<old.price){
      out[x.toCity]={price:x.totalPrice,key:x.key,departureDate:x.departureDate,returnDate:x.returnDate,cityName:x.cityName||x.toCity};
    }
  }
  return out;
}

function regionLabel(expr){
  const map={all:'전체',asia:'아시아',europe:'유럽',northamerica:'북미',oceania:'오세아니아',middleeast:'중동',japan:'일본',seasia:'동남아',greater_china:'중화권',other_asia:'기타 아시아',western_europe:'서유럽',southern_europe:'남유럽',northern_europe:'북유럽',eastern_europe:'동유럽',usa:'미국',canada:'캐나다',mexico:'멕시코',australia:'호주',newzealand:'뉴질랜드',south_pacific:'남태평양',uae:'UAE',gulf:'걸프',levant_turkey:'터키·레반트',other_middleeast:'기타 중동'};
  return String(expr||'all').split(',').map(x=>map[x]||x).join('·');
}

async function loadWatches(){
  const list=await store.get('watches',{type:'json'});
  return Array.isArray(list)?list:[];
}

async function saveMonitorRun(run){
  let runs=await store.get('monitor-runs',{type:'json'});
  runs=Array.isArray(runs)?runs:[];
  const idx=runs.findIndex(x=>x.id===run.id);
  if(idx>=0) runs[idx]={...runs[idx],...run};
  else runs.unshift(run);
  const cutoff=Date.now()-48*60*60*1000;
  runs=runs.filter(x=>new Date(x.startedAt||0).getTime()>=cutoff).slice(0,60);
  await store.setJSON('monitor-runs',runs);
}

async function queueThreadsReply(item){
  let queue=await store.get('threads-reply-queue',{type:'json'});
  queue=Array.isArray(queue)?queue:[];
  if(queue.some(x=>x.id===item.id)) return;
  queue.push(item);
  await store.setJSON('threads-reply-queue',queue.slice(-300));
}

function eventKey(a){
  return [a.toCity,a.departureDate,a.returnDate,a.totalPrice,a.old?.price||''].join('|');
}

function threadsEventKey(a){
  return [a.watch?.dep||a.fromCity||'',a.toCity,a.departureDate,a.returnDate,a.totalPrice].join('|');
}

function originName(code){
  const map={ICN:'인천',GMP:'김포',PUS:'부산',CJU:'제주',TAE:'대구',CJJ:'청주',MWX:'무안'};
  return map[code]||code;
}

function threadHash(s){
  let h=0;
  for(const ch of String(s||'')) h=((h<<5)-h+ch.charCodeAt(0))|0;
  return Math.abs(h);
}

function tripDays(a){
  const s=new Date(a.departureDate+'T00:00:00Z');
  const e=new Date(a.returnDate+'T00:00:00Z');
  return Math.max(1,Math.round((e-s)/86400000)+1);
}

function priceBand(price){
  const man=Math.floor(Number(price)/10000);
  return man+'만원대';
}

function threadsText(group,partnerUrl){
  const best=group[0];
  const city=best.cityName||best.toCity;
  const country=best.countryName||'';
  const targetHit=group.some(x=>x.alertType==='target_reached');
  const dep=String(best.watch?.dep||best.fromCity||'ICN').toUpperCase();
  const price=Number(best.totalPrice);
  const oldPrices=group.map(x=>Number(x.old?.price||0)).filter(x=>x>price);
  const oldPrice=oldPrices.length?Math.min(...oldPrices):0;
  const diff=oldPrice?oldPrice-price:0;
  const dropPct=oldPrice?Math.round((diff/oldPrice)*100):Math.round(Number(best.dropPercent||0));
  const days=tripDays(best);
  const seed=threadHash([best.toCity,best.departureDate,best.returnDate,price].join('|'));

  let titles;
  if(targetHit){
    titles=[
      '🎯 기다리던 가격 나왔어요! '+city+' 왕복 '+priceBand(price),
      '🔥 '+city+' 왕복 '+priceBand(price)+' 떴어요',
      '✈️ '+city+' 이 가격이면 눈에 들어오네요 · 왕복 '+priceBand(price),
      '👀 '+city+' 목표가 아래로 내려왔어요 · 왕복 '+priceBand(price)
    ];
  }else if(dropPct>=30){
    titles=[
      '🚨 이건 많이 떨어졌는데요? '+city+' 왕복 '+priceBand(price),
      '💥 '+city+' 항공권 가격 확 떨어졌어요 · '+priceBand(price),
      '🔥 '+city+' 왕복 '+priceBand(price)+'까지 내려왔어요',
      '👀 '+city+' 가격 이 정도면 진짜 눈에 띄네요 · '+priceBand(price)
    ];
  }else if(dropPct>=20){
    titles=[
      '🔥 '+city+' 항공권 꽤 내려왔어요 · 왕복 '+priceBand(price),
      '👀 '+city+' 왕복 '+priceBand(price)+' 발견',
      '✈️ '+city+' 가격 좋아졌네요 · 왕복 '+priceBand(price),
      '📉 '+city+' 항공권 '+dropPct+'% 내려왔어요'
    ];
  }else{
    titles=[
      '👀 '+city+' 항공권 슬슬 괜찮은 가격 나왔어요',
      '✈️ '+city+' 왕복 '+priceBand(price)+' 나왔어요',
      '🔥 '+city+' 항공권 '+dropPct+'% 내려왔어요',
      '📉 '+city+' 왕복 가격 또 내려왔습니다'
    ];
  }

  const title=titles[seed%titles.length];
  const reactions=[
    dropPct>=30?'이 정도 하락폭이면 한 번 확인해볼 만하네요.':'가격이 의미 있게 내려왔어요.',
    days<=4?days+'일 일정으로 짧게 다녀오기 좋은 조건이에요.':days+'일 일정 기준으로 잡힌 가격이에요.',
    targetHit?'설정한 목표가격 아래로 내려왔습니다.':'이전 알림 기준보다 '+dropPct+'% 저렴해졌어요.'
  ];
  const reaction=reactions[(seed>>2)%reactions.length];

  const priceLine=oldPrice
    ? oldPrice.toLocaleString('ko-KR')+'원 → '+price.toLocaleString('ko-KR')+'원\n▼ '+diff.toLocaleString('ko-KR')+'원'+(dropPct?' · '+dropPct+'%↓':'')
    : '왕복 '+price.toLocaleString('ko-KR')+'원';

  const placeLine=country?'🌏 '+country+' · '+city:'🌏 '+city;

  return [
    title,
    '',
    reaction,
    priceLine,
    '',
    '✈️ '+originName(dep)+'('+dep+') → '+city+'('+best.toCity+')',
    '📅 '+best.departureDate+' → '+best.returnDate+' · '+days+'일',
    placeLine,
    '',
    '지금 가격 확인 👇',
    partnerUrl
  ].join('\n');
}

async function postThreads(text,accessToken,linkAttachment){
  const params=new URLSearchParams({
    media_type:'TEXT',
    text,
    auto_publish_text:'true',
    link_attachment:linkAttachment
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
    const error=new Error(result?.error?.message||'Threads 게시 실패');
    error.code=result?.error?.code||response.status;
    throw error;
  }
  return result;
}

export default async()=>{
  const startedAt=new Date().toISOString();
  const run={
    id:'run_'+Date.now()+'_'+Math.random().toString(36).slice(2,8),
    startedAt,
    finishedAt:null,
    status:'running',
    watchCount:0,
    candidateCount:0,
    freshVerifyCount:0,
    alertCount:0,
    pushCount:0,
    threadsCount:0,
    errorCount:0,
    threadsPosts:[]
  };

  const watches=await loadWatches();
  const enabled=watches.filter(w=>w?.enabled&&w.subscription&&w.mode==='discover');
  run.watchCount=enabled.length;
  await saveMonitorRun(run);

  if(!enabled.length){
    await saveMonitorRun({...run,status:'no_watches',finishedAt:new Date().toISOString()});
    return;
  }

  const pub=Netlify.env.get('VAPID_PUBLIC_KEY');
  const priv=Netlify.env.get('VAPID_PRIVATE_KEY');
  const subject=Netlify.env.get('VAPID_SUBJECT')||'mailto:owner@example.com';
  if(!pub||!priv){
    await saveMonitorRun({...run,status:'error',errorCount:1,finishedAt:new Date().toISOString(),lastError:'VAPID 환경변수가 없습니다.'});
    return;
  }

  webpush.setVapidDetails(subject,pub,priv);
  let history=await store.get('recent-alerts',{type:'json'});
  history=Array.isArray(history)?history:[];
  const pending=[];
  const threadsAccessToken=Netlify.env.get('THREADS_ACCESS_TOKEN')||'';
  let threadsPosted=await store.get('threads-posted-events',{type:'json'});
  threadsPosted=Array.isArray(threadsPosted)?threadsPosted:[];
  const threadsPostedSet=new Set(threadsPosted.map(x=>x.key));

  for(const w of enabled){
    try{
      const [result,tracking]=await Promise.all([
        discoverMrt({
          dep:w.dep,period:w.period,region:w.region,targetPrice:w.targetPrice,departureDate:w.departureDate,
          countries:w.countries||[],airports:w.airports||[],combineRegions:!!w.combineRegions
        }),
        trackMrt({
          dep:w.dep,period:w.period,region:w.region,departureDate:w.departureDate,limit:50,
          countries:w.countries||[],airports:w.airports||[],combineRegions:!!w.combineRegions
        })
      ]);

      const mergedRows=[...tracking.rows,...result.rows];
      const previous=w.bestByDestination||{};
      const current=bestMap(mergedRows);
      const baseline={...(w.alertBaselineByDestination||{})};

      for(const [toCity,cur] of Object.entries(current)){
        const old=previous[toCity];
        const reference=baseline[toCity]||old||cur;
        const targetPrice=Number(w.targetPrice);
        const targetCandidate=!old
          ? cur.price<=targetPrice
          : Number(old.price)>targetPrice && cur.price<=targetPrice;
        const dropCandidate=Number(reference?.price)>0
          && cur.price<=Number(reference.price)*(1-PRICE_DROP_ALERT_RATE);

        if(targetCandidate || dropCandidate) run.candidateCount++;

        if(!targetCandidate && !dropCandidate){
          if(!baseline[toCity]) baseline[toCity]={...reference};
          continue;
        }

        const row=mergedRows.find(x=>x.toCity===toCity && x.key===cur.key);
        if(!row) continue;

        try{
          run.freshVerifyCount++;
          const fresh=await searchMrt({
            dep:w.dep,
            arr:toCity,
            start:row.departureDate,
            end:row.departureDate,
            period:w.period,
            forceFresh:true
          });
          const freshRow=fresh.rows
            .filter(x=>x.departureDate===row.departureDate && x.returnDate===row.returnDate && Number(x.totalPrice)>0)
            .sort((a,b)=>Number(a.totalPrice)-Number(b.totalPrice))[0];
          if(!freshRow) continue;

          const freshPrice=Number(freshRow.totalPrice);
          current[toCity]={
            price:freshPrice,
            key:freshRow.key,
            departureDate:freshRow.departureDate,
            returnDate:freshRow.returnDate,
            cityName:row.cityName||cur.cityName||toCity
          };

          const targetHit=!old
            ? freshPrice<=targetPrice
            : Number(old.price)>targetPrice && freshPrice<=targetPrice;
          const dropHit=Number(reference?.price)>0
            && freshPrice<=Number(reference.price)*(1-PRICE_DROP_ALERT_RATE);

          if(!targetHit && !dropHit) continue;

          const type=targetHit?'target_reached':'price_drop';
          const referencePrice=Number(reference?.price||old?.price||0);
          const dropPercent=referencePrice>freshPrice
            ? Math.round(((referencePrice-freshPrice)/referencePrice)*1000)/10
            : 0;

          pending.push({
            ...row,
            ...freshRow,
            cityName:row.cityName||cur.cityName||toCity,
            airportName:row.airportName||'',
            countryName:row.countryName||'',
            old:referencePrice>0?{...reference,price:referencePrice}:old,
            alertType:type,
            dropPercent,
            freshVerified:true,
            watch:w,
            subscription:w.subscription,
            conditionLabel:`${w.departureDate} ±2일 · ${w.destinationLabel||regionLabel(w.region)} · 목표 ${targetPrice.toLocaleString('ko-KR')}원`
          });

          baseline[toCity]={
            price:freshPrice,
            key:freshRow.key,
            departureDate:freshRow.departureDate,
            returnDate:freshRow.returnDate,
            cityName:row.cityName||cur.cityName||toCity,
            alertedAt:new Date().toISOString()
          };
        }catch(freshErr){
          run.errorCount++;
          console.error('intl-flight-fresh-verify',w.id,toCity,freshErr);
        }
      }

      for(const [toCity,cur] of Object.entries(current)){
        if(!baseline[toCity]) baseline[toCity]={...cur};
      }

      w.alertBaselineByDestination=baseline;
      w.priceDropThresholdPercent=10;
      w.freshVerifyBeforeAlert=true;
      w.bestByDestination=current;
      w.lastFares=result.rows;
      w.trackedAirportCount=tracking.trackedAirportCount;
      w.priceDropTracking=true;
      w.updatedAt=new Date().toISOString();
    }catch(e){
      run.errorCount++;
      console.error('intl-flight-monitor',w.id,e);
      w.updatedAt=new Date().toISOString();
      w.lastError=String(e?.message||e);
    }
  }

  const groups=new Map();
  for(const a of pending){
    const endpoint=a.subscription?.endpoint||'';
    const key=endpoint+'||'+eventKey(a);
    if(!groups.has(key)) groups.set(key,[]);
    groups.get(key).push(a);
  }

  run.alertCount=groups.size;

  if(threadsAccessToken && pending.length){
    const threadsGroups=new Map();
    for(const a of pending){
      const key=threadsEventKey(a);
      if(!threadsGroups.has(key)) threadsGroups.set(key,[]);
      threadsGroups.get(key).push(a);
    }

    for(const [key,group] of threadsGroups){
      if(threadsPostedSet.has(key)) continue;
      try{
        const best=group[0];
        const dep=String(best.watch?.dep||best.fromCity||'ICN').toUpperCase();
        const partner=await flightPartnerLink({
          dep,
          arr:String(best.toCity||'').toUpperCase(),
          departureDate:best.departureDate,
          returnDate:best.returnDate
        });
        if(!partner?.partner || !partner?.url) throw new Error('Threads용 파트너 마이링크 생성 실패');

        const result=await postThreads(
          threadsText(group,partner.url),
          threadsAccessToken,
          partner.url
        );
        const item={
          key,
          id:result?.id||null,
          mylinkId:partner.mylinkId||null,
          partnerUrl:partner.url,
          postedAt:new Date().toISOString(),
          toCity:group[0].toCity,
          departureDate:group[0].departureDate,
          returnDate:group[0].returnDate,
          totalPrice:group[0].totalPrice
        };
        threadsPosted=[item,...threadsPosted].slice(0,300);
        threadsPostedSet.add(key);
        if(result?.id){
          const replyBase={
            rootPostId:result.id,
            queuedAt:new Date().toISOString(),
            status:'pending',
            attempts:0,
            toCity:group[0].toCity,
            cityName:group[0].cityName||group[0].toCity,
            countryName:group[0].countryName||'',
            departureDate:group[0].departureDate,
            returnDate:group[0].returnDate,
            totalPrice:group[0].totalPrice,
            previousPrice:group[0].old?.price||null,
            dropPercent:group[0].dropPercent||0
          };
          await queueThreadsReply({
            ...replyBase,
            id:'reply1_'+result.id,
            stage:1,
            dueAt:new Date(Date.now()+10*60*1000).toISOString()
          });
          await queueThreadsReply({
            ...replyBase,
            id:'reply2_'+result.id,
            stage:2,
            dueAt:new Date(Date.now()+20*60*1000).toISOString()
          });
        }
        run.threadsCount++;
        run.threadsPosts.push({
          cityName:group[0].cityName||group[0].toCity,
          toCity:group[0].toCity,
          departureDate:group[0].departureDate,
          returnDate:group[0].returnDate,
          totalPrice:group[0].totalPrice,
          type:group.some(x=>x.alertType==='target_reached')?'target_reached':'price_drop'
        });
      }catch(e){
        run.errorCount++;
        console.error('threads-auto-post',key,e?.code||'',e?.message||e);
      }
    }
  }

  const detectedAt=new Date().toISOString();
  const newHistory=[];

  for(const group of groups.values()){
    const best=group[0];
    const targetHit=group.some(x=>x.alertType==='target_reached');
    const alertType=targetHit?'target_reached':'price_drop';
    const conditions=[...new Set(group.map(x=>x.conditionLabel))];
    const watchIds=[...new Set(group.map(x=>x.watch.id))];
    const targetPrices=[...new Set(group.map(x=>Number(x.watch.targetPrice)))].sort((a,b)=>a-b);
    const priceDrop=best.old?.price && best.totalPrice<best.old.price
      ? ` · ${Number(best.old.price).toLocaleString('ko-KR')}원→${best.totalPrice.toLocaleString('ko-KR')}원`
      : '';
    const conditionNote=conditions.length>1?` · 등록조건 ${conditions.length}개`:'';

    try{
      await webpush.sendNotification(best.subscription,JSON.stringify({
        title:alertType==='target_reached'?'🎯 목표가 도달':'📉 해외 최저가 하락',
        body:`${best.cityName||best.toCity} · ${best.departureDate}~${best.returnDate} · ${best.totalPrice.toLocaleString('ko-KR')}원${priceDrop}${conditionNote}`,
        url:'/intl-flight/'
      }));
      run.pushCount++;

      newHistory.push({
        id:[detectedAt,best.toCity,best.departureDate,best.returnDate,best.totalPrice].join('|'),
        detectedAt,
        watchId:watchIds[0],
        watchIds,
        conditionCount:conditions.length,
        conditions,
        targetPrices,
        type:alertType,
        dep:best.watch.dep,
        region:best.watch.region,
        countries:best.watch.countries||[],
        airports:best.watch.airports||[],
        regionLabel:best.watch.destinationLabel||regionLabel(best.watch.region),
        targetPrice:Math.max(...targetPrices),
        watchDepartureDate:best.watch.departureDate,
        period:best.watch.period,
        cityName:best.cityName||best.toCity,
        airportName:best.airportName||'',
        countryName:best.countryName||'',
        toCity:best.toCity,
        departureDate:best.departureDate,
        returnDate:best.returnDate,
        totalPrice:best.totalPrice,
        previousPrice:best.old?.price||null
      });
    }catch(pushErr){
      run.errorCount++;
      const code=pushErr?.statusCode;
      if(code===404||code===410){
        for(const a of group) a.watch.enabled=false;
      }
      console.error('intl-flight-push',best.toCity,pushErr);
    }
  }

  if(newHistory.length) history=[...newHistory,...history].slice(0,50);
  await store.setJSON('watches',watches);
  await store.setJSON('recent-alerts',history);
  if(threadsAccessToken) await store.setJSON('threads-posted-events',threadsPosted);
  await saveMonitorRun({
    ...run,
    status:run.errorCount?'partial_error':'ok',
    finishedAt:new Date().toISOString()
  });
};

export const config={schedule:'0 * * * *'};
