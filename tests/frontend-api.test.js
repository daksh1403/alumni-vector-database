import test from 'node:test';
import assert from 'node:assert/strict';

import {
  api,
  searchMentors,
  getMentors,
  getMentorById,
  getJobs,
  getJobById,
  getHealth,
  getStats,
  getFacets,
  saveRecord,
  deleteRecord
} from '../frontend/js/api.js';

test('frontend api helper handles successful json requests', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.equal(url, '/api/health');
    return new Response(JSON.stringify({ ok: true, status: 'healthy' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  try {
    const data = await getHealth();
    assert.equal(data.status, 'healthy');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('frontend searchMentors validates input before making request', async () => {
  await assert.rejects(
    () => searchMentors({ query: '' }),
    /search query/i
  );
  await assert.rejects(
    () => searchMentors({ query: '   ' }),
    /search query/i
  );
});

test('frontend searchMentors formats request body properly', async () => {
  const originalFetch = globalThis.fetch;
  let sentBody;

  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/mentors/search');
    assert.equal(options.method, 'POST');
    sentBody = JSON.parse(options.body);
    return new Response(JSON.stringify({ results: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  try {
    const data = await searchMentors({
      query: 'AI specialist',
      domain: 'Artificial Intelligence',
      city: 'Chennai',
      limit: 5
    });
    assert.deepEqual(sentBody, {
      query: 'AI specialist',
      domain: 'Artificial Intelligence',
      city: 'Chennai',
      limit: 5
    });
    assert.deepEqual(data, { results: [] });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('frontend query helper methods construct URL query parameters', async () => {
  const originalFetch = globalThis.fetch;
  const calledUrls = [];

  globalThis.fetch = async (url) => {
    calledUrls.push(url);
    return new Response(JSON.stringify({ results: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  try {
    await getMentors({ city: 'chennai', limit: 5 });
    assert.equal(calledUrls[0], '/api/mentors?city=chennai&limit=5');

    await getJobs({ department: 'cse' });
    assert.equal(calledUrls[1], '/api/jobs?department=cse');

    await getMentorById('abc-123');
    assert.equal(calledUrls[2], '/api/mentors/abc-123');

    await getJobById('job-456');
    assert.equal(calledUrls[3], '/api/jobs/job-456');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('frontend api handles non-2xx errors gracefully', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    return new Response(JSON.stringify({ error: 'Specific error message from server' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  try {
    await assert.rejects(
      () => api('test'),
      /Specific error message from server/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('frontend api handles offline / network connection failures', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new TypeError('Failed to fetch');
  };

  try {
    await assert.rejects(
      () => api('test'),
      /Backend may be offline or unreachable/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('frontend api handles malformed JSON response', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    return new Response('<html>Not Found</html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    });
  };

  try {
    await assert.rejects(
      () => api('test'),
      /unexpected response/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('frontend admin helpers require tokens', async () => {
  await assert.rejects(() => saveRecord({ title: 'x' }, null, ''), /token is required/);
  await assert.rejects(() => deleteRecord('123', ''), /token is required/);
});
