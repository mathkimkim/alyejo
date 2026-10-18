import { fixedOrigin } from '../../lib/publisher.mjs';
export default async (_req, context) => {
  if (context.deploy.context !== 'production' || Netlify.env.get('JISU_SCHEDULE_ENABLED') !== 'true') return;
  const key = Netlify.env.get('JISU_PUBLISH_ADMIN_KEY');
  if (!key) return;
  const result = await fetch(`${fixedOrigin}/api/run-due`, { method: 'POST', headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10000) });
  if (!result.ok) throw new Error(`Dispatch failed: ${result.status}`);
};
// Five-minute dispatch; per-post timestamps carry an explicit timezone.
export const config = { schedule: '*/5 * * * *' };
