import { assertEquals, assertStringIncludes } from "@std/assert";
import { createHandler, sha256Hex } from "./main.ts";

const PW = "test-pw";

async function setup() {
  const kv = await Deno.openKv(":memory:");
  const h = createHandler(kv, await sha256Hex(PW)); // server only ever sees the hash
  const call = (path: string, init?: RequestInit) => h(new Request(`http://x${path}`, init));
  const post = (path: string, body: unknown) =>
    call(path, { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
  return { kv, call, post };
}

Deno.test("hit increments shared count", async () => {
  const { kv, call, post } = await setup();
  await post("/hit", {});
  const res = await post("/hit", {});
  assertEquals((await res.json()).count, 2);
  assertEquals((await (await call("/state")).json()).count, 2);
  kv.close();
});

Deno.test("comment: stored newest first, max 100 chars, not empty", async () => {
  const { kv, call, post } = await setup();
  assertEquals((await post("/comment", { text: "   " })).status, 400);
  assertEquals((await post("/comment", { text: "x".repeat(101) })).status, 400);
  assertEquals((await post("/comment", { text: "x".repeat(100) })).status, 200);
  await post("/comment", { text: "  zweiter \n Kommentar  " });
  const { comments } = await (await call("/state")).json();
  assertEquals(comments.length, 2);
  assertEquals(comments[0].text, "zweiter Kommentar");
  kv.close();
});

Deno.test("reset: needs password, archives comments, optional count", async () => {
  const { kv, call, post } = await setup();
  await post("/hit", {});
  await post("/comment", { text: "hi <b>alt</b>" });
  assertEquals((await post("/reset", { password: "falsch" })).status, 401);
  assertEquals((await post("/reset", {})).status, 401);
  const res = await post("/reset", { password: PW, count: 8 });
  assertEquals(await res.json(), { count: 8, comments: [] });
  const state = await (await call("/state")).json();
  assertEquals(state, { count: 8, comments: [] });
  assertEquals((await (await post("/reset", { password: PW })).json()).count, 0);

  // archived, not deleted – /archive lists the sprint with its old count and comments
  const { sprints } = await (await call("/archive")).json();
  assertEquals(sprints.length, 1);
  assertEquals(sprints[0].count, 1);
  assertEquals(sprints[0].comments.map((c: { text: string }) => c.text), ["hi <b>alt</b>"]);
  kv.close();
});

Deno.test("delete: removes exactly one comment by id", async () => {
  const { kv, call, post } = await setup();
  await post("/comment", { text: "bleibt" });
  await post("/comment", { text: "weg" });
  let { comments } = await (await call("/state")).json();
  const victim = comments.find((c: { text: string }) => c.text === "weg");
  assertEquals((await call(`/comment/${victim.id}`, { method: "DELETE" })).status, 200);
  assertEquals((await call("/comment/abc", { method: "DELETE" })).status, 400);
  ({ comments } = await (await call("/state")).json());
  assertEquals(comments.map((c: { text: string }) => c.text), ["bleibt"]);
  kv.close();
});

Deno.test("static: serves the frontend from the same origin", async () => {
  const { kv, call } = await setup();
  const res = await call("/");
  assertEquals(res.headers.get("content-type"), "text/html; charset=utf-8");
  assertStringIncludes(await res.text(), 'id="monster"');
  assertEquals((await call("/app.js")).headers.get("content-type"), "text/javascript; charset=utf-8");
  assertEquals((await call("/main.ts")).status, 404); // only the three frontend files are exposed
  kv.close();
});

Deno.test("delete archived: removes one archived comment by id", async () => {
  const { kv, call, post } = await setup();
  await post("/comment", { text: "alt-bleibt" });
  await post("/comment", { text: "alt-weg" });
  await post("/reset", { password: PW });
  let { sprints } = await (await call("/archive")).json();
  const victim = sprints[0].comments.find((c: { text: string }) => c.text === "alt-weg");
  assertEquals((await call(`/archive/${victim.id}`, { method: "DELETE" })).status, 200);
  ({ sprints } = await (await call("/archive")).json());
  assertEquals(sprints[0].comments.map((c: { text: string }) => c.text), ["alt-bleibt"]);
  kv.close();
});

Deno.test("delete archived: works for legacy entries with UUID key parts", async () => {
  const { kv, call } = await setup();
  await kv.set(["sprints", 1000], { sprintEnd: 1000, count: 3, comments: 1 });
  await kv.set(["archive", 1000, 900, "0cb7fde9-9aeb-47f2-a836-40b238dd78e2"], { text: "legacy", ts: 900 });
  const { sprints } = await (await call("/archive")).json();
  const id = sprints[0].comments[0].id;
  assertEquals(id, "1000/900/0cb7fde9-9aeb-47f2-a836-40b238dd78e2");
  assertEquals((await call(`/archive/${id}`, { method: "DELETE" })).status, 200);
  assertEquals((await (await call("/archive")).json()).sprints[0].comments, []);
  kv.close();
});
