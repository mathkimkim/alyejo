import { getStore } from '@netlify/blobs';
import webpush from 'web-push';
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

    const previous = w.bestByDestination || {};
    const current = bestMap(result.rows);

    const alerts = result.rows.filter(x => {
      const old = previous[x.toCity];
      if (!old) return true;
      if (x.totalPrice < Number(old.price || 0)) return true;
      if (x.key !== old.key && x.totalPrice <= Number(old.price || 0)) return true;
      return false;
    });

    if (alerts.length) {
      webpush.setVapidDetails(subject, pub, priv);
      const best = [...alerts].sort((a,b)=>a.totalPrice-b.totalPrice)[0];
      const old = previous[best.toCity];
      const priceDrop = old?.price && best.totalPrice < old.price
        ? ` · ${Number(old.price).toLocaleString('ko-KR')}원→${best.totalPrice.toLocaleString('ko-KR')}원`
        : '';
      const more = alerts.length > 1 ? ` 외 ${alerts.length-1}곳` : '';

      await webpush.sendNotification(w.subscription, JSON.stringify({
        title: old ? '✈️ 더 싼 해외 특가 발견' : '✈️ 새 해외 특가 발견',
        body: `${best.cityName || best.toCity} · ${best.departureDate}~${best.returnDate} · ${best.totalPrice.toLocaleString('ko-KR')}원${priceDrop}${more}`,
        url: '/intl-flight/'
      }));
    }

    w.bestByDestination = current;
    w.lastFares = result.rows;
    w.updatedAt = new Date().toISOString();
    await store.setJSON('watch', w);
  } catch (e) {
    console.error('intl-flight-monitor', e);
  }
};

export const config = { schedule: '0 * * * *' };
