import { getStore } from '@netlify/blobs';
import { discoverMrt } from './_intl-flight-lib.mjs';

const store=getStore({name:'intl-flight-alert',consistency:'strong'});
const MAX_WATCHES=10;

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

function newId(){
  return globalThis.crypto?.randomUUID?.() || ('w_'+Date.now()+'_'+Math.random().toString(36).slice(2,9));
}

async function loadWatches(){
  const list=await store.get('watches',{type:'json'});
  if(Array.isArray(list)) return list;

  const legacy=await store.get('watch',{type:'json'});
  if(legacy?.mode==='discover'){
    const migrated=[{...legacy,id:newId(),createdAt:legacy.updatedAt||new Date().toISOString()}];
    await store.setJSON('watches',migrated);
    await store.delete('watch');
    return migrated;
  }
  return [];
}

function publicWatch(w){
  return {
    id:w.id,enabled:!!w.enabled,mode:w.mode,dep:w.dep,period:w.period,region:w.region,
    departureDate:w.departureDate,targetPrice:w.targetPrice,createdAt:w.createdAt,updatedAt:w.updatedAt
  };
}

export default async(req)=>{
  try{
    const url=new URL(req.url);
    let watches=await loadWatches();

    if(req.method==='GET'){
      return Response.json({watches:watches.map(publicWatch),count:watches.length});
    }

    if(req.method==='DELETE'){
      const id=url.searchParams.get('id');
      if(id){
        watches=watches.filter(w=>w.id!==id);
        await store.setJSON('watches',watches);
        return Response.json({ok:true,watches:watches.map(publicWatch)});
      }
      watches=watches.map(w=>({...w,enabled:false,updatedAt:new Date().toISOString()}));
      await store.setJSON('watches',watches);
      return Response.json({ok:true,watches:watches.map(publicWatch)});
    }

    if(req.method==='PATCH'){
      const body=await req.json();
      const id=String(body.id||'');
      const idx=watches.findIndex(w=>w.id===id);
      if(idx<0) return Response.json({error:'알림 조건을 찾을 수 없습니다.'},{status:404});
      watches[idx]={...watches[idx],enabled:!!body.enabled,updatedAt:new Date().toISOString()};
      await store.setJSON('watches',watches);
      return Response.json({ok:true,watch:publicWatch(watches[idx])});
    }

    if(req.method!=='POST') return new Response('Method Not Allowed',{status:405});

    const body=await req.json();
    if(!body.subscription?.endpoint) return Response.json({error:'푸시 구독 정보가 없습니다.'},{status:400});
    if(watches.length>=MAX_WATCHES) return Response.json({error:'알림은 최대 10개까지 등록할 수 있습니다.'},{status:400});

    const targetPrice=Math.max(1,Number(body.targetPrice||0));
    const dep=String(body.dep||'ICN').toUpperCase();
    const period=Number(body.period||5);
    const region=body.region||'all';
    const departureDate=body.departureDate;

    const duplicate=watches.find(w=>
      w.dep===dep && Number(w.period)===period && w.region===region &&
      w.departureDate===departureDate && Number(w.targetPrice)===targetPrice
    );
    if(duplicate){
      duplicate.enabled=true;
      duplicate.subscription=body.subscription;
      duplicate.updatedAt=new Date().toISOString();
      await store.setJSON('watches',watches);
      return Response.json({ok:true,duplicate:true,watch:publicWatch(duplicate)});
    }

    const result=await discoverMrt({dep,period,region,targetPrice,departureDate});
    const now=new Date().toISOString();
    const value={
      id:newId(),enabled:true,mode:'discover',dep,period,region,departureDate,targetPrice,
      subscription:body.subscription,
      bestByDestination:bestMap(result.rows),
      lastFares:result.rows,
      createdAt:now,updatedAt:now
    };

    watches.push(value);
    await store.setJSON('watches',watches);

    return Response.json({
      ok:true,watch:publicWatch(value),count:result.rows.length,
      windowStart:result.windowStart,windowEnd:result.windowEnd,cached:result.cached
    });
  }catch(e){
    return Response.json({error:String(e?.message||e)},{status:400});
  }
};

export const config={path:'/api/intl-flight-watch'};
