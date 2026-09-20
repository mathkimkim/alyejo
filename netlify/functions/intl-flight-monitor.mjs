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
  const map={all:'전체',asia:'아시아',europe:'유럽',northamerica:'북미',oceania:'오세아니아',middleeast:'중동',africa:'아프리카',japan:'일본',seasia:'동남아',greater_china:'중화권',other_asia:'기타 아시아',western_europe:'서유럽',southern_europe:'남유럽',northern_europe:'북유럽',eastern_europe:'동유럽',usa:'미국',canada:'캐나다',mexico:'멕시코',australia:'호주',newzealand:'뉴질랜드',south_pacific:'남태평양',uae:'UAE',gulf:'걸프',levant_turkey:'터키·레반트',other_middleeast:'기타 중동',north_africa:'북아프리카',east_africa:'동아프리카',southern_africa:'남아프리카',west_central_africa:'서·중앙아프리카'};
  return String(expr||'all').split(',').map(x=>map[x]||x).join('·');
}

async function loadWatches(){
  const list=await store.get('watches',{type:'json'});
  return Array.isArray(list)?list:[];
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
      const alerts=[];

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
          if(row) alerts.push({...row,old,alertType:type});
        }
      }

      if(alerts.length){
        const best=[...alerts].sort((a,b)=>a.totalPrice-b.totalPrice)[0];
        const priceDrop=best.old?.price && best.totalPrice<best.old.price
          ? ` · ${Number(best.old.price).toLocaleString('ko-KR')}원→${best.totalPrice.toLocaleString('ko-KR')}원`
          : '';
        const more=alerts.length>1?` 외 ${alerts.length-1}곳`:'';
        const condition=`${w.departureDate} ±2일 · ${w.destinationLabel||regionLabel(w.region)}`;
        const detectedAt=new Date().toISOString();
        const alertType=best.alertType;

        try{
          await webpush.sendNotification(w.subscription,JSON.stringify({
            title:alertType==='target_reached'?'🎯 목표가 도달':'📉 해외 최저가 하락',
            body:`[${condition}] ${best.cityName||best.toCity} · ${best.departureDate}~${best.returnDate} · ${best.totalPrice.toLocaleString('ko-KR')}원${priceDrop}${more}`,
            url:'/intl-flight/'
          }));

          const entries=alerts.map(a=>({
            id:[detectedAt,w.id,a.toCity,a.key].join('|'),
            detectedAt,
            watchId:w.id,
            type:a.alertType,
            dep:w.dep,
            region:w.region,
            countries:w.countries||[],
            airports:w.airports||[],
            regionLabel:w.destinationLabel||regionLabel(w.region),
            targetPrice:w.targetPrice,
            watchDepartureDate:w.departureDate,
            period:w.period,
            cityName:a.cityName||a.toCity,
            airportName:a.airportName||'',
            countryName:a.countryName||'',
            toCity:a.toCity,
            departureDate:a.departureDate,
            returnDate:a.returnDate,
            totalPrice:a.totalPrice,
            previousPrice:a.old?.price||null
          }));

          history=[...entries,...history].slice(0,50);
        }catch(pushErr){
          const code=pushErr?.statusCode;
          if(code===404||code===410) w.enabled=false;
          console.error('intl-flight-push',w.id,pushErr);
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

  await store.setJSON('watches',watches);
  await store.setJSON('recent-alerts',history);
};

export const config={schedule:'0 * * * *'};
