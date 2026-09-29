import { getStore } from '@netlify/blobs';
import sharp from 'sharp';
import { socialCardSvg } from './_flight-social.mjs';

export default async(request,context)=>{
  if(request.method!=='GET')return new Response('Method not allowed',{status:405});
  const id=String(context.params?.id||'');
  if(!/^[a-f0-9]{32}$/.test(id))return new Response('Not found',{status:404});
  const store=getStore({name:'intl-flight-alert',consistency:'strong'});
  const card=await store.get(`social-card-${id}`,{type:'json'});
  if(!card)return new Response('Not found',{status:404});
  const jpeg=await sharp(Buffer.from(socialCardSvg(card))).jpeg({quality:88}).toBuffer();
  return new Response(jpeg,{headers:{'Content-Type':'image/jpeg','Cache-Control':'public, max-age=86400'}});
};
export const config={path:'/api/flight-social-card/:id'};
