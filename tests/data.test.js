import test from "node:test";
import assert from "node:assert/strict";
import * as m from "../scripts/data.js";
test("generated records reach useful category sizes and are clearly labelled synthetic", () => {
  assert.equal(typeof m.buildDataset, "function");
  const rows = m.buildDataset({ nodes: [], relationships: [] });
  for (const [k, n] of Object.entries({ alumni: 50, job: 20, mentorship: 15 }))
    assert.equal(rows.filter((p) => p.payload.kind === k).length, n);
  assert.ok(rows.every((p) => p.payload.synthetic === true));
  assert.equal(new Set(rows.map((p) => p.id)).size, rows.length);
});
test("migration preserves source properties and directed relationship references", () => {
  assert.equal(typeof m.buildDataset, "function");
  const a = {
      label: "Alumni",
      key: { AlumniID: 1 },
      properties: { AlumniID: 1, FirstName: "Ada", Email: "ada@example.test" },
    },
    s = {
      label: "Skill",
      key: { SkillID: 1 },
      properties: { SkillID: 1, SkillName: "Python" },
    };
  const rows = m.buildDataset({
    nodes: [a, s],
    relationships: [
      {
        from: { label: a.label, key: a.key },
        type: "HAS_SKILL",
        to: { label: s.label, key: s.key },
      },
    ],
  });
  const migrated = rows.filter((r) => !r.payload.synthetic);
  assert.equal(migrated.length, 2);
  assert.deepEqual(migrated[0].payload.source_properties, a.properties);
  assert.equal(migrated[0].payload.relationships[0].type, "HAS_SKILL");
  assert.equal(migrated[0].payload.relationships[0].target, migrated[1].id);
  assert.deepEqual(migrated[0].payload.skills, ["python"]);
});

test("sample records keep provenance without demo wording in searchable text", () => {
  const records = m.buildDataset({ nodes: [], relationships: [] });
  assert.ok(records.every((record) => record.payload.synthetic === true));
  for (const { payload } of records) {
    assert.doesNotMatch(
      payload.title + " " + payload.description,
      /\b(demo|synthetic)\b/i,
    );
  }
});

test("every alumnus has a unique name even when source data uses a sample name", () => {
  const rows = m.buildDataset({
    nodes: [
      {
        label: "Alumni",
        key: { AlumniID: 1 },
        properties: { AlumniID: 1, FirstName: "Ananya", LastName: "Rao" },
      },
    ],
    relationships: [],
  });
  const alumni = rows.filter((row) => row.payload.kind === "alumni");
  const names = alumni.map((row) =>
    row.payload.title.split(" · ")[0].trim().toLowerCase(),
  );
  assert.equal(alumni.length, 50);
  assert.equal(new Set(names).size, alumni.length);
});

test("sample titles describe people and mentoring tracks without numbered copies", () => {
  const rows = m.buildDataset({ nodes: [], relationships: [] });
  for (const { payload } of rows) assert.doesNotMatch(payload.title, /\s\d+$/);
  assert.equal(
    new Set(rows.map((row) => row.payload.kind + ":" + row.payload.title)).size,
    rows.length,
  );
});

test("batches in the same year show their department and section", () => {
  const rows = m.buildDataset({
    nodes: [
      {
        label: "Department",
        key: { DeptID: 10 },
        properties: {
          DeptID: 10,
          DeptCode: "cse",
          DeptName: "Computer Science",
        },
      },
      {
        label: "Batch",
        key: { BatchID: 2 },
        properties: { BatchID: 2, BatchYear: 2020, DeptID: 10, Section: "A" },
      },
      {
        label: "Batch",
        key: { BatchID: 3 },
        properties: { BatchID: 3, BatchYear: 2020, DeptID: 10, Section: "B" },
      },
    ],
    relationships: [],
  });
  const batches = rows.filter((row) => row.payload.kind === "batch");
  assert.deepEqual(
    batches.map((row) => row.payload.title),
    ["Batch 2020 · CSE · Section A", "Batch 2020 · CSE · Section B"],
  );
});
