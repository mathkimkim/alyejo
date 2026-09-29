import { getStore } from '@netlify/blobs';

const GRAPH = 'https://graph.instagram.com/v26.0';
const STORE = 'stock-instagram-posts';

async function graph(path, token, fields) {
  const response = await fetch(`${GRAPH}/${path}`, {
    method: fields ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}`, ...(fields ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
    ...(fields ? { body: new URLSearchParams(fields) } : {})
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || (fields && !data.id)) throw new Error(data?.error?.message || `Instagram API ${response.status}`);
  return data;
}

export default async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'Method Not Allowed' }, { status: 405 });
  const key = Netlify.env.get('STOCK_POST_ADMIN_KEY');
  if (!key || req.headers.get('authorization') !== `Bearer ${key}`) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const token = Netlify.env.get('STOCK_INSTAGRAM_ACCESS_TOKEN');
  const igUserId = Netlify.env.get('STOCK_INSTAGRAM_USER_ID');
  if (!token || !igUserId) return Response.json({ error: 'Stock Instagram connection is not configured' }, { status: 503 });

  const { draftId, caption, imageUrls, approved } = await req.json().catch(() => ({}));
  if (approved !== true || !/^[a-zA-Z0-9_-]{8,80}$/.test(draftId || '') ||
      typeof caption !== 'string' || !caption.trim() || caption.length > 2200 ||
      !Array.isArray(imageUrls) || imageUrls.length < 1 || imageUrls.length > 10 ||
      imageUrls.some(url => {
        try { const parsed = new URL(url); return parsed.protocol !== 'https:' || !!parsed.username || !!parsed.password; }
        catch { return true; }
      })) return Response.json({ error: 'Approved draft with caption and 1–10 HTTPS images required' }, { status: 400 });

  const store = getStore({ name: STORE, consistency: 'strong' });
  const state = await store.get(draftId, { type: 'json' });
  if (state?.status === 'posted') return Response.json({ ok: true, alreadyPublished: true, id: state.id });
  if (state) return Response.json({ error: 'Previous attempt needs review before retrying', state: state.status }, { status: 409 });

  const me = await graph('me?fields=id,username', token);
  if (String(me.id) !== igUserId || me.username?.toLowerCase() !== 'joosik__together') {
    return Response.json({ error: 'Instagram token is not for @joosik__together' }, { status: 409 });
  }

  // Claim before the external call; uncertain outcomes must be reviewed to avoid duplicates.
  await store.setJSON(draftId, { status: 'posting', startedAt: new Date().toISOString(), username: me.username });
  try {
    let container;
    if (imageUrls.length > 1) {
      const ids = [];
      for (const imageUrl of imageUrls) {
        const item = await graph(`${igUserId}/media`, token, { image_url: imageUrl, is_carousel_item: 'true' });
        ids.push(item.id);
      }
      container = await graph(`${igUserId}/media`, token, { media_type: 'CAROUSEL', children: ids.join(','), caption: caption.trim() });
    } else {
      container = await graph(`${igUserId}/media`, token, { image_url: imageUrls[0], caption: caption.trim() });
    }
    await store.setJSON(draftId, { status: 'posting', creationId: container.id, username: me.username });

    let status;
    for (let attempt = 0; attempt < 5; attempt++) {
      status = await graph(`${container.id}?fields=status_code`, token);
      if (status.status_code === 'FINISHED') break;
      if (status.status_code === 'ERROR' || status.status_code === 'EXPIRED') throw new Error(`Media processing ${status.status_code}`);
      await new Promise(resolve => setTimeout(resolve, 2500));
    }
    if (status.status_code !== 'FINISHED') throw new Error('Media processing not finished');
    const result = await graph(`${igUserId}/media_publish`, token, { creation_id: container.id });
    await store.setJSON(draftId, { status: 'posted', id: result.id, publishedAt: new Date().toISOString(), username: me.username });
    return Response.json({ ok: true, id: result.id, username: me.username });
  } catch (error) {
    const current = await store.get(draftId, { type: 'json' });
    await store.setJSON(draftId, { ...current, status: 'needs_review', error: String(error.message).slice(0, 300) });
    return Response.json({ error: error.message, state: 'needs_review' }, { status: 502 });
  }
};

export const config = { path: '/api/stock-instagram-publish' };
