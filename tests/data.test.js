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
