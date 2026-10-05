import { getStore } from '@netlify/blobs';

export default async()=>{
  const store=getStore({name:'intl-flight-alert',consistency:'strong'});
  const [runs,watches,alerts]=await Promise.all([
    store.get('monitor-runs',{type:'json'}),
    store.get('watches',{type:'json'}),
    store.get('recent-alerts',{type:'json'})
  ]);
  const safeRuns=(Array.isArray(runs)?runs:[]).slice(0,24);
  const safeWatches=(Array.isArray(watches)?watches:[]).map(w=>({
    id:w.id,enabled:!!w.enabled,mode:w.mode,dep:w.dep,departureDate:w.departureDate,
    period:w.period,region:w.region,combineRegions:!!w.combineRegions,
    countries:w.countries||[],airports:w.airports||[],destinationLabel:w.destinationLabel||'',
    targetPrice:w.targetPrice,updatedAt:w.updatedAt||null,
    trackedAirportCount:w.trackedAirportCount||0,lastError:w.lastError||null,
    hasSubscription:!!w.subscription
  }));
  const safeAlerts=(Array.isArray(alerts)?alerts:[]).slice(0,10).map(a=>({
    detectedAt:a.detectedAt||a.createdAt||null,toCity:a.toCity||null,
    cityName:a.cityName||null,totalPrice:a.totalPrice||null,
    previousPrice:a.previousPrice||null,type:a.type||null
  }));
  return Response.json({now:new Date().toISOString(),runs:safeRuns,watches:safeWatches,recentAlerts:safeAlerts});
};
export const config={path:'/api/intl-flight-diagnostics'};
