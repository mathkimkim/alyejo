import { getStore } from '@netlify/blobs';
import webpush from 'web-push';
import { discoverMrt, trackMrt } from './_intl-flight-lib.mjs';

const store=getStore({name:'intl-flight-alert',consistency:'strong'});

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

function eventKey(a){
  return [a.toCity,a.departureDate,a.returnDate,a.totalPrice,a.old?.price||''].join('|');
}

export default async()=>{
  const watches=await loadWatches();
  const enabled=watches.filter(w=>w?.enabled&&w.subscription&&w.mode==='discover');
  if(!enabled.length) return;

  const pub=Netlify.env.get('VAPID_PUBLIC_KEY');
  const priv=Netlify.env.get('VAPID_PRIVATE_KEY');
  const subject=Netlify.env.get('VAPID_SUBJECT')||'mailto:owner@example.com';
  if(!pub||!priv) return;

  webpush.setVapidDetails(subject,pub,priv);
  let history=await store.get('recent-alerts',{type:'json'});
  history=Array.isArray(history)?history:[];
  const pending=[];

  for(const w of enabled){
    try{
      const [result,tracking]=await Promise.all([
        discoverMrt({
          dep:w.dep,period:w.period,region:w.region,targetPrice:w.targetPrice,departureDate:w.departureDate,
          countries:w.countries||[],airports:w.airports||[]
        }),
        trackMrt({
          dep:w.dep,period:w.period,region:w.region,departureDate:w.departureDate,limit:50,
          countries:w.countries||[],airports:w.airports||[]
        })
      ]);

      const mergedRows=[...tracking.rows,...result.rows];
      const previous=w.bestByDestination||{};
      const current=bestMap(mergedRows);

      for(const [toCity,cur] of Object.entries(current)){
        const old=previous[toCity];
        let type=null;

        if(!old){
          if(cur.price<=Number(w.targetPrice)) type='target_reached';
        }else if(cur.price<Number(old.price||0)){
          type=(Number(old.price)>Number(w.targetPrice) && cur.price<=Number(w.targetPrice))
            ? 'target_reached'
            : 'price_drop';
        }

        if(type){
          const row=mergedRows.find(x=>x.toCity===toCity && x.key===cur.key);
          if(row){
            pending.push({
              ...row,
              old,
              alertType:type,
              watch:w,
              subscription:w.subscription,
              conditionLabel:`${w.departureDate} ±2일 · ${w.destinationLabel||regionLabel(w.region)} · 목표 ${Number(w.targetPrice).toLocaleString('ko-KR')}원`
            });
          }
        }
      }

      w.bestByDestination=current;
      w.lastFares=result.rows;
      w.trackedAirportCount=tracking.trackedAirportCount;
      w.priceDropTracking=true;
      w.updatedAt=new Date().toISOString();
    }catch(e){
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
};

export const config={schedule:'0 * * * *'};
