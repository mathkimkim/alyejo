import { getStore } from '@netlify/blobs';
import { authorize, makeAPI, connection, publish } from '../../lib/publisher.mjs';
import { posts } from '../../lib/posts.mjs';
export default async (req, context) => {
  const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
  if (!authorize(req, Netlify.env.get('JISU_PUBLISH_ADMIN_KEY'))) return json({ error: 'Unauthorized' }, 401);
  const token = Netlify.env.get('THREADS_JISU_ACCESS_TOKEN');
  if (!token) return json({ error: 'Threads 토큰이 설정되지 않았습니다.' }, 503);
  const store = getStore({ name: `jisu-posts-${context.deploy.context}`, consistency: 'strong' });
  const action = new URL(req.url).pathname.split('/').pop();
  try {
    const api = makeAPI(token);
    if (req.method === 'GET' && action === 'connection') return json({ ok: true, ...await connection(api) });
    if (req.method === 'GET' && action === 'posts') return json({ posts: await Promise.all(posts.map(async p => ({ ...p, result: await store.get(`result/${p.id}`, { type: 'json' }), schedule: await store.get(`schedule/${p.id}`, { type: 'json' }) }))) });
    if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405);
    if (context.deploy.context !== 'production') return json({ error: 'Production only' }, 409);
    const body = await req.json();
    const post = posts.find(p => p.id === body.id);
    if (!post) return json({ error: 'Unknown post' }, 400);
    if (action === 'publish') return json(await publish({ id: post.id, api, store }));
    if (action === 'schedule') {
      const at = new Date(body.at);
      if (!Number.isFinite(at.getTime()) || at.getTime() <= Date.now()) return json({ error: '미래의 게시 시간을 지정해 주세요.' }, 400);
      if (await store.get(`claim/${post.id}`)) return json({ error: '이미 실행한 게시물입니다.' }, 409);
      await connection(api);
      await store.setJSON(`schedule/${post.id}`, { at: at.toISOString(), enabled: body.enabled === true });
      return json({ ok: true, at: at.toISOString(), enabled: body.enabled === true });
    }
    return json({ error: 'Not Found' }, 404);
  } catch (error) { return json({ error: error.message }, 502); }
};
export const config = { path: ['/api/connection', '/api/posts', '/api/publish', '/api/schedule'] };
