import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { createHandler } from "./main.ts";

const PW = "test-pw";

async function setup() {
  const kv = await Deno.openKv(":memory:");
  const h = createHandler(kv, PW);
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

  // archived, not deleted – visible on /archive with the old count, HTML-escaped
  const html = await (await call("/archive")).text();
  assertStringIncludes(html, "hi &lt;b&gt;alt&lt;/b&gt;");
  assertStringIncludes(html, "· 1 KooKIs");
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
