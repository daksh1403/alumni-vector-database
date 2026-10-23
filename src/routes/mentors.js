import { ApiError, collection, request } from '../qdrant.js';
import { searchBody, filters } from '../search.js';
import { body, json, titleCase } from '../utils.js';

export const DOMAIN_MAP = {
  'artificial intelligence': 'cse',
  'ai': 'cse',
  'machine learning': 'cse',
  'computer science': 'cse',
  'data science': 'cse',
  'data analytics': 'cse',
  'cloud': 'cse',
  'cloud infrastructure': 'cse',
  'information technology': 'it',
  'it': 'it',
  'web development': 'it',
  'cybersecurity': 'it',
  'mobile development': 'it',
  'electronics': 'ece',
  'ece': 'ece',
  'robotics': 'ece',
  'embedded systems': 'ece',
  'management': 'mba',
  'mba': 'mba',
  'finance': 'mba',
  'financial analysis': 'mba',
  'business': 'mba',
  'product management': 'mba',
  'design': 'design',
  'product design': 'design',
  'ui/ux': 'design'
};

export function formatMentor(point) {
  const p = point.payload || {};

  let name = '';
  if (p.source_properties?.FirstName) {
    name = [p.source_properties.FirstName, p.source_properties.LastName].filter(Boolean).join(' ');
  } else if (typeof p.title === 'string' && p.title.includes('·')) {
    name = p.title.split('·')[0].trim();
  } else if (typeof p.title === 'string') {
    name = p.title.trim();
  } else {
    name = 'Alumni Mentor';
  }

  let role = '';
  if (p.source_properties?.JobTitle) {
    role = p.source_properties.JobTitle;
  } else if (p.source_properties?.CurrentJobTitle) {
    role = p.source_properties.CurrentJobTitle;
  } else if (p.topic) {
    role = titleCase(p.topic) + ' Specialist';
  } else if (typeof p.title === 'string' && p.title.includes('·')) {
    role = titleCase(p.title.split('·')[1].trim());
  } else {
    role = 'Alumni Mentor';
  }

  const skills = Array.isArray(p.skills)
    ? p.skills.map(s => titleCase(String(s).trim()))
    : [];

  const city = titleCase(p.location || p.source_properties?.City || '');

  let match_reason = '';
  if (p.topic) {
    match_reason = `Relevant experience in ${p.topic}`;
  } else if (p.skills && p.skills.length) {
    match_reason = `Relevant experience in ${p.skills.slice(0, 2).map(s => String(s).trim()).join(', ')}`;
  } else if (p.description) {
    const desc = p.description.trim();
    match_reason = desc.length > 80 ? desc.slice(0, 77) + '…' : desc;
  } else {
    match_reason = 'Matched alumni mentor profile';
  }

  const item = {
    id: String(point.id),
    name,
    role,
    skills,
    city,
    match_reason
  };

  if (typeof point.score === 'number' && Number.isFinite(point.score)) {
    item.score = point.score;
  }

  return item;
}

export async function handleMentorSearch(req, env, fetcher = fetch) {
  if (req.method !== 'POST') {
    throw new ApiError('Endpoint or method not found.', 404);
  }

  const input = await body(req);

  const allowed = ['query', 'domain', 'city', 'limit', 'skill', 'department', 'synthetic'];
  if (Object.keys(input).some(k => !allowed.includes(k))) {
    throw new ApiError('Unknown search filter.', 400);
  }

  if (typeof input.query !== 'string' || !input.query.trim() || input.query.length > 1000) {
    throw new ApiError('Enter a query between 1 and 1000 characters.', 400);
  }

  if (input.domain !== undefined) {
    if (typeof input.domain !== 'string' || input.domain.length > 100) {
      throw new ApiError('Invalid domain filter.', 400);
    }
  }

  if (input.city !== undefined) {
    if (typeof input.city !== 'string' || input.city.length > 100) {
      throw new ApiError('Invalid city filter.', 400);
    }
  }

  if (input.limit !== undefined) {
    if (!Number.isSafeInteger(input.limit) || input.limit < 1) {
      throw new ApiError('Invalid limit parameter.', 400);
    }
  }

  let department;
  if (input.domain && input.domain.trim()) {
    const norm = input.domain.toLowerCase().trim();
    department = DOMAIN_MAP[norm] || norm;
  } else if (input.department && input.department.trim()) {
    department = input.department.trim().toLowerCase();
  }

  let location;
  if (input.city && input.city.trim()) {
    location = input.city.toLowerCase().trim();
  }

  const searchInput = {
    query: input.query.trim(),
    kind: 'alumni',
    ...(department ? { department } : {}),
    ...(location ? { location } : {}),
    ...(input.skill ? { skill: input.skill } : {}),
    ...(input.synthetic !== undefined ? { synthetic: input.synthetic } : {}),
    limit: input.limit !== undefined ? Math.min(5, Math.max(1, input.limit)) : 5
  };

  const base = '/collections/' + encodeURIComponent(collection(env));
  const query = searchBody(searchInput, env);
  const r = await request(env, base + '/points/query', 'POST', query, fetcher);

  const results = (r.points || []).map(formatMentor);
  return json({ results });
}

export async function handleMentors(req, env, fetcher = fetch) {
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

  const filterInput = { kind: 'alumni' };
  const domain = url.searchParams.get('domain') || url.searchParams.get('department');
  if (domain) {
    const norm = domain.toLowerCase().trim();
    filterInput.department = DOMAIN_MAP[norm] || norm;
  }

  const city = url.searchParams.get('city') || url.searchParams.get('location');
  if (city) filterInput.location = city.toLowerCase().trim();
  if (url.searchParams.has('skill')) filterInput.skill = url.searchParams.get('skill');

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
    ...formatMentor(p),
    payload: p.payload
  }));

  return json({ results, nextOffset: r.next_page_offset });
}

export async function handleMentorById(req, env, id, fetcher = fetch) {
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
    throw new ApiError('Mentor not found.', 404);
  }

  const record = records[0];
  if (record.payload?.kind !== 'alumni' && record.payload?.kind !== 'mentorship') {
    throw new ApiError('Mentor not found.', 404);
  }

  return json({
    mentor: formatMentor(record),
    record
  });
}
