import test from 'node:test';
import assert from 'node:assert/strict';
import { authorize, publish } from '../lib/publisher.mjs';
const id = 'golf-window-v1';
function fixture({ username = 'jisu__jisu65', failPublish = false, mediaStatus = 'FINISHED', granted = true } = {}) {
  const data = new Map(); const calls = [];
  const store = {
    async get(k) { return data.get(k) ?? null; },
    async setJSON(k, v, opts = {}) { if (opts.onlyIfNew && data.has(k)) return { modified: false }; data.set(k, v); return { modified: true }; }
  };
  const api = async (path, params, method) => {
    calls.push({ path, params, method });
    if (path === 'me') return { id: 'user1', username };
    if (path === 'me/permissions') return { data: (granted ? ['threads_basic', 'threads_content_publish'] : ['threads_basic']).map(permission => ({ permission, status: 'granted' })) };
    if (path === 'user1/threads') return { id: 'container1' };
    if (path === 'container1') return { status: mediaStatus };
    if (path === 'user1/threads_publish') { if (failPublish) throw new Error('Network unavailable'); return { id: 'post1' }; }
    throw new Error('Unexpected API request');
  };
  return { api, store, data, calls, pause: async () => {} };
}
test('all controls require a configured admin secret', () => {
  assert.equal(authorize(new Request('https://example.com'), undefined), false);
  assert.equal(authorize(new Request('https://example.com', { headers: { authorization: 'Bearer good' } }), 'good'), true);
});
test('wrong account or missing publish permission cannot create media', async () => {
  for (const opts of [{ username: 'another_account' }, { granted: false }]) {
    const f = fixture(opts); await assert.rejects(publish({ id, ...f }));
    assert.equal(f.calls.some(c => c.method === 'POST'), false);
  }
});
test('concurrent requests publish once; subsequent request returns saved result', async () => {
  const f = fixture(); const results = await Promise.allSettled([publish({ id, ...f }), publish({ id, ...f })]);
  assert.equal(results.filter(x => x.status === 'fulfilled').length, 1);
  assert.equal(f.calls.filter(c => c.path === 'user1/threads_publish').length, 1);
  assert.equal((await publish({ id, ...f })).alreadyPublished, true);
  assert.equal(f.calls.filter(c => c.path === 'user1/threads_publish').length, 1);
});
test('uncertain publish response never causes automatic re-publication', async () => {
  const f = fixture({ failPublish: true }); await assert.rejects(publish({ id, ...f }));
  assert.equal(f.data.get(`result/${id}`).status, 'needs-review');
  await assert.rejects(publish({ id, ...f }));
  assert.equal(f.calls.filter(c => c.path === 'user1/threads_publish').length, 1);
});
test('failed media processing never publishes', async () => {
  const f = fixture({ mediaStatus: 'ERROR' }); await assert.rejects(publish({ id, ...f }));
  assert.equal(f.calls.some(c => c.path === 'user1/threads_publish'), false);
});
