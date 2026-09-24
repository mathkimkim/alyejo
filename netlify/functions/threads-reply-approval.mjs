import { getStore } from '@netlify/blobs';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { selectReplyBlog } from './_naver-reply-link.mjs';

const page="<!doctype html><html lang=\"ko\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>항공권 답글 승인</title>\n<style>\n:root{font-family:system-ui,-apple-system,sans-serif;color:#17253d;background:#f4f7fb}*{box-sizing:border-box}[hidden]{display:none!important}body{max-width:980px;margin:0 auto;padding:20px}h1{font-size:1.7rem;margin:16px 0 4px}h2{font-size:1.2rem}p{line-height:1.55}a{color:#075bb2;overflow-wrap:anywhere}.muted{color:#64748b}.bar,.card,.reply{background:white;border:1px solid #dce4ef;border-radius:14px;padding:18px;margin:14px 0}.bar{display:flex;align-items:end;gap:10px;flex-wrap:wrap}label{display:grid;gap:5px;flex:1;min-width:230px}input{padding:11px;border:1px solid #afbdd0;border-radius:8px;font:inherit}button{font:inherit;border:0;border-radius:8px;padding:11px 15px;background:#e5eaf2;color:#17253d;cursor:pointer}button.primary{background:#0862ba;color:white}button:disabled{opacity:.45;cursor:not-allowed}.actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:18px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.reply{margin:0;background:#fbfcff}.reply h3{margin:0 0 10px}.reply blockquote{white-space:pre-wrap;overflow-wrap:anywhere;background:#f0f5fc;border-left:4px solid #2584d7;margin:14px 0;padding:12px}.snippet{background:#f4f7fb;padding:10px;border-radius:8px}.badge{display:inline-block;background:#e8eff8;padding:4px 10px;border-radius:30px;font-size:.9rem}.empty{padding:28px;text-align:center;background:white;border-radius:14px}details{margin:16px 0}summary{cursor:pointer;font-weight:700}@media(max-width:670px){.grid{grid-template-columns:1fr}body{padding:14px}}\n</style></head><body>\n<h1>항공권 답글 승인</h1><p class=\"muted\">모든 목적지 원글의 1차·2차 답글을 미리 확인하고 승인하세요. 승인 전에는 게시되지 않습니다.</p>\n<div class=\"bar\" id=\"loginBar\"><label>처음 한 번만 관리자 인증<input id=\"key\" type=\"password\" autocomplete=\"off\" placeholder=\"기존 관리자 키\"></label><button id=\"login\" class=\"primary\">이 브라우저 인증</button></div><div class=\"bar\" id=\"sessionBar\" hidden><span>관리자 인증됨 · 이 브라우저에서 30일간 승인 가능</span><button id=\"load\">목록 새로고침</button><button id=\"logout\">로그아웃</button></div>\n<div id=\"notice\" role=\"status\"></div><h2>승인할 답글</h2><div id=\"pending\" class=\"empty\">처음 한 번 인증하면 이후 승인할 때는 키 입력이 필요 없습니다.</div>\n<details><summary>게시 완료·제외된 원글 보기</summary><div id=\"history\"></div></details>\n<script>\nvar groups=[];\nfunction esc(s){return String(s||'').replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c]})}\nfunction state(s){return ({pending:'승인 대기',awaiting_approval:'링크 확인 대기',approved:'승인 완료 · 게시 대기',posting:'게시 처리 중',posted:'게시 완료',needs_review:'확인 필요',rejected:'제외'})[s]||s}\nfunction safeUrl(s){try{var u=new URL(s);return u.protocol==='https:'&&u.hostname==='blog.naver.com'&&/^\\/[^/]+\\/\\d+$/.test(u.pathname)?u.href:''}catch(e){return ''}}\nfunction reply(item,city){\n var s=item.source,stage=Number(item.stage);\n var heading='✈️ '+city+(stage===1?' 숙소·이동 여행 후기':' 일정·먹거리 여행 후기');\n var msg=item.status==='posted'?'게시 완료된 답글입니다. 검색 결과 정보는 삭제했습니다.':s&&s.title?[heading,s.title,s.url].join('\\n'):'링크 준비/새로 찾기를 누르면 게시될 문구가 여기에 표시됩니다.';\n var url=s&&safeUrl(s.url);\n return '<div class=\"reply\"><h3>'+stage+'차 답글 <span class=\"badge\">'+esc(state(item.status))+'</span></h3>'+\n (s&&s.title?'<p><strong>'+esc(s.title)+'</strong><br><span class=\"muted\">'+esc(s.bloggerName)+' · '+esc(s.postDate)+'</span></p>'+\n (s.description?'<p class=\"snippet\">'+esc(s.description)+'</p>':'<p class=\"muted\">검색 요약이 제공되지 않았습니다.</p>')+\n (url?'<p><a href=\"'+esc(url)+'\" target=\"_blank\" rel=\"noopener noreferrer\">블로그 원문 열어보기 ↗</a></p>':''):'')+\n '<strong>'+(item.status==='posted'?'게시 결과':'Threads에 올라갈 답글')+'</strong><blockquote>'+esc(msg)+'</blockquote></div>';\n}\nfunction card(g,i,active){\n var items=g.items.slice().sort(function(a,b){return a.stage-b.stage});\n var remaining=items.filter(function(x){return x.status!=='posted'});\n var ready=items.length===2&&remaining.length>0&&remaining.every(function(x){return x.status==='awaiting_approval'&&x.source&&safeUrl(x.source.url)});\n var canPrepare=items.length===2&&remaining.length>0&&remaining.every(function(x){return ['pending','awaiting_approval','rejected'].includes(x.status)});\n var actions=active?'<div class=\"actions\"><button data-action=\"prepare\" data-index=\"'+i+'\" '+(canPrepare?'':'disabled')+'>링크 준비/새로 찾기</button><button class=\"primary\" data-action=\"approve\" data-index=\"'+i+'\" '+(ready?'':'disabled')+'>답글 승인</button><button data-action=\"reject\" data-index=\"'+i+'\" '+(canPrepare?'':'disabled')+'>이번 원글 제외</button></div>':'';\n return '<article class=\"card\"><h3>'+esc(g.cityName||g.toCity)+' 원글 <span class=\"muted\">#'+esc(g.rootPostId)+'</span></h3>'+\n (g.departureDate?'<p class=\"muted\">여행 '+esc(g.departureDate)+' ~ '+esc(g.returnDate||'')+'</p>':'')+\n '<div class=\"grid\">'+items.map(function(x){return reply(x,g.cityName||g.toCity)}).join('')+'</div>'+actions+'</article>';\n}\nasync function api(action,g,links){\n var r=await fetch(location.pathname,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:action==='login'?document.getElementById('key').value:undefined,action:action,rootPostId:g&&g.rootPostId,links:links})});\n var d=await r.json();if(!r.ok)throw Error(d.error||'요청 실패');return d;\n}\nfunction authUI(ok){document.getElementById('loginBar').hidden=ok;document.getElementById('sessionBar').hidden=!ok}\nasync function load(){\n var notice=document.getElementById('notice');notice.textContent='목록을 불러오는 중입니다.';\n try{\n  var d=await api('list');authUI(true);groups=d.groups;\n  var pending=[],history=[];\n  groups.forEach(function(g,i){var active=g.items.some(function(x){return ['pending','awaiting_approval','needs_review'].includes(x.status)});(active?pending:history).push(card(g,i,active))});\n  document.getElementById('pending').outerHTML='<div id=\"pending\">'+(pending.join('')||'<div class=\"empty\">현재 승인 대기 중인 답글이 없습니다. 새 항공권 원글이 올라오면 여기에 표시됩니다.</div>')+'</div>';\n  document.getElementById('history').innerHTML=history.join('')||'<p class=\"muted\">지난 원글이 없습니다.</p>';\n  notice.textContent='';\n }catch(e){authUI(false);notice.textContent=e.message}\n}\ndocument.getElementById('login').addEventListener('click',async function(){try{await api('login');document.getElementById('key').value='';await load()}catch(e){document.getElementById('notice').textContent=e.message}});\ndocument.getElementById('logout').addEventListener('click',async function(){try{await api('logout')}finally{authUI(false);groups=[];document.getElementById('pending').innerHTML='<div class=\"empty\">로그아웃했습니다.</div>';document.getElementById('history').innerHTML=''}});\ndocument.getElementById('load').addEventListener('click',load);\nload();\ndocument.addEventListener('click',async function(e){\n var btn=e.target.closest('button[data-action]');if(!btn)return;\n var g=groups[Number(btn.dataset.index)],action=btn.dataset.action;if(!g)return;\n var links=g.items.slice().sort(function(a,b){return a.stage-b.stage}).map(function(x){return x.source&&x.source.url});\n if(action==='approve'&&!confirm('미리보기의 블로그 링크를 이 원글의 미게시 답글에 사용하도록 승인할까요?'))return;\n if(action==='reject'&&!confirm('이 원글의 두 답글을 제외할까요?'))return;\n btn.disabled=true;\n try{await api(action,g,action==='approve'?links:undefined);await load()}catch(err){document.getElementById('notice').textContent=err.message;btn.disabled=false}\n});\n</script></body></html>";

