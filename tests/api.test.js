import test from 'node:test';
import assert from 'node:assert/strict';

const worker = (await import('../src/worker.js')).default;

const mockEnv = (fetcher) => ({
  QDRANT_URL: 'https://cluster.example',
  QDRANT_API_KEY: 'test-api-key',
  QDRANT_COLLECTION: 'alumni_network_v1',
  VECTOR_ADMIN_TOKEN: 'test-admin-token',
  fetcher
});

const makeReq = (path, body, method, headers = {}) => {
  const init = {
    method: method || (body !== undefined ? 'POST' : 'GET'),
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers
    },
    ...(body !== undefined
      ? { body: typeof body === 'string' ? body : JSON.stringify(body) }
      : {})
  };
  return new Request('https://example.org' + path, init);
};

// 1. Valid search request
test('1. Valid search request returns 200 and mapped results', async () => {
  const mockFetcher = async (url, options) => {
    assert.ok(url.includes('/points/query'));
    return Response.json({
      status: 'ok',
      result: {
        points: [
          {
            id: 'alumni-101',
            score: 0.91,
            payload: {
              kind: 'alumni',
              title: 'Ananya Rao · machine learning 1',
              description: 'Specialist in machine learning with 5 years experience.',
              skills: ['python', 'machine learning'],
              location: 'chennai',
              topic: 'machine learning',
              synthetic: true
            }
          }
        ]
      }
    });
  };

  const req = makeReq('/api/mentors/search', {
    query: 'I want a mentor experienced in machine learning',
    domain: 'Artificial Intelligence',
    city: 'Chennai',
    limit: 5
  });

  const res = await worker.fetch(req, mockEnv(mockFetcher));
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(Array.isArray(data.results));
  assert.equal(data.results.length, 1);

  const mentor = data.results[0];
  assert.equal(mentor.id, 'alumni-101');
  assert.equal(mentor.name, 'Ananya Rao');
  assert.equal(mentor.role, 'Machine Learning Specialist');
  assert.deepEqual(mentor.skills, ['Python', 'Machine Learning']);
  assert.equal(mentor.city, 'Chennai');
  assert.equal(mentor.match_reason, 'Relevant experience in machine learning');
  assert.equal(mentor.score, 0.91);
});

// 2. Missing query
test('2. Missing query returns 400', async () => {
  const req = makeReq('/api/mentors/search', {
    domain: 'Artificial Intelligence',
    city: 'Chennai'
  });
  const res = await worker.fetch(req, mockEnv());
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.match(data.error, /query/i);
});

// 3. Empty or whitespace-only query
test('3. Empty or whitespace-only query returns 400', async () => {
  for (const emptyQuery of ['', '   ', '\t\n']) {
    const req = makeReq('/api/mentors/search', {
      query: emptyQuery
    });
    const res = await worker.fetch(req, mockEnv());
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.match(data.error, /query/i);
  }
});

// 4. Malformed JSON or wrong content type
test('4. Malformed JSON body returns 400', async () => {
  const req = new Request('https://example.org/api/mentors/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"query": "invalid json'
  });
  const res = await worker.fetch(req, mockEnv());
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.match(data.error, /valid json/i);
});

// 5. Invalid optional filter types
test('5. Invalid optional filter types return 400', async () => {
  const invalidCases = [
    { query: 'test', domain: 123 },
    { query: 'test', domain: true },
    { query: 'test', domain: 'x'.repeat(101) },
    { query: 'test', city: 456 },
    { query: 'test', city: ['Chennai'] },
    { query: 'test', city: 'x'.repeat(101) },
    { query: 'test', unknownField: 'bad' }
  ];

  for (const payload of invalidCases) {
    const req = makeReq('/api/mentors/search', payload);
    const res = await worker.fetch(req, mockEnv());
    assert.equal(res.status, 400, `Payload ${JSON.stringify(payload)} should return 400`);
  }
});

// 6. Invalid or out-of-range result limit
test('6. Invalid or out-of-range result limit returns 400', async () => {
  const invalidLimits = [0, -1, -100, 2.5, 'five', NaN];

  for (const limit of invalidLimits) {
    const req = makeReq('/api/mentors/search', {
      query: 'mentor in AI',
      limit
    });
    const res = await worker.fetch(req, mockEnv());
    assert.equal(res.status, 400, `Limit ${limit} should return 400`);
  }
});

