import { ApiError } from './qdrant.js';

export const json = (x, status = 200) =>
  Response.json(x, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });

export async function body(req) {
  const cl = Number(req.headers.get('Content-Length'));
  if (cl > 65536) throw new ApiError('Request too large.', 413);

  const reader = req.body?.getReader();
  if (!reader) throw new ApiError('JSON body required.', 400);

  let size = 0;
  const chunks = [];

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 65536) {
      await reader.cancel();
      throw new ApiError('Request too large.', 413);
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
    const raw = new TextDecoder().decode(bytes);
    const j = JSON.parse(raw);
    if (!j || typeof j !== 'object' || Array.isArray(j)) throw Error();
    return j;
  } catch {
    throw new ApiError('Valid JSON object required.', 400);
  }
}

export async function admin(req, env) {
  const token = req.headers.get('Authorization') || '';
  if (!env.VECTOR_ADMIN_TOKEN || !token.startsWith('Bearer ')) return false;

  const hash = async v =>
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v)));

  const a = await hash(token.slice(7));
  const b = await hash(env.VECTOR_ADMIN_TOKEN);

  let n = 0;
  for (let i = 0; i < a.length; i++) n |= a[i] ^ b[i];
  return n === 0;
}

export const titleCase = s =>
  typeof s === 'string'
    ? s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
    : '';
