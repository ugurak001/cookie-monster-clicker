// Cookie Monster Clicker – shared counter + comments on Firebase Realtime Database (no backend, no polling).
import { db, ref, onValue, set, get, push, remove, query, orderByChild, limitToLast, increment, serverTimestamp } from "./db.js?v=13";

const KEY = "cookieMonster.count"; // localStorage cache for instant paint
const COMMENTS_SHOWN = 20;
const MAX_COMMENT = 100;
const countEl = document.getElementById("count");
const monster = document.getElementById("monster");
const hint = document.getElementById("hint");
const bubble = document.getElementById("bubble");
const resetBtn = document.getElementById("reset");
const statusEl = document.getElementById("status");
const commentForm = document.getElementById("comment-form");
const commentInput = document.getElementById("comment-input");
const commentLeft = document.getElementById("comment-left");
const commentsList = document.getElementById("comments-list");
const commentsEmpty = document.getElementById("comments-empty");
const nf = new Intl.NumberFormat("de-DE");
const rtf = new Intl.RelativeTimeFormat("de", { numeric: "auto" });
const canHover = matchMedia("(hover: hover)").matches; // don't pop the keyboard on phones


// Rotating "every time..." lines — a fresh reason with each KooKI.
const LINES = [
  "Immer wenn ich an einem Task arbeite, der nicht im Sprint ist",
  "Immer wenn ein Meeting auch eine E-Mail hätte sein können",
  "Immer wenn jemand \"kurze Frage\" sagt",
  "Immer wenn das Daily 40 Minuten dauert",
  "Immer wenn der Scope schon wieder wächst",
  "Immer wenn aus dem MVP plötzlich 20 Features werden",
  "Immer wenn jemand meinen Fokus-Block überbucht",
  "Immer wenn Freitag um 17 Uhr deployt wird",
  "Immer wenn \"agil\" heißt: kein Plan",
  "Immer wenn jemand die Definition of Done ignoriert",
  "Immer wenn ich \"das mach ich schnell\" sage",
  "Immer wenn das Backlog zum Friedhof wird",
  "Immer wenn \"wir syncen uns kurz\" 90 Minuten dauert",
  "Immer wenn \"kannst du kurz helfen\" zur ganzen Stunde wird",
  "Immer wenn ein Prod-Incident den Sprint entführt",
  "Immer wenn ich im Wiki einem Rabbit Hole folge",
  "Immer wenn Slack drei Threads gleichzeitig aufmacht",
  "Immer wenn ein \"wichtiger\" Stakeholder spontan anruft",
  "Immer wenn ich \"nur schnell\" ein fremdes Repo debugge",
  "Immer wenn eine kurze Abstimmung den halben Nachmittag frisst",
  "Immer wenn ein Ticket ohne Akzeptanzkriterien reinflattert",
  "Immer wenn jemand \"kannst du da mal draufschauen\" sagt",
  // 15-Minuten-Regel – lebt in der Sprechblase, kein extra Element
  "Regel: Eine KooKI gibt's nur für Tasks über 15 Minuten – alles drunter zählt nicht",
  "Unter 15 Minuten reingeklickt? Keine KooKI. So sind die Regeln.",
  "Erst ab 15 Minuten am Nicht-Sprint-Task wandert eine KooKI in meinen Bauch",
];

let count = loadCount();   // instant paint from cache
render();
subscribe();               // live updates: count, comments, connection state

monster.addEventListener("click", (e) => {
  count += 1;
  saveCount();
  render(true);
  chomp();
  jiggleEyes();
  flyCookie(e);
  newBubble();
  hint.classList.add("gone");
  showCommentForm();
  hitServer();  // atomic +1 on the shared counter
});

