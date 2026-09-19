import { getStore } from '@netlify/blobs';
import { searchMrt } from './_intl-flight-lib.mjs';

const store = getStore({ name: 'intl-flight-alert', consistency: 'strong' });

export default async (req) => {
  try {
    if (req.method === 'GET') {
      const v = await store.get('watch', { type: 'json' });
      return Response.json(v || { enabled: false });
    }

    if (req.method === 'DELETE') {
      await store.delete('watch');
      return Response.json({ ok: true, enabled: false });
    }

    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

    const body = await req.json();
    const targetPrice = Math.max(1, Number(body.targetPrice || 0));
    if (!body.subscription?.endpoint) return Response.json({ error: '푸시 구독 정보가 없습니다.' }, { status: 400 });

    const result = await searchMrt({
      dep: body.dep,
      arr: body.arr,
      start: body.start,
      end: body.end,
      period: body.period
    });

    const prices = Object.fromEntries(result.rows.map(x => [x.key, x.totalPrice]));

    const value = {
      enabled: true,
      dep: String(body.dep || '').toUpperCase(),
      arr: String(body.arr || '').toUpperCase(),
      start: body.start,
      end: body.end,
      period: Number(body.period),
      targetPrice,
      subscription: body.subscription,
      prices,
      lastFares: result.rows,
      updatedAt: new Date().toISOString()
    };

    await store.setJSON('watch', value);

    const qualifying = result.rows.filter(x => x.totalPrice > 0 && x.totalPrice <= targetPrice);

    return Response.json({
      ok: true,
      enabled: true,
      count: result.rows.length,
      qualifyingCount: qualifying.length,
      cached: result.cached
    });
  } catch (e) {
    return Response.json({ error: String(e?.message || e) }, { status: 400 });
  }
};

export const config = { path: '/api/intl-flight-watch' };
