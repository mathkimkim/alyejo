import { getStore } from '@netlify/blobs';

const store = () => getStore({ name: 'alryeok-route', consistency: 'strong' });

export default async (req) => {
  if (req.method === 'GET') {
    const value = await store().get('active', { type: 'json' });
    return Response.json(value || { enabled: false });
  }
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  const body = await req.json();
  if (!body?.route?.origin?.lat || !body?.route?.dest?.lat || !body?.subscription?.endpoint) {
    return Response.json({ error: 'route와 subscription이 필요합니다.' }, { status: 400 });
  }
  await store().setJSON('active', { enabled: true, route: body.route, subscription: body.subscription, updatedAt: new Date().toISOString() });
  return Response.json({ ok: true });
};

export const config = { path: '/api/route', method: ['GET', 'POST'] };
