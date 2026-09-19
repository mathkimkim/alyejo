import { getStore } from '@netlify/blobs';
import webpush from 'web-push';
import { searchRange } from './_flight-lib.mjs';
const store=getStore({name:'flight-alert',consistency:'strong'});

export default async ()=>{
  const w=await store.get('watch',{type:'json'});
  if(!w?.enabled||!w.subscription) return Response.json({skipped:true,reason:'감시 미등록'});
  const pub=Netlify.env.get('VAPID_PUBLIC_KEY'), priv=Netlify.env.get('VAPID_PRIVATE_KEY'), subject=Netlify.env.get('VAPID_SUBJECT')||'mailto:owner@example.com';
  if(!pub||!priv) return Response.json({skipped:true,reason:'VAPID 환경변수 없음'});
  try{
    const flights=await searchRange(w.start,w.end,w.adults);
    const old=new Set(w.baseline||[]);
    const fresh=flights.filter(x=>!old.has(x.key));
    if(fresh.length){
      webpush.setVapidDetails(subject,pub,priv);
      const f=fresh[0];
      const more=fresh.length>1 ? ` 외 ${fresh.length-1}편` : '';
      const price=f.price ? ` · ${f.price.toLocaleString('ko-KR')}원` : '';
      await webpush.sendNotification(w.subscription,JSON.stringify({
        title:'✈️ 제주 → 김포 항공편 등장',
        body:`${f.date} ${f.departure?.slice(11)||f.departure} ${f.airline} ${f.flightNumber}${price}${more}`,
        url:'/flight/'
      }));
    }
    w.baseline=flights.map(x=>x.key);
    w.lastFlights=flights;
    w.updatedAt=new Date().toISOString();
    await store.setJSON('watch',w);
    return Response.json({checkedAt:w.updatedAt,count:flights.length,newCount:fresh.length,newFlights:fresh});
  }catch(e){
    return Response.json({error:String(e?.message||e)},{status:500});
  }
};
export const config={schedule:'0 * * * *'};
