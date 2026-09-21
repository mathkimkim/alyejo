export default async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method Not Allowed' }, { status: 405 });
  }

  const accessToken = Netlify.env.get('THREADS_ACCESS_TOKEN');
  const testKey = Netlify.env.get('THREADS_TEST_KEY');

  if (!accessToken) {
    return Response.json({ error: 'THREADS_ACCESS_TOKEN이 설정되지 않았습니다.' }, { status: 500 });
  }
  if (!testKey) {
    return Response.json({ error: 'THREADS_TEST_KEY가 설정되지 않았습니다.' }, { status: 500 });
  }

  let body = {};
  try {
    body = await req.json();
  } catch {}

  if (!body.key || body.key !== testKey) {
    return Response.json({ error: '관리자 테스트 키가 올바르지 않습니다.' }, { status: 401 });
  }

  const text = '✈️ 항공권알려줘 Threads 자동게시 연결 테스트입니다.\n\n최저가 항공권 알림을 Threads에서도 알려드릴 예정입니다.';

  const params = new URLSearchParams({
    media_type: 'TEXT',
    text,
    auto_publish_text: 'true'
  });

  const response = await fetch('https://graph.threads.net/v1.0/me/threads', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error('threads-test-post', response.status, result);
    return Response.json({
      error: result?.error?.message || 'Threads 게시에 실패했습니다.',
      code: result?.error?.code || null
    }, { status: 502 });
  }

  return Response.json({ ok: true, id: result.id || null });
};

export const config = {
  path: '/api/threads-test-post'
};
