import { request, ApiError, collection, vectors } from "./qdrant.js";
import {
  searchBody,
  browseFilters,
  validateRecord,
  mergeRecord,
  documentText,
  kinds,
} from "./search.js";
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const json = (x, status = 200) =>
  Response.json(x, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
async function body(req) {
  if (Number(req.headers.get("Content-Length")) > 65536)
    throw new ApiError("Request too large.", 413);
  const reader = req.body?.getReader();
  if (!reader) throw new ApiError("JSON body required.", 400);
  let size = 0;
  const chunks = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 65536) {
      await reader.cancel();
      throw new ApiError("Request too large.", 413);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let i = 0;
  for (const c of chunks) {
    bytes.set(c, i);
    i += c.length;
  }
  try {
    const j = JSON.parse(new TextDecoder().decode(bytes));
    if (!j || typeof j !== "object" || Array.isArray(j)) throw Error();
    return j;
  } catch {
    throw new ApiError("Valid JSON object required.", 400);
  }
}
async function admin(req, env) {
  const token = req.headers.get("Authorization") || "";
  if (!env.VECTOR_ADMIN_TOKEN || !token.startsWith("Bearer ")) return false;
  const hash = async (v) =>
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v)),
    );
  const a = await hash(token.slice(7)),
    b = await hash(env.VECTOR_ADMIN_TOKEN);
  let n = 0;
  for (let i = 0; i < a.length; i++) n |= a[i] ^ b[i];
  return n === 0;
}
export default {
  async fetch(req, env) {
    const url = new URL(req.url),
      path = url.pathname,
      base = "/collections/" + encodeURIComponent(collection(env));
    try {
      if (!path.startsWith("/api/")) {
        if (env.ASSETS) {
          const r = await env.ASSETS.fetch(req),
            h = new Headers(r.headers);
          h.set(
            "Content-Security-Policy",
            "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'",
          );
          h.set("X-Content-Type-Options", "nosniff");
          return new Response(r.body, { status: r.status, headers: h });
        }
        return json({
          name: "Alumni Vector Console",
          engine: "Qdrant",
          health: "/api/health",
        });
      }
      if (path === "/api/health" && req.method === "GET") {
        const c = await request(env, base);
        return json({
          ok: true,
          engine: "Qdrant",
          points: c.points_count,
          model: "MiniLM + BM25",
        });
      }
      if (path === "/api/stats" && req.method === "GET") {
        const c = await request(env, base);
        const counts = await request(env, base + "/facet", "POST", {
          key: "kind",
          limit: 20,
          exact: true,
        });
        return json({
          ok: true,
          points: c.points_count,
          counts: counts.hits,
          model: "MiniLM 384 + BM25",
          retrieval: "Reciprocal rank fusion",
        });
      }
      if (path === "/api/facets" && req.method === "GET") {
        const out = { kinds };
        for (const key of ["department", "skills", "location"])
          out[key] = (
            await request(env, base + "/facet", "POST", {
              key,
              limit: 100,
              exact: true,
            })
          ).hits.map((h) => h.value);
        return json(out);
      }
      if (path === "/api/search" && req.method === "POST") {
        const input = await body(req),
          query = searchBody(input, env),
          start = Date.now();
        const r = await request(env, base + "/points/query", "POST", query);
        return json({
          results: r.points,
          elapsedMs: Date.now() - start,
          limit: 5,
          method: "Hybrid semantic + keyword search",
          scoreNote: "RRF ranking score; not a match probability.",
        });
      }
      if (path === "/api/records" && req.method === "GET") {
        const filter = browseFilters(url.searchParams);
        const offset = url.searchParams.get("offset");
        if (offset && !uuid.test(offset))
          throw new ApiError("Invalid page offset.", 400);
        const r = await request(env, base + "/points/scroll", "POST", {
          limit: 5,
          with_payload: true,
          with_vector: false,
          ...(offset ? { offset } : {}),
          ...(filter ? { filter } : {}),
        });
        return json({ results: r.points, nextOffset: r.next_page_offset });
      }
      const match = path.match(/^\/api\/records\/([^/]+)$/);
      if (match && !uuid.test(match[1]))
        throw new ApiError("Invalid record ID.", 400);
      if (match && req.method === "GET") {
        const records = await request(env, base + "/points", "POST", {
          ids: [match[1]],
          with_payload: true,
          with_vector: false,
        });
        if (!records.length) throw new ApiError("Record not found.", 404);
        return json({ record: records[0] });
      }
      if (match && req.method === "DELETE") {
        if (!(await admin(req, env)))
          throw new ApiError("Admin bearer token required.", 401);
        const existing = await request(env, base + "/points", "POST", {
          ids: [match[1]],
          with_payload: true,
        });
        if (!existing.length) throw new ApiError("Record not found.", 404);
        if (existing[0].payload.relationships?.length)
          throw new ApiError(
            "This migrated record has connections. Remove its relationship references before deleting it.",
            409,
          );
        await request(env, base + "/points/delete?wait=true", "POST", {
          points: [match[1]],
        });
        return json({ ok: true });
      }
      if (
        (path === "/api/records" && req.method === "POST") ||
        (match && req.method === "PUT")
      ) {
        if (!(await admin(req, env)))
          throw new ApiError("Admin bearer token required.", 401);
        let payload = validateRecord(await body(req));
        const id = match?.[1] || crypto.randomUUID();
        if (match) {
          const existing = await request(env, base + "/points", "POST", {
            ids: [id],
            with_payload: true,
          });
          if (!existing.length) throw new ApiError("Record not found.", 404);
          payload = mergeRecord(existing[0].payload, payload);
        }
        await request(env, base + "/points?wait=true", "PUT", {
          points: [
            { id, payload, vector: vectors(documentText(payload), env) },
          ],
        });
        return json({ ok: true, id }, match ? 200 : 201);
      }
      return json({ error: "Endpoint or method not found." }, 404);
    } catch (e) {
      return json(
        {
          ok: false,
          error:
            e instanceof ApiError
              ? e.message
              : "The request could not be processed.",
        },
        e instanceof ApiError ? e.status : 500,
      );
    }
  },
};