resetBtn.addEventListener("click", async () => {
  const pw = prompt("Team-Passwort für neuen Sprint (setzt Zähler und Kommentare zurück):");
  if (!pw) return;
  try {
    await resetSprint(await sha256Hex(pw.trim()));
  } catch (err) {
    if (String(err?.message).includes("PERMISSION_DENIED")) { alert("Falsches Passwort."); return; }
    alert("Reset fehlgeschlagen: " + err.message);
  }
});

// Comment: optional short note per KooKI, max 100 chars, shared with everyone.
commentInput.addEventListener("input", updateCommentLeft);
commentForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = commentInput.value.trim();
  if (!text) return;
  commentInput.disabled = true;
  try {
    await push(ref(db, "board/comments"), { text: text.slice(0, MAX_COMMENT), ts: serverTimestamp() });
    commentInput.value = "";
    updateCommentLeft();
  } catch (err) {
    setStatus(false, "Kommentar nicht gespeichert – " + err.message);
  } finally {
    commentInput.disabled = false;
    if (canHover) commentInput.focus();
  }
});

function showCommentForm() {
  if (!commentForm.classList.contains("show")) {
    commentForm.classList.add("show");
    if (canHover) commentInput.focus();
  }
}

function updateCommentLeft() {
  commentLeft.textContent = `${commentInput.value.length}/${MAX_COMMENT}`;
}

