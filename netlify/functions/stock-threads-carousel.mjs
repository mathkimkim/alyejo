import { getStore } from '@netlify/blobs';

const INTRO = `3,000만 원으로 시작해 1억까지 1년 반.

이제 목표는 2억.
그다음은 10억.

저는 매일 사고파는 사람이 아닙니다.
평소엔 현금을 모으고 오래 기다립니다.
그러다 기회가 오면, 망설이지 않고 쏩니다. 🎯

이 계정에는 그 기다림과 매매 결과를 실제 숫자로 기록하려고 합니다.

2억까지 며칠 걸릴까요?
오늘부터 기록해보겠습니다.`;

const api = async (path, token, params, method = 'POST') => {
  const response = await fetch(`https://graph.threads.net/v1.0/${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    ...(params ? { body: new URLSearchParams(params) } : {})
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || (method === 'POST' && !data.id)) throw new Error(data?.error?.message || `Threads API ${response.status}`);
  return data;
};

export default async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'Method Not Allowed' }, { status: 405 });
  const key = Netlify.env.get('STOCK_POST_ADMIN_KEY');
  if (!key || req.headers.get('authorization') !== `Bearer ${key}`) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const token = Netlify.env.get('THREADS_STOCK_ACCESS_TOKEN');
  if (!token) return Response.json({ error: 'Missing stock token' }, { status: 503 });
  const store = getStore({ name: 'stock-social-posts', consistency: 'strong' });
  const previous = await store.get('joosik_together-intro-v2', { type: 'json' });
  if (previous?.id) return Response.json({ ok: true, alreadyPublished: true, ...previous });
  const media = getStore({ name: 'stock-social-media', consistency: 'strong' });
  for (const n of ['1', '2']) if (!(await media.get(`intro-${n}.jpeg`))) return Response.json({ error: `Missing image ${n}` }, { status: 409 });
  const meResponse = await fetch('https://graph.threads.net/v1.0/me?fields=id,username', { headers: { Authorization: `Bearer ${token}` } });
  const me = await meResponse.json().catch(() => ({}));
  if (!meResponse.ok || me.username?.toLowerCase() !== 'joosik_together') return Response.json({ error: 'Wrong Threads account' }, { status: 409 });
  try {
    const origin = new URL(req.url).origin;
    const children = [];
    for (const [n, alt] of [['1', '계좌 평가 현황: DIA와 SGOV 보유 화면'], ['2', '계좌 평가 현황: MSFT와 SGOV 보유 화면']]) {
      const child = await api('me/threads', token, { media_type: 'IMAGE', image_url: `${origin}/api/stock-intro-image/${n}`, is_carousel_item: 'true', alt_text: alt });
      children.push(child.id);
    }
    const parent = await api('me/threads', token, { media_type: 'CAROUSEL', children: children.join(','), text: INTRO });
    await store.setJSON('joosik_together-intro-v2-container', { id: parent.id, children });
    let result;
    for (let attempt = 0; attempt < 3; attempt++) {
      try { result = await api('me/threads_publish', token, { creation_id: parent.id }); break; }
      catch (error) { if (attempt === 2) throw error; await new Promise(resolve => setTimeout(resolve, 2500)); }
    }
    await store.setJSON('joosik_together-intro-v2', { id: result.id, username: me.username, publishedAt: new Date().toISOString() });
    return Response.json({ ok: true, id: result.id, username: me.username });
  } catch (error) {
    console.error('stock carousel publish', error.message);
    return Response.json({ error: error.message }, { status: 502 });
  }
};

export const config = { path: '/api/stock-threads-carousel' };