export default async function(req){
  if(req.method==='GET')return new Response(page,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
  if(req.method!=='POST')return Response.json({error:'Method Not Allowed'},{status:405});
  const key=Netlify.env.get('THREADS_TEST_KEY');
  if(!key)return Response.json({error:'관리자 인증이 설정되지 않았습니다.'},{status:503});
  const origin=req.headers.get('origin');
  if(origin&&origin!==new URL(req.url).origin)return Response.json({error:'잘못된 요청 출처입니다.'},{status:403});
  let body;
  try{body=await req.json()}catch{return Response.json({error:'요청 형식 오류'},{status:400})}
  const cookieName='reply_admin_session';
  const sign=exp=>createHmac('sha256',key).update('reply-approval:'+exp).digest('hex');
  if(body.action==='login'){
    if(typeof body.key!=='string'||body.key!==key)return Response.json({error:'관리자 키가 올바르지 않습니다.'},{status:401});
    const exp=Date.now()+30*86400000;
    return Response.json({ok:true},{headers:{'Set-Cookie':cookieName+'='+exp+'.'+sign(exp)+'; Path=/api/threads-reply-approval; Max-Age=2592000; HttpOnly; Secure; SameSite=Strict','Cache-Control':'no-store'}});
  }
  const raw=(req.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1)||'';
  const [exp,signature]=raw.split('.');
  const expected=sign(exp||'');
  const valid=/^\d{13}$/.test(exp||'')&&Number(exp)>Date.now()&&/^[0-9a-f]{64}$/.test(signature||'')&&timingSafeEqual(Buffer.from(signature),Buffer.from(expected));
  if(!valid)return Response.json({error:'관리자 인증이 필요합니다. 처음 한 번만 기존 키를 입력하세요.'},{status:401});
  if(body.action==='logout')return Response.json({ok:true},{headers:{'Set-Cookie':cookieName+'=; Path=/api/threads-reply-approval; Max-Age=0; HttpOnly; Secure; SameSite=Strict'}});
  const store=getStore({name:'intl-flight-alert',consistency:'strong'});
  let queue=await store.get('threads-reply-queue',{type:'json'});
  queue=Array.isArray(queue)?queue:[];
  const eligible=x=>['pending','awaiting_approval','approved','posting','posted','needs_review','rejected'].includes(x.status);
  if(body.action==='list'){
    const ids=[...new Set(queue.filter(eligible).map(x=>x.rootPostId))].reverse().slice(0,30);
    return Response.json({groups:ids.map(id=>{
      const related=queue.filter(x=>x.rootPostId===id).sort((a,b)=>a.stage-b.stage);
      const first=related[0];
      return {rootPostId:id,toCity:first?.toCity||'',cityName:first?.cityName||first?.toCity||'',departureDate:first?.departureDate||'',returnDate:first?.returnDate||'',
        items:related.map(x=>({stage:x.stage,status:x.status,source:x.source||null,error:x.error||null}))};
    })});
  }
  const items=queue.filter(x=>x.rootPostId===String(body.rootPostId||'')).sort((a,b)=>a.stage-b.stage);
  if(items.length!==2||Number(items[0].stage)!==1||Number(items[1].stage)!==2)return Response.json({error:'해당 원글의 답글 두 개를 찾지 못했습니다.'},{status:404});
  const remaining=items.filter(x=>x.status!=='posted');
  if(!remaining.length||remaining.some(x=>['posting','approved','needs_review'].includes(x.status)))
    return Response.json({error:'이미 게시·승인되었거나 확인이 필요한 답글은 변경할 수 없습니다.'},{status:409});
  if(body.action==='prepare'){
    if(remaining.some(x=>!['pending','awaiting_approval','rejected'].includes(x.status)))
      return Response.json({error:'링크를 준비할 수 없는 상태입니다.'},{status:409});
    let first=items[0].status==='posted'?items[0].source:null,second=null;
    try{
      if(items[0].status!=='posted')first=await selectReplyBlog(1,null,items[0]);
      if(items[1].status!=='posted')second=await selectReplyBlog(2,first,items[1]);
    }catch(e){return Response.json({error:String(e?.message||e)},{status:502})}
    if((items[0].status!=='posted'&&!first)||(items[1].status!=='posted'&&!second))
      return Response.json({error:'목적지에 맞는 개인 후기 링크를 찾지 못했습니다. 이 답글은 계속 대기합니다.'},{status:422});
    if(items[0].status!=='posted')items[0].source=first;
    if(items[1].status!=='posted')items[1].source=second;
    for(const item of remaining){item.status='awaiting_approval';delete item.error}
  }else if(body.action==='approve'){
    const links=body.links;
    if(!Array.isArray(links)||links.length!==2||remaining.some(x=>x.status!=='awaiting_approval'||!x.source?.url||x.source.url!==links[Number(x.stage)-1]))
      return Response.json({error:'화면에 표시된 링크가 현재 승인 대기 링크와 다릅니다. 새로고침 후 확인하세요.'},{status:409});
    for(const item of remaining){item.source={url:item.source.url,title:item.source.title};item.status='approved';item.approvedAt=new Date().toISOString()}
  }else if(body.action==='reject'){
    if(remaining.some(x=>!['pending','awaiting_approval','rejected'].includes(x.status)))
      return Response.json({error:'제외할 수 없는 상태입니다.'},{status:409});
    for(const item of remaining){delete item.source;item.status='rejected';item.rejectedAt=new Date().toISOString()}
  }else return Response.json({error:'알 수 없는 작업'},{status:400});
  await store.setJSON('threads-reply-queue',queue.slice(-300));
  return Response.json({ok:true,action:body.action});
}
export const config={path:'/api/threads-reply-approval'};
