import { request, ApiError, collection, vectors } from './qdrant.js';
import { browseFilters, validateRecord, mergeRecord, documentText, kinds } from './search.js';
import { json, body, admin } from './utils.js';
import { handleHealth } from './routes/health.js';
import { handleMentorSearch, handleMentors, handleMentorById } from './routes/mentors.js';
import { handleJobs, handleJobById } from './routes/jobs.js';
import { handleSearch } from './routes/search.js';

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const path = url.pathname;
    const base = '/collections/' + encodeURIComponent(collection(env));
    const fetcher = env.fetcher || fetch;

    try {
      if (!path.startsWith('/api/')) {
        if (env.ASSETS) {
          const r = await env.ASSETS.fetch(req);
          const h = new Headers(r.headers);
          h.set(
            'Content-Security-Policy',
            "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'"
          );
          h.set('X-Content-Type-Options', 'nosniff');
          return new Response(r.body, { status: r.status, headers: h });
        }
        return json({ name: 'Alumni Vector Console', engine: 'Qdrant', health: '/api/health' });
      }

      if (path === '/api/health') {
        return await handleHealth(req, env, fetcher);
      }

      if (path === '/api/mentors/search') {
        return await handleMentorSearch(req, env, fetcher);
      }

      if (path === '/api/mentors') {
        return await handleMentors(req, env, fetcher);
      }

      const mentorMatch = path.match(/^\/api\/mentors\/([a-f0-9-]{36})$/);
      if (mentorMatch) {
        return await handleMentorById(req, env, mentorMatch[1], fetcher);
      }

      if (path === '/api/jobs') {
        return await handleJobs(req, env, fetcher);
      }

      const jobMatch = path.match(/^\/api\/jobs\/([a-f0-9-]{36})$/);
      if (jobMatch) {
        return await handleJobById(req, env, jobMatch[1], fetcher);
      }

      if (path === '/api/search') {
        return await handleSearch(req, env, fetcher);
      }

      if (path === '/api/stats' && req.method === 'GET') {
        const c = await request(env, base, 'GET', undefined, fetcher);
        const counts = await request(env, base + '/facet', 'POST', { key: 'kind', limit: 20, exact: true }, fetcher);
        return json({
          ok: true,
          points: c.points_count,
          counts: counts.hits,
          model: 'MiniLM 384 + BM25',
          retrieval: 'Reciprocal rank fusion'
        });
      }

      if (path === '/api/facets' && req.method === 'GET') {
        const out = { kinds };
        for (const key of ['department', 'skills', 'location']) {
          out[key] = (await request(env, base + '/facet', 'POST', { key, limit: 100, exact: true }, fetcher)).hits.map(h => h.value);
        }
        return json(out);
      }

      if (path === '/api/records' && req.method === 'GET') {
        const filter = browseFilters(url.searchParams);
        const offset = url.searchParams.get('offset');
        if (offset && !/^[a-f0-9-]{36}$/.test(offset)) {
          throw new ApiError('Invalid page offset.', 400);
        }
        const r = await request(env, base + '/points/scroll', 'POST', {
          limit: 5,
          with_payload: true,
          with_vector: false,
          ...(offset ? { offset } : {}),
          ...(filter ? { filter } : {})
        }, fetcher);
        return json({ results: r.points, nextOffset: r.next_page_offset });
      }

      const match = path.match(/^\/api\/records\/([a-f0-9-]{36})$/);

      if (match && req.method === 'GET') {
        const records = await request(env, base + '/points', 'POST', {
          ids: [match[1]],
          with_payload: true,
          with_vector: false
        }, fetcher);
        if (!records.length) throw new ApiError('Record not found.', 404);
        return json({ record: records[0] });
      }

      if (match && req.method === 'DELETE') {
        if (!await admin(req, env)) throw new ApiError('Admin bearer token required.', 401);
        const existing = await request(env, base + '/points', 'POST', { ids: [match[1]], with_payload: true }, fetcher);
        if (!existing.length) throw new ApiError('Record not found.', 404);
        if (existing[0].payload.relationships?.length) {
          throw new ApiError('This migrated record has connections. Remove its relationship references before deleting it.', 409);
        }
        await request(env, base + '/points/delete?wait=true', 'POST', { points: [match[1]] }, fetcher);
        return json({ ok: true });
      }

      if ((path === '/api/records' && req.method === 'POST') || (match && req.method === 'PUT')) {
        if (!await admin(req, env)) throw new ApiError('Admin bearer token required.', 401);
        let payload = validateRecord(await body(req));
        const id = match?.[1] || crypto.randomUUID();
        if (match) {
          const existing = await request(env, base + '/points', 'POST', { ids: [id], with_payload: true }, fetcher);
          if (!existing.length) throw new ApiError('Record not found.', 404);
          payload = mergeRecord(existing[0].payload, payload);
        }
        await request(env, base + '/points?wait=true', 'PUT', {
          points: [{ id, payload, vector: vectors(documentText(payload), env) }]
        }, fetcher);
        return json({ ok: true, id }, match ? 200 : 201);
      }

      return json({ error: 'Endpoint or method not found.' }, 404);
    } catch (e) {
      return json(
        { ok: false, error: e instanceof ApiError ? e.message : 'The request could not be processed.' },
        e instanceof ApiError ? e.status : 500
      );
    }
  }
};
