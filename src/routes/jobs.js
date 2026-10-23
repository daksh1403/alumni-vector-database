import { ApiError, collection, request } from '../qdrant.js';
import { filters } from '../search.js';
import { json } from '../utils.js';
import { DOMAIN_MAP } from './mentors.js';

export async function handleJobs(req, env, fetcher = fetch) {
  if (req.method !== 'GET') {
    throw new ApiError('Endpoint or method not found.', 404);
  }

  const url = new URL(req.url);
  const offset = url.searchParams.get('offset');
  if (offset && !/^[a-f0-9-]{36}$/.test(offset)) {
    throw new ApiError('Invalid page offset.', 400);
  }

  let limit = 5;
  if (url.searchParams.has('limit')) {
    const l = Number(url.searchParams.get('limit'));
    if (!Number.isSafeInteger(l) || l < 1) {
      throw new ApiError('Invalid limit parameter.', 400);
    }
    limit = Math.min(20, l);
  }

  const filterInput = { kind: 'job' };

  const domain = url.searchParams.get('domain') || url.searchParams.get('department');
  if (domain) {
    const norm = domain.toLowerCase().trim();
    filterInput.department = DOMAIN_MAP[norm] || norm;
  }

  const city = url.searchParams.get('city') || url.searchParams.get('location');
  if (city) filterInput.location = city.toLowerCase().trim();
  if (url.searchParams.has('skill')) filterInput.skill = url.searchParams.get('skill');

  if (url.searchParams.has('synthetic')) {
    const s = url.searchParams.get('synthetic');
    if (!['true', 'false'].includes(s)) {
      throw new ApiError('Invalid synthetic filter.', 400);
    }
    filterInput.synthetic = s === 'true';
  }

  const filter = filters(filterInput);
  const base = '/collections/' + encodeURIComponent(collection(env));

  const r = await request(env, base + '/points/scroll', 'POST', {
    limit,
    with_payload: true,
    with_vector: false,
    ...(offset ? { offset } : {}),
    ...(filter ? { filter } : {})
  }, fetcher);

  const results = (r.points || []).map(p => ({
    id: String(p.id),
    title: p.payload?.title || 'Job Opportunity',
    description: p.payload?.description || '',
    department: p.payload?.department || '',
    location: p.payload?.location || '',
    skills: p.payload?.skills || [],
    synthetic: Boolean(p.payload?.synthetic),
    payload: p.payload
  }));

  return json({ results, nextOffset: r.next_page_offset });
}

export async function handleJobById(req, env, id, fetcher = fetch) {
  if (req.method !== 'GET') {
    throw new ApiError('Endpoint or method not found.', 404);
  }

  const base = '/collections/' + encodeURIComponent(collection(env));
  const records = await request(env, base + '/points', 'POST', {
    ids: [id],
    with_payload: true,
    with_vector: false
  }, fetcher);

  if (!records.length) {
    throw new ApiError('Job not found.', 404);
  }

  const record = records[0];
  if (record.payload?.kind !== 'job') {
    throw new ApiError('Job not found.', 404);
  }

  return json({ job: record });
}
