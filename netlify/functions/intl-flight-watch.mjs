import { getStore } from '@netlify/blobs';
import { discoverMrt } from './_intl-flight-lib.mjs';

const store = getStore({ name: 'intl-flight-alert', consistency: 'strong' });

function bestMap(rows) {
  return Object.fromEntries(rows.map(x => [x.toCity, {
    price: x.totalPrice,
    key: x.key,
    departureDate: x.departureDate,
    returnDate: x.returnDate,
    cityName: x.cityName || x.toCity
  }]));
}

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
    if (!body.subscription?.endpoint) return Response.json({ error: '푸시 구독 정보가 없습니다.' }, { status: 400 });

    const targetPrice = Math.max(1, Number(body.targetPrice || 0));
    const dep = String(body.dep || 'ICN').toUpperCase();
    const period = Number(body.period || 5);
    const region = body.region || 'all';
    const departureDate = body.departureDate;

    const result = await discoverMrt({ dep, period, region, targetPrice, departureDate });

    const value = {
      enabled: true,
      mode: 'discover',
      dep,
      period,
      region,
      departureDate,
      targetPrice,
      subscription: body.subscription,
      bestByDestination: bestMap(result.rows),
      lastFares: result.rows,
      updatedAt: new Date().toISOString()
    };

    await store.setJSON('watch', value);

    return Response.json({
      ok:true,
      enabled:true,
      count:result.rows.length,
      windowStart:result.windowStart,
      windowEnd:result.windowEnd,
      cached:result.cached
    });
  } catch (e) {
    return Response.json({ error: String(e?.message || e) }, { status: 400 });
  }
};

export const config = { path: '/api/intl-flight-watch' };
