// KooKI app: static frontend + API (count/comments in Deno KV). Reset is guarded by TEAM_PASSWORD_SHA256 (env):
// only the hash of the team password is stored anywhere; the input is hashed and compared.
const MAX_COMMENT = 100;
const COMMENTS_SHOWN = 20;
let seq = 0;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function createHandler(kv: Deno.Kv, passwordHash: string) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    const path = new URL(req.url).pathname;

    if (req.method === "GET" && path === "/state") return json(await readState(kv));
    if (req.method === "POST" && path === "/hit") {
      await kv.atomic().sum(["count"], 1n).commit();
      return json({ count: await readCount(kv) });
    }
    if (req.method === "POST" && path === "/comment") return handleComment(kv, req);
    if (req.method === "DELETE" && path.startsWith("/comment/")) return handleDelete(kv, path);
    if (req.method === "DELETE" && path.startsWith("/archive/")) return handleDeleteArchived(kv, path);
    if (req.method === "POST" && path === "/reset") return handleReset(kv, req, passwordHash);
    if (req.method === "GET" && path === "/archive") return handleArchive(kv);
    if (req.method === "GET" && path in STATIC) return serveStatic(path);
    return json({ error: "not found" }, 404);
  };
}

async function handleComment(kv: Deno.Kv, req: Request): Promise<Response> {
  const body = await readJson(req);
  const text = sanitize(body?.text);
  if (!text) return json({ error: "Kommentar darf nicht leer sein" }, 400);
  if (text.length > MAX_COMMENT) return json({ error: `Maximal ${MAX_COMMENT} Zeichen` }, 400);
  const ts = Date.now();
  await kv.set(["comments", ts, seq++], { text, ts }); // seq keeps same-ms comments in insertion order
  return json({ ok: true });
}

// DELETE /comment/<ts>/<seq> – removes exactly one comment (no password, same trust level as adding one).
async function handleDelete(kv: Deno.Kv, path: string): Promise<Response> {
  const m = path.match(/^\/comment\/(\d+)\/(\d+)$/);
  if (!m) return json({ error: "Ungültige Kommentar-ID" }, 400);
  await kv.delete(["comments", Number(m[1]), Number(m[2])]);
  return json({ ok: true });
}

// DELETE /archive/<sprintEnd>/<ts>/<seq> – removes one archived comment.
async function handleDeleteArchived(kv: Deno.Kv, path: string): Promise<Response> {
  const m = path.match(/^\/archive\/(\d+)\/(\d+)\/(\d+)$/);
  if (!m) return json({ error: "Ungültige Archiv-ID" }, 400);
  await kv.delete(["archive", Number(m[1]), Number(m[2]), Number(m[3])]);
  return json({ ok: true });
}

async function handleReset(kv: Deno.Kv, req: Request, passwordHash: string): Promise<Response> {
  const body = await readJson(req);
  const inputHash = await sha256Hex(String(body?.password ?? ""));
  if (!passwordHash || !safeEqual(inputHash, passwordHash.toLowerCase())) {
    return json({ error: "Falsches Passwort" }, 401);
  }
  // Optional: set to a specific value (e.g. migrate an old count). Default: 0.
  const raw = body?.count;
  const count = Number.isInteger(raw) && (raw as number) >= 0 ? Number(raw) : 0;
  await archiveComments(kv); // reads the old count – must run before the counter is overwritten
  await kv.set(["count"], new Deno.KvU64(BigInt(count)));
  return json({ count, comments: [] });
}

// Reset never deletes: comments move to ["archive", <sprintEnd>, <ts>, <id>] with the old count.
async function archiveComments(kv: Deno.Kv) {
  const sprintEnd = Date.now();
  const oldCount = await readCount(kv);
  let moved = 0;
  for await (const e of kv.list<Comment>({ prefix: ["comments"] })) {
    await kv.atomic().set(["archive", sprintEnd, e.key[1], e.key[2]], e.value).delete(e.key).commit();
    moved++;
  }
  if (moved > 0) await kv.set(["sprints", sprintEnd], { sprintEnd, count: oldCount, comments: moved });
}

// Archive as JSON: one entry per finished sprint, newest first. Rendered by archive.html on the frontend origin.
async function handleArchive(kv: Deno.Kv): Promise<Response> {
  const sprints = [];
  for await (const s of kv.list<{ sprintEnd: number; count: number }>({ prefix: ["sprints"] }, { reverse: true })) {
    const comments = [];
    for await (const c of kv.list<Comment>({ prefix: ["archive", s.value.sprintEnd] }, { reverse: true })) {
      comments.push({ ...c.value, id: `${String(c.key[1])}-${String(c.key[2])}-${String(c.key[3])}` });
    }
    sprints.push({ sprintEnd: s.value.sprintEnd, count: s.value.count, comments });
  }
  return json({ sprints });
}

type Comment = { text: string; ts: number };

// Frontend files live next to this script; only these are served.
const STATIC: Record<string, [file: string, type: string]> = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/index.html": ["index.html", "text/html; charset=utf-8"],
  "/app.js": ["app.js", "text/javascript; charset=utf-8"],
  "/style.css": ["style.css", "text/css; charset=utf-8"],
  "/archive.html": ["archive.html", "text/html; charset=utf-8"],
};

async function serveStatic(path: string): Promise<Response> {
  const [file, type] = STATIC[path];
  const body = await Deno.readFile(new URL(`./${file}`, import.meta.url));
  return new Response(body, { headers: { "Content-Type": type, "Cache-Control": "no-cache" } });
}

async function readState(kv: Deno.Kv) {
  const comments = [];
  const iter = kv.list<Comment>({ prefix: ["comments"] }, { reverse: true, limit: COMMENTS_SHOWN });
  for await (const e of iter) comments.push({ ...e.value, id: `${String(e.key[1])}-${String(e.key[2])}` });
  return { count: await readCount(kv), comments };
}

async function readCount(kv: Deno.Kv): Promise<number> {
  const entry = await kv.get<Deno.KvU64>(["count"]);
  return entry.value ? Number(entry.value.value) : 0;
}

// Drop control characters, collapse whitespace, trim.
function sanitize(v: unknown): string {
  if (typeof v !== "string") return "";
  // deno-lint-ignore no-control-regex
  return v.replace(/[\x00-\x1f\x7f]/g, " ").replace(/\s+/g, " ").trim();
}

export async function sha256Hex(s: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a), bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try { return await req.json(); } catch { return null; }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

if (import.meta.main) {
  const kv = await Deno.openKv();
  const passwordHash = Deno.env.get("TEAM_PASSWORD_SHA256") ?? "";
  if (!passwordHash) console.warn("[kooki] TEAM_PASSWORD_SHA256 not set – reset is disabled");
  Deno.serve(createHandler(kv, passwordHash));
}
