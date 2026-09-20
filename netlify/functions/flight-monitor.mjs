import { getStore } from '@netlify/blobs';
import webpush from 'web-push';
import { searchRange } from './_flight-lib.mjs';

const store=getStore({name:'flight-alert',consistency:'strong'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

export default async ()=>{
  const w=await store.get('watch',{type:'json'});
  if(!w?.enabled||!w.subscription) return Response.json({skipped:true,reason:'감시 미등록'});
  const pub=Netlify.env.get('VAPID_PUBLIC_KEY'), priv=Netlify.env.get('VAPID_PRIVATE_KEY'), subject=Netlify.env.get('VAPID_SUBJECT')||'mailto:owner@example.com';
  if(!pub||!priv) return Response.json({skipped:true,reason:'VAPID 환경변수 없음'});

  try{
    const flights=await searchRange(w.start,w.end,w.adults,true);
    const old=new Set(w.baseline||[]);
    const fresh=flights.filter(x=>!old.has(x.key));

    let confirmed=[];
    if(fresh.length){
      await sleep(4000);
      const verify=await searchRange(w.start,w.end,w.adults,true);
      const verifyKeys=new Set(verify.map(x=>x.key));
      confirmed=fresh.filter(x=>verifyKeys.has(x.key));

      if(confirmed.length){
        webpush.setVapidDetails(subject,pub,priv);
        const f=confirmed[0];
        const more=confirmed.length>1 ? ` 외 ${confirmed.length-1}편` : '';
        const price=f.price ? ` · ${f.price.toLocaleString('ko-KR')}원` : '';
        const detectedAt=new Date().toISOString();

        await webpush.sendNotification(w.subscription,JSON.stringify({
          title:'✈️ 제주 → 김포 항공편 등장',
          body:`${f.date} ${f.departure?.slice(11)||f.departure} ${f.airline} ${f.flightNumber}${price}${more}`,
          url:'/flight/'
        }));

        const history=await store.get('recent-alerts',{type:'json'});
        const oldHistory=Array.isArray(history)?history:[];
        const entries=confirmed.map(x=>({
          id:[detectedAt,x.key].join('|'),
          detectedAt,
          route:'CJU-GMP',
          date:x.date,
          departure:x.departure,
          arrival:x.arrival,
          airline:x.airline,
          flightNumber:x.flightNumber,
          price:x.price,
          key:x.key
        }));
        await store.setJSON('recent-alerts',[...entries,...oldHistory].slice(0,50));
      }
    }

    w.baseline=flights.map(x=>x.key);
    w.lastFlights=flights;
    w.updatedAt=new Date().toISOString();
    await store.setJSON('watch',w);

    return Response.json({
      checkedAt:w.updatedAt,
      count:flights.length,
      firstDetected:fresh.length,
      confirmedCount:confirmed.length,
      confirmedFlights:confirmed
    });
  }catch(e){
    return Response.json({error:String(e?.message||e)},{status:500});
  }
};

export const config={schedule:'0 * * * *'};
