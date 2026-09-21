import { flightPartnerLink } from './_intl-flight-lib.mjs';

function cleanAirport(v){
  const s=String(v||'').trim().toUpperCase();
  if(!/^[A-Z]{3}$/.test(s)) throw new Error('공항코드가 올바르지 않습니다.');
  return s;
}

function cleanDate(v){
  const s=String(v||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error('날짜가 올바르지 않습니다.');
  return s;
}

export default async(req)=>{
  try{
    if(req.method!=='GET') return new Response('Method Not Allowed',{status:405});
    const u=new URL(req.url);
    const dep=cleanAirport(u.searchParams.get('dep'));
    const arr=cleanAirport(u.searchParams.get('arr'));
    const departureDate=cleanDate(u.searchParams.get('departureDate'));
    const returnDate=cleanDate(u.searchParams.get('returnDate'));

    try{
      const partner=await flightPartnerLink({dep,arr,departureDate,returnDate});
      if(!partner?.partner || !partner?.url) throw new Error('파트너 마이링크 생성 실패');
      return Response.redirect(partner.url,302);
    }catch(e){
      console.error('intl-flight-partner-link',dep,arr,departureDate,returnDate,e?.message||e);
      return new Response(
        '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>항공권 링크 생성 실패</title><body style="font-family:system-ui;padding:32px;background:#071827;color:#fff"><h2>파트너 항공권 링크를 만들지 못했습니다.</h2><p>일반 링크로 우회하지 않았습니다. 잠시 후 다시 눌러주세요.</p></body>',
        {status:502,headers:{'Content-Type':'text/html; charset=utf-8'}}
      );
    }
  }catch(e){
    return Response.json({error:String(e?.message||e)},{status:400});
  }
};

export const config={path:'/api/intl-flight-book'};