function loadCount() {
  const n = parseInt(localStorage.getItem(KEY) ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function saveCount() {
  // Wrapped: localStorage can throw in private mode / on file:// in some browsers.
  try { localStorage.setItem(KEY, String(count)); } catch (_) {}
}

// Live subscriptions – Firebase pushes every change, nobody polls.
function subscribe() {
  onValue(ref(db, "board/count"), (snap) => {
    const n = snap.val();
    if (typeof n === "number") { count = n; saveCount(); render(); }
  }, onDbError);
  const latest = query(ref(db, "board/comments"), orderByChild("ts"), limitToLast(COMMENTS_SHOWN));
  onValue(latest, (snap) => {
    const comments = [];
    snap.forEach((c) => { comments.push({ id: c.key, ...c.val() }); }); // ascending by ts
    renderComments(comments.reverse());
  }, onDbError);
  onValue(ref(db, ".info/connected"), (snap) => {
    setStatus(snap.val() === true, snap.val() === true ? "geteilt · live" : "Verbindung getrennt – Klicks werden nachgeholt");
  });
}

function onDbError(err) {
  console.warn("[cookie] db error:", err);
  setStatus(false, "Zähler-Datenbank nicht erreichbar – " + err.message);
}

// Server-side atomic increment; onValue above renders the authoritative value.
async function hitServer() {
  try {
    await set(ref(db, "board/count"), increment(1));
  } catch (err) {
    console.warn("[cookie] hit failed:", err);
    setStatus(false, "Klick nicht gezählt – " + err.message);
  }
}

// New sprint: comments move to board/archive/<sprintEnd>, count goes to 0. Nothing is deleted.
// Security: board can only be overwritten with resetAuth === secret (see database.rules.json).
// The stored resetAuth of the previous reset blocks all board-level writes, so we clear it first.
async function resetSprint(passwordHash) {
  const [countSnap, commentsSnap, archiveSnap, sprintsSnap] = await Promise.all([
    get(ref(db, "board/count")), get(ref(db, "board/comments")),
    get(ref(db, "board/archive")), get(ref(db, "board/sprints")),
  ]);
  const sprintEnd = Date.now();
  const oldCount = countSnap.val() ?? 0;
  const oldComments = commentsSnap.val() ?? {};
  const archive = archiveSnap.val() ?? {};
  const sprints = sprintsSnap.val() ?? {};
  const moved = Object.keys(oldComments).length;
  if (moved > 0) {
    archive[sprintEnd] = oldComments;
    sprints[sprintEnd] = { sprintEnd, count: oldCount, comments: moved };
  }
  await remove(ref(db, "board/resetAuth"));
  await set(ref(db, "board"), { count: 0, archive, sprints, resetAuth: passwordHash });
  render(true);
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function renderComments(comments) {
  commentsEmpty.hidden = comments.length > 0;
  commentsList.replaceChildren(...comments.map((c) => {
    const li = document.createElement("li");
    const text = document.createElement("span");
    text.className = "c-text";
    text.textContent = c.text;
    const time = document.createElement("time");
    time.dateTime = new Date(c.ts).toISOString();
    time.textContent = relTime(c.ts);
    const del = document.createElement("button");
    del.type = "button";
    del.className = "c-del";
    del.setAttribute("aria-label", "Kommentar löschen");
    del.textContent = "×";
    del.addEventListener("click", () => deleteComment(c.id));
    li.append(text, time, del);
    return li;
  }));
}

// Remove one comment for everyone (id = database key); the live listener re-renders.
async function deleteComment(id) {
  if (!confirm("Diesen Kommentar löschen?")) return;
  try {
    await remove(ref(db, `board/comments/${id}`));
  } catch (err) {
    setStatus(false, "Löschen fehlgeschlagen – " + err.message);
  }
}

function relTime(ts) {
  const min = Math.round((ts - Date.now()) / 60000);
  if (Math.abs(min) < 60) return rtf.format(min, "minute");
  const h = Math.round(min / 60);
  if (Math.abs(h) < 24) return rtf.format(h, "hour");
  return rtf.format(Math.round(h / 24), "day");
}

// Small connectivity indicator so blocked/offline states are visible on screen.
function setStatus(ok, msg) {
  statusEl.textContent = msg || "";
  statusEl.classList.toggle("status--err", !ok);
}

function render(bump = false) {
  countEl.textContent = nf.format(count);
  if (bump) {
    countEl.classList.remove("bump");
    void countEl.offsetWidth; // restart the animation
    countEl.classList.add("bump");
  }
}

function chomp() {
  monster.classList.remove("chomp");
  void monster.offsetWidth;
  monster.classList.add("chomp");
}

function jiggleEyes() {
  document.querySelectorAll(".pupil").forEach((p) => {
    const x = (Math.random() * 2 - 1) * 20;
    const y = (Math.random() * 2 - 1) * 20;
    p.style.transform = `translate(${x}%, ${y}%)`;
  });
}

// Spawn a cookie at the click point and arc it into the monster's mouth.
function flyCookie(e) {
  const cookie = document.createElement("div");
  cookie.className = "cookie-fly";
  cookie.textContent = "🍪";
  document.body.appendChild(cookie);

  const mouth = document.getElementById("mouth").getBoundingClientRect();
  const tx = mouth.left + mouth.width / 2 - 18;
  const ty = mouth.top + mouth.height / 2 - 18;
  const sx = (typeof e.clientX === "number" ? e.clientX : window.innerWidth / 2) - 18;
  const sy = (typeof e.clientY === "number" ? e.clientY : window.innerHeight - 60) - 18;
  const midX = (sx + tx) / 2;
  const midY = Math.min(sy, ty) - 90;

  const anim = cookie.animate(
    [
      { transform: `translate(${sx}px, ${sy}px) scale(1) rotate(0deg)`, opacity: 1 },
      { transform: `translate(${midX}px, ${midY}px) scale(1.15) rotate(200deg)`, opacity: 1, offset: 0.6 },
      { transform: `translate(${tx}px, ${ty}px) scale(0.25) rotate(360deg)`, opacity: 0 },
    ],
    { duration: 480, easing: "cubic-bezier(.35,.1,.35,1)" }
  );
  anim.onfinish = () => cookie.remove();
}

// Pick a new random line (avoid repeating the current one).
function newBubble() {
  let line;
  do {
    line = LINES[Math.floor(Math.random() * LINES.length)];
  } while (line === bubble.textContent && LINES.length > 1);
  bubble.textContent = line;
  bubble.classList.remove("pop");
  void bubble.offsetWidth;
  bubble.classList.add("pop");
}
