import assert from "node:assert/strict";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import worker from "../src/worker.js";
import { request, collection } from "../src/qdrant.js";
const env = process.env,
  cases = [
    [
      "neural networks and artificial intelligence projects",
      "machine learning",
    ],
    ["accessible websites and frontend browser interfaces", "web development"],
    ["containers Kubernetes infrastructure automation", "cloud infrastructure"],
    ["ethical hacking and protection from cyber attacks", "cybersecurity"],
    ["business dashboards SQL and statistical reports", "data analytics"],
    ["user research and interactive product prototypes", "product design"],
    [
      "Android and cross platform smartphone applications",
      "mobile development",
    ],
    [
      "investment valuation and corporate financial forecasting",
      "financial analysis",
    ],
    ["autonomous robots microcontrollers sensors", "robotics"],
    ["product roadmaps customer priorities and launches", "product management"],
  ];
const results = [];
for (const [query, topic] of cases) {
  const t = Date.now(),
    r = await worker.fetch(
      new Request("https://local/api/search", {
        method: "POST",
        body: JSON.stringify({ query, kind: "alumni" }),
      }),
      env,
    ),
    j = await r.json();
  assert.equal(r.status, 200, JSON.stringify(j));
  assert.ok(j.results.length <= 5);
  const hit = j.results.slice(0, 3).some((p) => p.payload.topic === topic);
  assert.ok(hit, "No relevant result in top three: " + topic);
  results.push({
    topic,
    top1: j.results[0].payload.topic === topic,
    hitAt3: hit,
    precisionAt5: j.results.filter((p) => p.payload.topic === topic).length / 5,
    elapsedMs: Date.now() - t,
  });
  console.log("PASS", topic, results.at(-1).elapsedMs + "ms");
}
const filter = await worker.fetch(
  new Request("https://local/api/search", {
    method: "POST",
    body: JSON.stringify({
      query: "Python developer",
      kind: "alumni",
      skill: "python",
      department: "cse",
    }),
  }),
  env,
);
const j = await filter.json();
assert.equal(filter.status, 200);
assert.ok(j.results.length > 0);
assert.ok(
  j.results.every(
    (p) =>
      p.payload.skills.includes("python") && p.payload.department === "cse",
  ),
);
const c = await request(env, "/collections/" + collection(env));
if (existsSync("private/dataset.json")) {
  const points = JSON.parse(readFileSync("private/dataset.json"));
  assert.equal(c.points_count, points.length);
  const actual = await request(
    env,
    "/collections/" + collection(env) + "/points",
    "POST",
    {
      ids: points.filter((p) => !p.payload.synthetic).map((p) => p.id),
      with_payload: true,
      with_vector: false,
    },
  );
  for (const p of actual) {
    const old = points.find((x) => x.id === p.id);
    assert.deepEqual(p.payload, old.payload);
  }
  assert.equal(
    actual.length,
    points.filter((p) => !p.payload.synthetic).length,
  );
}
const ms = results.map((r) => r.elapsedMs).sort((a, b) => a - b),
  report = {
    points: c.points_count,
    cases: results,
    top1: results.filter((r) => r.top1).length + "/" + results.length,
    hitAt3: results.filter((r) => r.hitAt3).length + "/" + results.length,
    medianMs: ms[Math.floor(ms.length / 2)],
    maxMs: ms.at(-1),
    scope:
      "Small curated synthetic demo; these queries guide tuning and are not an independent benchmark.",
  };
mkdirSync("private", { recursive: true });
writeFileSync("private/evaluation.json", JSON.stringify(report, null, 2));
console.log(
  JSON.stringify({
    points: report.points,
    top1: report.top1,
    hitAt3: report.hitAt3,
    medianMs: report.medianMs,
    maxMs: report.maxMs,
  }),
);
