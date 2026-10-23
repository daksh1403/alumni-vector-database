export class ApiError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}
export const collection = (env) => env.QDRANT_COLLECTION || "alumni_network_v1";
export const model = (env) =>
  env.EMBEDDING_MODEL || "sentence-transformers/all-minilm-l6-v2";
export async function request(
  env,
  path,
  method = "GET",
  body,
  fetcher = fetch,
) {
  if (!env.QDRANT_URL || !env.QDRANT_API_KEY)
    throw new ApiError("Qdrant is not configured.", 503);
  let url;
  try {
    url = new URL(env.QDRANT_URL);
  } catch {
    throw new ApiError("Invalid Qdrant HTTPS origin.", 503);
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw new ApiError("Invalid Qdrant HTTPS origin.", 503);
  let r;
  try {
    r = await fetcher(url.origin + path, {
      method,
      redirect: "manual",
      signal: AbortSignal.timeout(25000),
      headers: {
        "api-key": env.QDRANT_API_KEY,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new ApiError("The search service is temporarily unreachable.", 503);
  }
  if (r.status === 401 || r.status === 403)
    throw new ApiError("The database rejected the server credentials.", 503);
  if (r.status === 404)
    throw new ApiError("Record or collection not found.", 404);
  if (!r.ok)
    throw new ApiError(
      r.status === 429
        ? "Search capacity reached. Please retry shortly."
        : "The database could not complete the request.",
      r.status === 429 ? 429 : 502,
    );
  const raw = await r.text();
  if (raw.length > 4 * 1024 * 1024)
    throw new ApiError("Database response exceeded the size limit.");
  let j;
  try {
    j = JSON.parse(raw);
  } catch {
    throw new ApiError("Invalid database response.");
  }
  if (j.status !== "ok") throw new ApiError("The database operation failed.");
  return j.result;
}
export function vectors(text, env = {}) {
  return {
    dense: { text, model: model(env) },
    bm25: { text, model: "qdrant/bm25" },
  };
}
