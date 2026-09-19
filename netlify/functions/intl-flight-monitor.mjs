import { getStore } from '@netlify/blobs';
import webpush from 'web-push';
import { searchMrt } from './_intl-flight-lib.mjs';

const store = getStore({ name: 'intl-flight-alert', consistency: 'strong' });

export default async () => {
  const w = await store.get('watch', { type: 'json' });
  if (!w?.enabled || !w.subscription) return;

  const pub = Netlify.env.get('VAPID_PUBLIC_KEY');
  const priv = Netlify.env.get('VAPID_PRIVATE_KEY');
  const subject = Netlify.env.get('VAPID_SUBJECT') || 'mailto:owner@example.com';
  if (!pub || !priv) return;

  try {
    const result = await searchMrt({
      dep: w.dep,
      arr: w.arr,
      start: w.start,
      end: w.end,
      period: w.period
    });

    const previous = w.prices || {};
    const target = Number(w.targetPrice || 0);

    const newlyQualified = result.rows.filter(x => {
      const old = Number(previous[x.key] || 0);
      return x.totalPrice > 0 && x.totalPrice <= target && (old === 0 || old > target);
    });

    if (newlyQualified.length) {
      webpush.setVapidDetails(subject, pub, priv);
      const best = [...newlyQualified].sort((a,b) => a.totalPrice - b.totalPrice)[0];
      const more = newlyQualified.length > 1 ? ` 외 ${newlyQualified.length - 1}건` : '';
      await webpush.sendNotification(w.subscription, JSON.stringify({
        title: '✈️ 국제선 목표가 도달',
        body: `${w.dep}→${w.arr} ${best.departureDate}~${best.returnDate} · ${best.totalPrice.toLocaleString('ko-KR')}원 · ${best.airline || '항공사 미표시'}${more}`,
        url: '/intl-flight/'
      }));
    }

    w.prices = Object.fromEntries(result.rows.map(x => [x.key, x.totalPrice]));
    w.lastFares = result.rows;
    w.updatedAt = new Date().toISOString();
    await store.setJSON('watch', w);
  } catch (e) {
    console.error('intl-flight-monitor', e);
  }
};

export const config = { schedule: '0 * * * *' };
