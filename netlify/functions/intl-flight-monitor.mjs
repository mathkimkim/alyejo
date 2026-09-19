import { getStore } from '@netlify/blobs';
import webpush from 'web-push';
import { discoverMrt } from './_intl-flight-lib.mjs';

const store = getStore({ name: 'intl-flight-alert', consistency: 'strong' });

export default async () => {
  const w = await store.get('watch', { type: 'json' });
  if (!w?.enabled || !w.subscription || w.mode !== 'discover') return;

  const pub = Netlify.env.get('VAPID_PUBLIC_KEY');
  const priv = Netlify.env.get('VAPID_PRIVATE_KEY');
  const subject = Netlify.env.get('VAPID_SUBJECT') || 'mailto:owner@example.com';
  if (!pub || !priv) return;

  try {
    const result = await discoverMrt({
      dep:w.dep,
      period:w.period,
      region:w.region,
      targetPrice:w.targetPrice,
      departureDate:w.departureDate
    });

    const previous = w.prices || {};
    const fresh = result.rows.filter(x => !previous[x.key]);

    if (fresh.length) {
      webpush.setVapidDetails(subject, pub, priv);
      const best = [...fresh].sort((a,b)=>a.totalPrice-b.totalPrice)[0];
      const more = fresh.length > 1 ? ` 외 ${fresh.length-1}곳` : '';

      await webpush.sendNotification(w.subscription, JSON.stringify({
        title: '✈️ 새 해외 특가 발견',
        body: `${best.cityName || best.toCity} · ${best.departureDate}~${best.returnDate} · ${best.totalPrice.toLocaleString('ko-KR')}원${more}`,
        url: '/intl-flight/'
      }));
    }

    w.prices = Object.fromEntries(result.rows.map(x=>[x.key,x.totalPrice]));
    w.lastFares = result.rows;
    w.updatedAt = new Date().toISOString();
    await store.setJSON('watch', w);
  } catch (e) {
    console.error('intl-flight-monitor', e);
  }
};

export const config = { schedule: '0 * * * *' };
