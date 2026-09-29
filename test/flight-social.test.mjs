import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { publishFacebook, createInstagramMedia, publishInstagramMedia, socialCardSvg } from '../netlify/functions/_flight-social.mjs';

test('Facebook Page and Instagram use separate Graph publishing flows',async()=>{
  const oldFetch=globalThis.fetch;
  const calls=[];
  globalThis.fetch=async(url,options)=>{
    calls.push({url,body:new URLSearchParams(options.body),authorization:options.headers.Authorization});
    return {ok:true,json:async()=>({id:String(calls.length)})};
  };
  try{
    await publishFacebook({pageId:'123',token:'fb-token',text:'Fare',link:'https://example.com/fare'});
    const media=await createInstagramMedia({igUserId:'456',token:'ig-token',caption:'Fare',imageUrl:'https://example.com/card.jpg'});
    await publishInstagramMedia({igUserId:'456',token:'ig-token',creationId:media.id});
    assert.match(calls[0].url,/\/123\/feed$/);
    assert.equal(calls[0].body.get('link'),'https://example.com/fare');
    assert.match(calls[1].url,/\/456\/media$/);
    assert.equal(calls[1].body.get('image_url'),'https://example.com/card.jpg');
    assert.match(calls[2].url,/\/456\/media_publish$/);
    assert.equal(calls[2].body.get('creation_id'),'2');
    assert.equal(calls[2].authorization,'Bearer ig-token');
  }finally{globalThis.fetch=oldFetch}
});

test('Instagram price card renders as a 1080 pixel JPEG',async()=>{
  const svg=socialCardSvg({dep:'ICN',cityCode:'CDG',price:687000,days:7,departureDate:'2026-10-12',returnDate:'2026-10-18',belowAveragePercent:23});
  const image=await sharp(Buffer.from(svg)).jpeg().toBuffer();
  const meta=await sharp(image).metadata();
  assert.equal(meta.format,'jpeg');
  assert.equal(meta.width,1080);
  assert.equal(meta.height,1350);
  assert.match(svg,/687,000/);
});
