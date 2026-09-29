import { getStore } from '@netlify/blobs';

export default async (req, context) => {
  const index = context.params.index;
  if (!['1', '2'].includes(index)) return new Response('Not found', { status: 404 });
  const store = getStore({ name: 'stock-social-media', consistency: 'strong' });
  const name = `intro-${index}.jpeg`;
  if (req.method === 'POST' || req.method === 'DELETE') {
    const key = Netlify.env.get('STOCK_POST_ADMIN_KEY');
    if (!key || req.headers.get('authorization') !== `Bearer ${key}`) return new Response('Unauthorized', { status: 401 });
    if (req.method === 'DELETE') {
      await store.delete(name);
      return Response.json({ ok: true, deleted: index });
    }
    const bytes = new Uint8Array(await req.arrayBuffer());
    if (bytes.length < 100 || bytes.length > 5_000_000 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return new Response('Invalid JPEG', { status: 400 });
    await store.set(name, bytes);
    return Response.json({ ok: true, index, bytes: bytes.length });
  }
  if (req.method !== 'GET') return new Response('Method Not Allowed', { status: 405 });
  const bytes = await store.get(name, { type: 'arrayBuffer' });
  if (!bytes) return new Response('Not found', { status: 404 });
  return new Response(bytes, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=3600' } });
};

export const config = { path: '/api/stock-intro-image/:index' };
