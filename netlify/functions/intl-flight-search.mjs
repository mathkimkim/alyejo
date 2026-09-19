import { searchMrt } from './_intl-flight-lib.mjs';

export default async (req) => {
  try {
    const u = new URL(req.url);
    const params = {
      dep: u.searchParams.get('dep'),
      arr: u.searchParams.get('arr'),
      start: u.searchParams.get('start'),
      end: u.searchParams.get('end'),
      period: u.searchParams.get('period')
    };
    const result = await searchMrt(params);
    return Response.json({
      route: params.dep + '-' + params.arr,
      ...params,
      count: result.rows.length,
      cached: result.cached,
      cachedAt: result.cachedAt,
      fares: result.rows
    });
  } catch (e) {
    return Response.json({ error: String(e?.message || e) }, { status: 400 });
  }
};

export const config = { path: '/api/intl-flight-search' };
