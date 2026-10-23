import { request, collection, ApiError } from '../qdrant.js';
import { json } from '../utils.js';

export async function handleHealth(req, env, fetcher = fetch) {
  if (req.method !== 'GET') {
    throw new ApiError('Endpoint or method not found.', 404);
  }

  const base = '/collections/' + encodeURIComponent(collection(env));

  try {
    const c = await request(env, base, 'GET', undefined, fetcher);
    return json({
      ok: true,
      status: 'healthy',
      app: 'available',
      database: {
        connected: true,
        engine: 'Qdrant',
        collection: collection(env),
        points: c.points_count
      },
      engine: 'Qdrant',
      points: c.points_count,
      model: 'MiniLM + BM25'
    }, 200);
  } catch (e) {
    return json({
      ok: false,
      status: 'degraded',
      app: 'available',
      database: {
        connected: false,
        error: e instanceof ApiError ? e.message : 'The search service is temporarily unreachable.'
      },
      error: e instanceof ApiError ? e.message : 'The search service is temporarily unreachable.'
    }, 503);
  }
}
