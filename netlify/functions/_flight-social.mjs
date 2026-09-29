const GRAPH_VERSION='v26.0';

async function graphPost(path,fields,token){
  const response=await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${path}`,{
    method:'POST',
    headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams(fields)
  });
  const result=await response.json().catch(()=>({}));
  if(!response.ok||!result.id){
    const error=new Error(result?.error?.message||`Meta 게시 요청 실패 (${response.status})`);
    error.code=result?.error?.code||response.status;
    throw error;
  }
  return result;
}

export async function publishFacebook({pageId,token,text,link}){
  return graphPost(`${encodeURIComponent(pageId)}/feed`,{message:text,link},token);
}

export async function createInstagramMedia({igUserId,token,caption,imageUrl}){
  return graphPost(`${encodeURIComponent(igUserId)}/media`,{image_url:imageUrl,caption},token);
}

export async function publishInstagramMedia({igUserId,token,creationId}){
  return graphPost(`${encodeURIComponent(igUserId)}/media_publish`,{creation_id:creationId},token);
}

export function socialCardSvg(card){
  const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const city=escape(String(card.cityCode||'').toUpperCase().slice(0,4));
  const dep=escape(String(card.dep||'ICN').toUpperCase().slice(0,4));
  const price=Number(card.price||0).toLocaleString('en-US');
  const date=escape(String(card.departureDate||'').slice(5)+'  -  '+String(card.returnDate||'').slice(5));
  const days=Math.max(1,Math.min(30,Number(card.days)||1));
  const percent=Math.max(0,Math.min(99,Math.round(Number(card.belowAveragePercent)||0)));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
  <defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#07192b"/><stop offset="1" stop-color="#143e62"/></linearGradient></defs>
  <rect width="1080" height="1350" fill="url(#bg)"/>
  <rect x="70" y="72" width="940" height="1206" rx="48" fill="#102a43" stroke="#46789d" stroke-width="2"/>
  <text x="120" y="173" fill="#81b9f9" font-family="sans-serif" font-size="34" font-weight="700">FLIGHT PRICE ALERT</text>
  <text x="120" y="360" fill="white" font-family="sans-serif" font-size="106" font-weight="800">${dep}  →  ${city}</text>
  <text x="120" y="447" fill="#b8ccdc" font-family="sans-serif" font-size="43">ROUND TRIP · ${days} DAYS</text>
  <text x="120" y="650" fill="#83bbff" font-family="sans-serif" font-size="56" font-weight="700">KRW</text>
  <text x="120" y="780" fill="white" font-family="sans-serif" font-size="133" font-weight="800">${price}</text>
  <rect x="120" y="850" width="840" height="150" rx="30" fill="#1a5277"/>
  <text x="160" y="943" fill="white" font-family="sans-serif" font-size="52" font-weight="700">${percent}% BELOW MONTHLY AVG</text>
  <text x="120" y="1110" fill="#b8ccdc" font-family="sans-serif" font-size="48">${date}</text>
  <text x="120" y="1215" fill="#81b9f9" font-family="sans-serif" font-size="35">Check the latest fare before booking</text>
  </svg>`;
}
