import { posts, username } from './posts.mjs';
export const fixedOrigin = 'https://jisu-social-publisher.netlify.app';
export function authorize(req, key) {
  return Boolean(key && req.headers.get('authorization') === `Bearer ${key}`);
}
export function makeAPI(token, fetcher = fetch) {
  return async (path, params, method = 'GET') => {
    const url = new URL(`https://graph.threads.net/v1.0/${path}`);
    if (method === 'GET' && params) url.search = new URLSearchParams(params).toString();
    const response = await fetcher(url, { method, headers: { Authorization: `Bearer ${token}`, ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) }, ...(method === 'POST' ? { body: new URLSearchParams(params) } : {}), signal: AbortSignal.timeout(5000) });
    const data = await response.json().catch(() => ({}));
    // Never return provider error messages, which may contain sensitive values.
    if (!response.ok || data.error) throw new Error(`Threads API failed (${response.status}, code ${data.error?.code ?? 'unknown'})`);
    return data;
  };
}
export async function connection(api) {
  const me = await api('me', { fields: 'id,username' });
  if (me.username?.toLowerCase() !== username) throw new Error('연결된 Threads 계정이 jisu__jisu65가 아닙니다.');
  const permissions = await api('me/permissions');
  const granted = (permissions.data ?? []).filter(p => p.status === 'granted').map(p => p.permission);
  if (!granted.includes('threads_basic') || !granted.includes('threads_content_publish')) throw new Error('Threads 기본 정보 또는 게시 권한이 없습니다.');
  return { id: me.id, username: me.username, granted };
}
export async function publish({ id, api, store, pause = ms => new Promise(r => setTimeout(r, ms)), now = () => new Date().toISOString() }) {
  const post = posts.find(p => p.id === id);
  if (!post) throw new Error('등록되지 않은 게시물입니다.');
  const me = await connection(api);
  const previous = await store.get(`result/${id}`, { type: 'json' });
  if (previous?.status === 'published') return { ...previous, alreadyPublished: true };
  // A permanent one-shot claim prevents retrying uncertain publish requests.
  const claim = await store.setJSON(`claim/${id}`, { startedAt: now() }, { onlyIfNew: true });
  if (!claim.modified) throw new Error('이미 실행한 게시물입니다. 게시 기록을 확인해 주세요.');
  let containerId;
  let phase = 'creating';
  try {
    const created = await api(`${me.id}/threads`, { media_type: 'IMAGE', image_url: fixedOrigin + post.image, text: post.text, alt_text: post.alt }, 'POST');
    if (!created.id) throw new Error('이미지 컨테이너 생성 결과가 없습니다.');
    containerId = created.id;
    await store.setJSON(`result/${id}`, { status: 'processing', containerId, startedAt: now() });
    let ready = false;
    for (let i = 0; i < 4; i++) {
      const state = await api(containerId, { fields: 'status' });
      if (state.status === 'FINISHED') { ready = true; break; }
      if (['ERROR', 'EXPIRED', 'PUBLISHED'].includes(state.status)) throw new Error(`이미지 처리 상태: ${state.status}`);
      await pause(1500);
    }
    if (!ready) throw new Error('이미지 처리 대기 시간이 초과되었습니다.');
    phase = 'publishing';
    await store.setJSON(`result/${id}`, { status: 'publishing', containerId, updatedAt: now() });
    const result = await api(`${me.id}/threads_publish`, { creation_id: containerId }, 'POST');
    if (!result.id) throw new Error('게시 결과를 확인할 수 없습니다.');
    const saved = { status: 'published', id: result.id, containerId, username: me.username, publishedAt: now() };
    await store.setJSON(`result/${id}`, saved);
    return saved;
  } catch (error) {
    await store.setJSON(`result/${id}`, { status: phase === 'publishing' ? 'needs-review' : 'failed', containerId, updatedAt: now(), error: error.message });
    throw error;
  }
}
