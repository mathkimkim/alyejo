import { getStore } from '@netlify/blobs';
import { authorize, makeAPI, publish } from '../../lib/publisher.mjs';
import { posts } from '../../lib/posts.mjs';
export default async (req, context) => {
  if (!authorize(req, Netlify.env.get('JISU_PUBLISH_ADMIN_KEY'))) return;
  if (context.deploy.context !== 'production' || Netlify.env.get('JISU_SCHEDULE_ENABLED') !== 'true') return;
  const token = Netlify.env.get('THREADS_JISU_ACCESS_TOKEN');
  if (!token) return;
  const store = getStore({ name: 'jisu-posts-production', consistency: 'strong' });
  for (const post of posts) {
    const plan = await store.get(`schedule/${post.id}`, { type: 'json' });
    if (!plan?.enabled || !Number.isFinite(Date.parse(plan.at)) || Date.parse(plan.at) > Date.now()) continue;
    if (await store.get(`claim/${post.id}`)) continue;
    try { await publish({ id: post.id, api: makeAPI(token), store }); }
    catch { console.error('Scheduled publishing stopped; inspect authenticated post status', post.id); }
    break;
  }
};
export const config = { background: true, path: '/api/run-due' };
