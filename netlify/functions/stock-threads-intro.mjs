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

const STORE_KEY = 'joosik_together-intro-v1';

export default async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method Not Allowed' }, { status: 405 });
  }

  const key = Netlify.env.get('STOCK_POST_ADMIN_KEY');
  if (!key || req.headers.get('authorization') !== `Bearer ${key}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = Netlify.env.get('THREADS_STOCK_ACCESS_TOKEN');
  if (!token) {
    return Response.json({ error: 'Stock Threads token is missing' }, { status: 503 });
  }

  const store = getStore({ name: 'stock-social-posts', consistency: 'strong' });
  const previous = await store.get(STORE_KEY, { type: 'json' });
  if (previous?.id) {
    return Response.json({ ok: true, alreadyPublished: true, id: previous.id });
  }

  const meResponse = await fetch('https://graph.threads.net/v1.0/me?fields=id,username', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const me = await meResponse.json().catch(() => ({}));
  if (!meResponse.ok || me.username?.toLowerCase() !== 'joosik_together') {
    return Response.json({ error: 'Threads token is not for @joosik_together' }, { status: 409 });
  }

  const response = await fetch('https://graph.threads.net/v1.0/me/threads', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({ media_type: 'TEXT', text: INTRO, auto_publish_text: 'true' })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.id) {
    console.error('stock-threads-intro', response.status, result?.error?.code);
    return Response.json({ error: result?.error?.message || 'Threads publish failed' }, { status: 502 });
  }

  await store.setJSON(STORE_KEY, { id: result.id, username: me.username, publishedAt: new Date().toISOString() });
  return Response.json({ ok: true, id: result.id, username: me.username });
};

export const config = { path: '/api/stock-threads-intro' };
