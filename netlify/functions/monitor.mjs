import { getStore } from '@netlify/blobs';
import webpush from 'web-push';

const store = getStore({ name: 'alryeok-route', consistency: 'strong' });
const kst = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false });
const mins = t => { const [h,m] = String(t).split(':').map(Number); return h*60+m; };
const iso = (date,time) => `${date}T${time}:00+0900`;
const summary = j => [j,j?.properties,j?.route,j?.routesInfo,j?.features?.[0]?.properties].find(x=>x&&x.totalTime!==undefined);

export default async () => {
  const item = await store.get('active', { type: 'json' });
  const appKey = Netlify.env.get('TMAP_APP_KEY'), privateKey = Netlify.env.get('VAPID_PRIVATE_KEY'), publicKey = Netlify.env.get('VAPID_PUBLIC_KEY'), subject = Netlify.env.get('VAPID_SUBJECT') || 'mailto:owner@example.com';
  if (!item?.enabled || !item.route || !item.subscription || !appKey || !privateKey || !publicKey) return Response.json({ skipped: true, reason: '설정 또는 환경변수 부족' });
  const now = kst.formatToParts(new Date()).reduce((o,x)=>(o[x.type]=x.value,o),{}), date=`${now.year}-${now.month}-${now.day}`, day=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(now.weekday), current=Number(now.hour)*60+Number(now.minute), p=item.route;
  if (!p.days?.includes(day) || current < mins(p.monitor) || current > mins(p.depart)) return Response.json({ skipped: true, reason: '감시 시간 외' });
  if (await store.get(`alert:${date}`)) return Response.json({ skipped: true, reason: '오늘 알림 완료' });
  webpush.setVapidDetails(subject, publicKey, privateKey);
  const body={routesInfo:{departure:{name:p.origin.name||'출발지',lon:String(p.origin.lon),lat:String(p.origin.lat),depSearchFlag:'03'},destination:{name:p.dest.name||'도착지',lon:String(p.dest.lon),lat:String(p.dest.lat),destSearchFlag:'03'},predictionType:'arrival',predictionTime:iso(date,p.arrival),searchOption:'00',tollgateCarType:'car',trafficInfo:'N'}};
  const r=await fetch('https://apis.openapi.sk.com/tmap/routes/prediction?version=1&reqCoordType=WGS84GEO&resCoordType=WGS84GEO&totalValue=2',{method:'POST',headers:{appKey,'Content-Type':'application/json'},body:JSON.stringify(body)}), j=await r.json(), seconds=Number(summary(j)?.totalTime), predicted=Math.max(1,Math.round(seconds/60)), delta=predicted-Number(p.dur);
  if (r.ok && Number.isFinite(seconds) && delta>=8) {
    const msg=`${p.name||'이동'} 경로가 평소보다 ${delta}분 지연될 것으로 예상됩니다. 권장 출발시간보다 일찍 출발하세요.`;
    try { await webpush.sendNotification(item.subscription, JSON.stringify({ title:'알려줘 · 이동 이상 감지', body:msg })); } catch (e) { await store.delete('active'); throw e; }
    await store.set(`alert:${date}`, new Date().toISOString());
    return Response.json({ alerted:true, predicted, baseline:p.dur, delta });
  }
  return Response.json({ alerted:false, predicted, baseline:p.dur, delta });
};

export const config = { schedule: '*/5 * * * *' };
