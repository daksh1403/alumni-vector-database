/**
 * Alumni Vector Database — Frontend API Client Module
 * Provides fetch wrappers, request validation, structured error handling,
 * and typed helpers for mentors, jobs, search, and health endpoints.
 */

export async function api(path, options = {}) {
  const { timeout = 25000, ...fetchOptions } = options;
  const url = path.startsWith('/') ? path : '/api/' + path;

  let r;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  if (typeof timer.unref === 'function') timer.unref();

  try {
    r = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Request timed out. The server took too long to respond.');
    }
    throw new Error('Could not connect to the database service. Backend may be offline or unreachable.');
  } finally {
    clearTimeout(timer);
  }

  let j;
  try {
    j = await r.json();
  } catch {
    throw new Error('The service returned an unexpected response.');
  }

  if (!r.ok) {
    throw new Error(j.error || `Request failed with status ${r.status}.`);
  }

  return j;
}

export function post(path, data, method = 'POST', token = null) {
  return api(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {})
    },
    body: JSON.stringify(data)
  });
}

/**
 * Semantic Mentor Search
 * @param {Object} params
 * @param {string} params.query - Required non-empty query string
 * @param {string} [params.domain] - Optional domain/department filter
 * @param {string} [params.city] - Optional city/location filter
 * @param {number} [params.limit] - Optional result limit (default: 5)
 * @returns {Promise<{results: Array<{id: string, name: string, role: string, skills: string[], city: string, match_reason: string, score?: number}>}>}
 */
export async function searchMentors({ query, domain, city, limit = 5 }) {
  if (typeof query !== 'string' || !query.trim()) {
    throw new Error('Please enter a search query.');
  }

  const payload = {
    query: query.trim(),
    ...(domain ? { domain: String(domain).trim() } : {}),
    ...(city ? { city: String(city).trim() } : {}),
    limit: Number.isSafeInteger(limit) && limit > 0 ? limit : 5
  };

  return post('mentors/search', payload);
}

/**
 * List / browse mentors with optional filtering
 */
export async function getMentors(filters = {}) {
  const params = new URLSearchParams();
  for (const [key, val] of Object.entries(filters)) {
    if (val !== undefined && val !== null && val !== '') {
      params.set(key, String(val));
    }
  }
  const queryStr = params.toString();
  return api('mentors' + (queryStr ? '?' + queryStr : ''));
}

/**
 * Get individual mentor profile by ID
 */
export async function getMentorById(id) {
  if (!id) throw new Error('Mentor ID is required.');
  return api('mentors/' + encodeURIComponent(id));
}

/**
 * List / browse job opportunities with optional filtering
 */
export async function getJobs(filters = {}) {
  const params = new URLSearchParams();
  for (const [key, val] of Object.entries(filters)) {
    if (val !== undefined && val !== null && val !== '') {
      params.set(key, String(val));
    }
  }
  const queryStr = params.toString();
  return api('jobs' + (queryStr ? '?' + queryStr : ''));
}

/**
 * Get individual job record by ID
 */
export async function getJobById(id) {
  if (!id) throw new Error('Job ID is required.');
  return api('jobs/' + encodeURIComponent(id));
}

/**
 * General hybrid semantic + keyword search
 */
export async function searchRecords(searchParams) {
  return post('search', searchParams);
}

/**
 * Browse general records with offset pagination
 */
export async function getRecords(filters = {}) {
  const params = new URLSearchParams();
  for (const [key, val] of Object.entries(filters)) {
    if (val !== undefined && val !== null && val !== '') {
      params.set(key, String(val));
    }
  }
  const queryStr = params.toString();
  return api('records' + (queryStr ? '?' + queryStr : ''));
}

/**
 * Get a general record by UUID
 */
export async function getRecordById(id) {
  if (!id) throw new Error('Record ID is required.');
  return api('records/' + encodeURIComponent(id));
}

/**
 * System and Qdrant readiness check
 */
export async function getHealth() {
  return api('health');
}

/**
 * System stats and point counts
 */
export async function getStats() {
  return api('stats');
}

/**
 * Available metadata filter facets
 */
export async function getFacets() {
  return api('facets');
}

/**
 * Save (create or update) a record using admin authorization
 */
export async function saveRecord(data, id = null, token = '') {
  if (!token) throw new Error('Admin token is required.');
  return post('records' + (id ? '/' + id : ''), data, id ? 'PUT' : 'POST', token);
}

/**
 * Delete a record using admin authorization
 */
export async function deleteRecord(id, token = '') {
  if (!token) throw new Error('Admin token is required.');
  return api('records/' + encodeURIComponent(id), {
    method: 'DELETE',
    headers: {
      Authorization: 'Bearer ' + token
    }
  });
}
