import { getStore } from '@netlify/blobs';
import { selectReplyBlog } from './_naver-reply-link.mjs';

const page=`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>후쿠오카 답글 승인</title><style>body{font:16px/1.5 system-ui;max-width:850px;margin:30px auto;padding:16px;color:#172336}input,button{font:inherit;padding:9px;margin:4px}input{width:min(90%,440px)}article{border:1px solid #ccd5e2;border-radius:12px;padding:16px;margin:18px 0}a{overflow-wrap:anywhere}pre{white-space:pre-wrap}</style>
<h1>후쿠오카 답글 링크 승인</h1><p>원글마다 1차·2차 링크를 준비하고 직접 확인한 뒤 승인하세요. 승인 전에는 게시되지 않습니다.</p>
<label>관리자 키 <input id="key" type="password" autocomplete="off"></label><button onclick="load()">대기 목록 보기</button><div id="list"></div>
<script>
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function call(action,rootPostId,links){
 const r=await fetch(location.pathname,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:document.querySelector('#key').value,action,rootPostId,links})});
 const data=await r.json();if(!r.ok)throw Error(data.error||'요청 실패');return data;
}
async function load(){
 try{const d=await call('list');document.querySelector('#list').innerHTML=d.groups.length?d.groups.map(g=>`<article><h2>${esc(g.cityName)} 원글 ${esc(g.rootPostId)}</h2><p><a href="https://www.threads.net/t/${encodeURIComponent(g.rootPostId)}" target="_blank" rel="noopener">Threads 원글 ID 확인</a></p>${g.items.map(x=>`<p>${x.stage}차: ${esc(x.status)}${x.source?`<br><a href="${esc(x.source.url)}" target="_blank" rel="noopener noreferrer">${esc(x.source.title)}</a><br>${esc(x.source.url)}`:''}</p>`).join('')}<button onclick="act('prepare','${esc(g.rootPostId)}')">링크 준비/새로 찾기</button><button onclick="approve('${esc(g.rootPostId)}')">보이는 두 링크 승인</button><button onclick="act('reject','${esc(g.rootPostId)}')">제외</button></article>`).join(''):'<p>대기 중인 후쿠오카 답글이 없습니다.</p>';
 window.groups=d.groups;
 }catch(e){document.querySelector('#list').textContent=e.message}
}
async function act(action,id){try{await call(action,id);await load()}catch(e){alert(e.message)}}
async function approve(id){const g=(window.groups||[]).find(x=>x.rootPostId===id);const links=g?.items.map(x=>x.source?.url);if(!g||g.items.length!==2||links.some(x=>!x)){alert('두 링크를 먼저 준비하세요.');return}if(!confirm('표시된 두 블로그 링크를 이 원글의 답글에 게시하도록 승인할까요?'))return;try{await call('approve',id,links);await load()}catch(e){alert(e.message)}}
</script></html>`;

export default async function(req){
  if(req.method==='GET')return new Response(page,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
  if(req.method!=='POST')return Response.json({error:'Method Not Allowed'},{status:405});
  const key=Netlify.env.get('THREADS_TEST_KEY');
  if(!key)return Response.json({error:'관리자 키가 설정되지 않았습니다.'},{status:503});
  let body;
  try{body=await req.json()}catch{return Response.json({error:'요청 형식 오류'},{status:400})}
  if(typeof body.key!=='string'||body.key!==key)return Response.json({error:'관리자 키가 올바르지 않습니다.'},{status:401});
  const store=getStore({name:'intl-flight-alert',consistency:'strong'});
  let queue=await store.get('threads-reply-queue',{type:'json'});
  queue=Array.isArray(queue)?queue:[];
  const eligible=x=>x.toCity==='FUK'&&['pending','awaiting_approval','approved','posted','needs_review','rejected'].includes(x.status);
  if(body.action==='list'){
    const ids=[...new Set(queue.filter(eligible).map(x=>x.rootPostId))].reverse().slice(0,30);
    return Response.json({groups:ids.map(id=>({rootPostId:id,cityName:'후쿠오카',items:queue.filter(x=>x.rootPostId===id&&x.toCity==='FUK').sort((a,b)=>a.stage-b.stage).map(x=>({stage:x.stage,status:x.status,source:x.source||null,error:x.error||null}))}))});
  }
  const items=queue.filter(x=>x.rootPostId===String(body.rootPostId||'')&&x.toCity==='FUK').sort((a,b)=>a.stage-b.stage);
  if(items.length!==2||items[0].stage!==1||items[1].stage!==2)return Response.json({error:'해당 원글의 답글 두 개를 찾지 못했습니다.'},{status:404});
  if(items.some(x=>['posting','posted','approved'].includes(x.status)))return Response.json({error:'이미 승인되었거나 게시 중인 답글은 변경할 수 없습니다.'},{status:409});
  if(body.action==='prepare'){
    let first,second;
    try{first=await selectReplyBlog(1,null);second=first&&await selectReplyBlog(2,first)}
    catch(e){return Response.json({error:String(e?.message||e)},{status:502})}
    if(!first||!second)return Response.json({error:'두 개의 적합한 개인 후기 링크를 찾지 못했습니다.'},{status:422});
    items[0].source=first;items[1].source=second;
    for(const item of items){item.status='awaiting_approval';delete item.error}
  }else if(body.action==='approve'){
    const links=body.links;
    if(!Array.isArray(links)||links.length!==2||items.some((x,i)=>x.status!=='awaiting_approval'||!x.source?.url||x.source.url!==links[i]))
      return Response.json({error:'화면에 표시된 링크가 현재 승인 대기 링크와 다릅니다. 새로고침 후 확인하세요.'},{status:409});
    for(const item of items){item.status='approved';item.approvedAt=new Date().toISOString()}
  }else if(body.action==='reject'){
    for(const item of items){item.status='rejected';item.rejectedAt=new Date().toISOString()}
  }else return Response.json({error:'알 수 없는 작업'},{status:400});
  await store.setJSON('threads-reply-queue',queue.slice(-300));
  return Response.json({ok:true,action:body.action});
}
export const config={path:'/api/threads-reply-approval'};
