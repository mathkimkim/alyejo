import { getStore } from '@netlify/blobs';
import { publishFacebook, createInstagramMedia, publishInstagramMedia } from './_flight-social.mjs';

const store=getStore({name:'intl-flight-alert',consistency:'strong'});
const save=queue=>store.setJSON('flight-social-queue',queue.slice(-300));

export default async()=>{
  if(Netlify.env.get('SOCIAL_CROSSPOST_ENABLED')!=='true')return;
  const fbPageId=Netlify.env.get('FACEBOOK_PAGE_ID')||'';
  const fbToken=Netlify.env.get('FACEBOOK_PAGE_ACCESS_TOKEN')||'';
  const igUserId=Netlify.env.get('INSTAGRAM_USER_ID')||'';
  const igToken=Netlify.env.get('INSTAGRAM_ACCESS_TOKEN')||'';
  if(!(fbPageId&&fbToken)&&!(igUserId&&igToken))return;
  const queue=await store.get('flight-social-queue',{type:'json'});
  if(!Array.isArray(queue))return;
  let attempts=0;
  for(const item of queue){
    if(attempts>=3)break;
    for(const platform of ['facebook','instagram']){
      if(attempts>=3)break;
      const ready=platform==='facebook'?fbPageId&&fbToken:igUserId&&igToken;
      if(!ready||item[platform]?.status!=='pending')continue;
      attempts++;
      // Claim before the external call. An uncertain response requires review,
      // rather than risking duplicate public posts on the next cron run.
      item[platform]={status:'posting',startedAt:new Date().toISOString()};
      await save(queue);
      try{
        let result;
        if(platform==='facebook'){
          result=await publishFacebook({pageId:fbPageId,token:fbToken,text:item.text,link:item.partnerUrl});
        }else{
          const site=(Netlify.env.get('URL')||'https://alryeok-behavior-mvp.netlify.app').replace(/\/$/,'');
          const imageUrl=`${site}/api/flight-social-card/${item.cardId}`;
          const container=await createInstagramMedia({igUserId,token:igToken,caption:item.text,imageUrl});
          item.instagram={...item.instagram,creationId:container.id};
          await save(queue);
          result=await publishInstagramMedia({igUserId,token:igToken,creationId:container.id});
        }
        item[platform]={status:'posted',postId:result.id,postedAt:new Date().toISOString()};
      }catch(error){
        item[platform]={...item[platform],status:'needs_review',error:String(error?.message||error).slice(0,300)};
        console.error('flight-social-publish',platform,item.key,error?.code||'',error?.message||error);
      }
      await save(queue);
    }
  }
};
export const config={schedule:'*/5 * * * *'};