// 7. Successful search with no matches
test('7. Successful search with no matches returns 200 and empty results array', async () => {
  const mockFetcher = async () => Response.json({
    status: 'ok',
    result: { points: [] }
  });

  const req = makeReq('/api/mentors/search', {
    query: 'completely nonexistent obscure topic xyz'
  });
  const res = await worker.fetch(req, mockEnv(mockFetcher));
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.deepEqual(data, { results: [] });
});

// 8. Search service/Qdrant unavailable
test('8. Search service / Qdrant unavailable returns 503 without leaking secrets', async () => {
  const mockFetcher = async () => {
    throw new Error('connect ECONNREFUSED 127.0.0.1:6333');
  };

  const req = makeReq('/api/mentors/search', {
    query: 'machine learning'
  });
  const res = await worker.fetch(req, mockEnv(mockFetcher));
  assert.equal(res.status, 503);
  const data = await res.json();
  assert.equal(data.ok, false);
  assert.equal(data.error, 'The search service is temporarily unreachable.');
  assert.ok(!JSON.stringify(data).includes('test-api-key'));
});

// 9. Search timeout
test('9. Search timeout returns 503 without leaking secrets', async () => {
  const mockFetcher = async () => {
    const abortErr = new Error('The operation was aborted');
    abortErr.name = 'TimeoutError';
    throw abortErr;
  };

  const req = makeReq('/api/mentors/search', {
    query: 'cloud computing mentor'
  });
  const res = await worker.fetch(req, mockEnv(mockFetcher));
  assert.equal(res.status, 503);
  const data = await res.json();
  assert.equal(data.ok, false);
  assert.equal(data.error, 'The search service is temporarily unreachable.');
});

// 10. Read-only profile endpoint success
test('10. Read-only profile listing and profile retrieval by ID succeed', async () => {
  const mockPoint = {
    id: 'a0000000-0000-0000-0000-000000000001',
    payload: {
      kind: 'alumni',
      title: 'Rohan Nair · cloud infrastructure 1',
      description: 'AWS and DevOps mentor with practical production experience.',
      skills: ['aws', 'docker', 'kubernetes'],
      location: 'bengaluru',
      topic: 'cloud infrastructure',
      synthetic: true
    }
  };

  const mockFetcher = async (url) => {
    if (url.includes('/points/scroll')) {
      return Response.json({
        status: 'ok',
        result: { points: [mockPoint], next_page_offset: null }
      });
    }
    if (url.includes('/points')) {
      return Response.json({
        status: 'ok',
        result: [mockPoint]
      });
    }
    throw new Error('Unexpected URL: ' + url);
  };

  // 10a. Listing mentors
  const listReq = makeReq('/api/mentors?city=bengaluru&limit=5');
  const listRes = await worker.fetch(listReq, mockEnv(mockFetcher));
  assert.equal(listRes.status, 200);
  const listData = await listRes.json();
  assert.equal(listData.results.length, 1);
  assert.equal(listData.results[0].name, 'Rohan Nair');
  assert.equal(listData.results[0].city, 'Bengaluru');

  // 10b. Profile by ID
  const idReq = makeReq('/api/mentors/a0000000-0000-0000-0000-000000000001');
  const idRes = await worker.fetch(idReq, mockEnv(mockFetcher));
  assert.equal(idRes.status, 200);
  const idData = await idRes.json();
  assert.equal(idData.mentor.name, 'Rohan Nair');
  assert.equal(idData.mentor.role, 'Cloud Infrastructure Specialist');
  assert.deepEqual(idData.mentor.skills, ['Aws', 'Docker', 'Kubernetes']);
});

// 11. Profile not found
test('11. Profile not found returns 404', async () => {
  const mockFetcher = async () => Response.json({
    status: 'ok',
    result: []
  });

  const req = makeReq('/api/mentors/ffffffff-ffff-ffff-ffff-ffffffffffff');
  const res = await worker.fetch(req, mockEnv(mockFetcher));
  assert.equal(res.status, 404);
  const data = await res.json();
  assert.match(data.error, /mentor not found/i);
});

