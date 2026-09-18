import { getStore } from '@netlify/blobs';

const store = () => getStore({ name: 'alryeok-route', consistency: 'strong' });

export default async (req) => {
  if (req.method === 'GET') {
    const value = await store().get('active', { type: 'json' });
    if (!value) return Response.json({ enabled: false, routes: [] });
    // 이전 단일 경로 저장 형식도 클라이언트가 계속 읽을 수 있게 배열로 정규화합니다.
    return Response.json({ ...value, routes: Array.isArray(value.routes) ? value.routes : (value.route ? [value.route] : []) });
  }
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  const body = await req.json();
  const routes = Array.isArray(body?.routes) ? body.routes : (body?.route ? [body.route] : []);
  if (!routes.length || routes.some(route => !route?.origin?.lat || !route?.dest?.lat) || !body?.subscription?.endpoint) {
    return Response.json({ error: 'routes와 subscription이 필요합니다.' }, { status: 400 });
  }
  await store().setJSON('active', { enabled: true, routes, route: routes[0], subscription: body.subscription, updatedAt: new Date().toISOString() });
  return Response.json({ ok: true, count: routes.length });
};

export const config = { path: '/api/route', method: ['GET', 'POST'] };
