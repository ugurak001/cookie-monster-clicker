// KooKI counter backend: shared count + comments in Deno KV, reset guarded by TEAM_PASSWORD (env).
const MAX_COMMENT = 100;
const COMMENTS_SHOWN = 20;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function createHandler(kv: Deno.Kv, teamPassword: string) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    const path = new URL(req.url).pathname;

    if (req.method === "GET" && path === "/state") return json(await readState(kv));
    if (req.method === "POST" && path === "/hit") {
      await kv.atomic().sum(["count"], 1n).commit();
      return json({ count: await readCount(kv) });
    }
    if (req.method === "POST" && path === "/comment") return handleComment(kv, req);
    if (req.method === "POST" && path === "/reset") return handleReset(kv, req, teamPassword);
    if (req.method === "GET" && path === "/archive") return handleArchive(kv);
    return json({ error: "not found" }, 404);
  };
}

async function handleComment(kv: Deno.Kv, req: Request): Promise<Response> {
  const body = await readJson(req);
  const text = sanitize(body?.text);
  if (!text) return json({ error: "Kommentar darf nicht leer sein" }, 400);
  if (text.length > MAX_COMMENT) return json({ error: `Maximal ${MAX_COMMENT} Zeichen` }, 400);
  const ts = Date.now();
  await kv.set(["comments", ts, crypto.randomUUID()], { text, ts });
  return json({ ok: true });
}

async function handleReset(kv: Deno.Kv, req: Request, teamPassword: string): Promise<Response> {
  const body = await readJson(req);
  if (!teamPassword || !safeEqual(String(body?.password ?? ""), teamPassword)) {
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

// Human-readable archive page: one section per finished sprint, newest first.
async function handleArchive(kv: Deno.Kv): Promise<Response> {
  const sections: string[] = [];
  for await (const s of kv.list<{ sprintEnd: number; count: number }>({ prefix: ["sprints"] }, { reverse: true })) {
    const items: string[] = [];
    for await (const c of kv.list<Comment>({ prefix: ["archive", s.value.sprintEnd] }, { reverse: true })) {
      items.push(`<li>${esc(c.value.text)} <small>${fmtDate(c.value.ts)}</small></li>`);
    }
    sections.push(`<h2>Sprint bis ${fmtDate(s.value.sprintEnd)} · ${s.value.count} KooKIs</h2><ul>${items.join("")}</ul>`);
  }
  const body = sections.length ? sections.join("") : "<p>Noch kein abgeschlossener Sprint.</p>";
  const html = `<!doctype html><html lang="de"><meta charset="utf-8"><title>KooKI-Archiv</title>
<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:2rem auto;padding:0 1rem;color:#3b2f1e;background:#fff7e6}
h2{font-size:1rem;margin-top:1.5rem}ul{padding-left:1.2rem}li{margin:.3rem 0}small{opacity:.55;margin-left:.4rem}</style>
<h1>KooKI-Archiv</h1>${body}`;
  return new Response(html, { headers: { ...CORS, "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

type Comment = { text: string; ts: number };

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "medium", timeStyle: "short" });
}

async function readState(kv: Deno.Kv) {
  const comments = [];
  const iter = kv.list<Comment>({ prefix: ["comments"] }, { reverse: true, limit: COMMENTS_SHOWN });
  for await (const e of iter) comments.push(e.value);
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
  const password = Deno.env.get("TEAM_PASSWORD") ?? "";
  if (!password) console.warn("[kooki] TEAM_PASSWORD not set – reset is disabled");
  Deno.serve(createHandler(kv, password));
}
