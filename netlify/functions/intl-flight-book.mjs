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

function fallbackUrl(dep,arr,departureDate,returnDate){
  const trip=encodeURIComponent('A.'+dep+'.A.'+arr+'.'+departureDate+'/A.'+arr+'.A.'+dep+'.'+returnDate);
  return 'https://air-web.myrealtrip.com/results?adult=1&tripType=ROUND_TRIP&trip='+trip;
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
      return Response.redirect(partner.url,302);
    }catch(e){
      console.error('intl-flight-partner-link',dep,arr,departureDate,returnDate,e?.message||e);
      return Response.redirect(fallbackUrl(dep,arr,departureDate,returnDate),302);
    }
  }catch(e){
    return Response.json({error:String(e?.message||e)},{status:400});
  }
};

export const config={path:'/api/intl-flight-book'};