// 12. Job listing/filtering if supported
test('12. Job listing and filtering return 200 with job opportunities', async () => {
  const mockJob = {
    id: 'b0000000-0000-0000-0000-000000000002',
    payload: {
      kind: 'job',
      title: 'Machine learning engineer',
      description: 'Synthetic job opportunity for an ML engineer in Chennai.',
      department: 'cse',
      location: 'chennai',
      skills: ['python', 'pytorch'],
      synthetic: true
    }
  };

  const mockFetcher = async (url) => {
    if (url.includes('/points/scroll')) {
      return Response.json({
        status: 'ok',
        result: { points: [mockJob], next_page_offset: null }
      });
    }
    if (url.includes('/points')) {
      return Response.json({
        status: 'ok',
        result: [mockJob]
      });
    }
    throw new Error('Unexpected URL: ' + url);
  };

  // 12a. List jobs with department filter
  const listReq = makeReq('/api/jobs?department=cse&location=chennai');
  const listRes = await worker.fetch(listReq, mockEnv(mockFetcher));
  assert.equal(listRes.status, 200);
  const listData = await listRes.json();
  assert.equal(listData.results.length, 1);
  assert.equal(listData.results[0].title, 'Machine learning engineer');
  assert.equal(listData.results[0].location, 'chennai');

  // 12b. Job by ID
  const idReq = makeReq('/api/jobs/b0000000-0000-0000-0000-000000000002');
  const idRes = await worker.fetch(idReq, mockEnv(mockFetcher));
  assert.equal(idRes.status, 200);
  const idData = await idRes.json();
  assert.equal(idData.job.id, 'b0000000-0000-0000-0000-000000000002');
});

// 13. Health response when the service is healthy
test('13. Health response when the service is healthy returns 200 with readiness details', async () => {
  const mockFetcher = async (url) => {
    assert.ok(url.includes('/collections/'));
    return Response.json({
      status: 'ok',
      result: {
        points_count: 101,
        status: 'green'
      }
    });
  };

  const req = makeReq('/api/health');
  const res = await worker.fetch(req, mockEnv(mockFetcher));
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.status, 'healthy');
  assert.equal(data.app, 'available');
  assert.equal(data.database.connected, true);
  assert.equal(data.database.points, 101);
  assert.equal(data.engine, 'Qdrant');
});

// 14. Health response when Qdrant is unavailable
test('14. Health response when Qdrant is unavailable returns 503 distinguishing app from database', async () => {
  const mockFetcher = async () => {
    throw new Error('Connection refused');
  };

  const req = makeReq('/api/health');
  const res = await worker.fetch(req, mockEnv(mockFetcher));
  assert.equal(res.status, 503);
  const data = await res.json();
  assert.equal(data.ok, false);
  assert.equal(data.status, 'degraded');
  assert.equal(data.app, 'available');
  assert.equal(data.database.connected, false);
  assert.ok(data.database.error);
});

// 15. Response schema and HTTP status consistency
test('15. Response schema and HTTP status consistency across all endpoints', async () => {
  // Method not allowed / unknown endpoints return 404
  const unknownRes = await worker.fetch(makeReq('/api/unknown-endpoint'), mockEnv());
  assert.equal(unknownRes.status, 404);
  const unknownData = await unknownRes.json();
  assert.ok(unknownData.error);

  // Security headers check
  assert.equal(unknownRes.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(unknownRes.headers.get('Cache-Control'), 'no-store');

  // Verify mentor search response structure matches required schema
  const mockFetcher = async () => Response.json({
    status: 'ok',
    result: {
      points: [{
        id: 'alumni-sample',
        score: 0.88,
        payload: {
          kind: 'alumni',
          title: 'Meera Shah · product design 1',
          description: 'Specialist in UX research and interactive prototyping.',
          skills: ['figma', 'ux research', 'prototyping'],
          location: 'pune',
          topic: 'product design'
        }
      }]
    }
  });

  const res = await worker.fetch(makeReq('/api/mentors/search', { query: 'design mentor' }), mockEnv(mockFetcher));
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(Array.isArray(data.results));
  const r = data.results[0];
  assert.equal(typeof r.id, 'string');
  assert.equal(typeof r.name, 'string');
  assert.equal(typeof r.role, 'string');
  assert.ok(Array.isArray(r.skills));
  assert.equal(typeof r.city, 'string');
  assert.equal(typeof r.match_reason, 'string');
  assert.equal(typeof r.score, 'number');
});
