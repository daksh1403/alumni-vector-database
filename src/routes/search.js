import { ApiError, collection, request } from '../qdrant.js';
import { searchBody } from '../search.js';
import { body, json } from '../utils.js';

export async function handleSearch(req, env, fetcher = fetch) {
  if (req.method !== 'POST') {
    throw new ApiError('Endpoint or method not found.', 404);
  }

  const input = await body(req);
  const query = searchBody(input, env);
  const start = Date.now();
  const base = '/collections/' + encodeURIComponent(collection(env));

  const r = await request(env, base + '/points/query', 'POST', query, fetcher);

  return json({
    results: r.points,
    elapsedMs: Date.now() - start,
    limit: 5,
    method: 'Hybrid semantic + keyword search',
    scoreNote: 'RRF ranking score; not a match probability.'
  });
}
