// Cookie Monster Clicker – shared counter + comments via small Deno Deploy backend (see server/).
const KEY = "cookieMonster.count"; // localStorage cache for instant paint

// Backend: count + comments live in Deno KV; reset is checked server-side against TEAM_PASSWORD.
const IS_LOCAL = ["localhost", "127.0.0.1"].includes(location.hostname);
const API = IS_LOCAL ? "http://localhost:8000" : "https://kooki-zaehler.ugurak001.deno.net";
const POLL_MS = 5000;
const MAX_COMMENT = 100;
let pendingHits = 0;
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
document.getElementById("archive-link").href = `${API}/archive`;

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
syncFromServer();          // fetch the real shared value + comments
setInterval(syncFromServer, POLL_MS);  // reflect other people's clicks

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
  hitServer();  // count on the shared counter (authoritative)
});

resetBtn.addEventListener("click", async () => {
  const pw = prompt("Team-Passwort für neuen Sprint (setzt Zähler und Kommentare zurück):");
  if (!pw) return;
  try {
    const res = await fetch(`${API}/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw.trim() }),
    });
    if (res.status === 401) { alert("Falsches Passwort."); return; }
    if (!res.ok) throw new Error("Server hat abgelehnt (HTTP " + res.status + ")");
    applyState(await res.json(), true);
  } catch (err) {
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
    const res = await fetch(`${API}/comment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "HTTP " + res.status);
    }
    commentInput.value = "";
    updateCommentLeft();
    await syncFromServer();
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

// Read the shared state (count + comments) and show it (source of truth).
async function syncFromServer() {
  if (pendingHits > 0) return; // don't stomp an optimistic value mid-click
  try {
    const res = await fetch(`${API}/state`, { cache: "no-store" });
    if (!res.ok) { setStatus(false, "Zähler-Server antwortet nicht (HTTP " + res.status + ")"); return; }
    applyState(await res.json());
  } catch (err) {
    console.warn("[cookie] sync failed:", err);
    setStatus(false, "Zähler-Server nicht erreichbar – evtl. Adblocker/Tracking-Schutz");
  }
}

// Increment the shared counter; the response is authoritative (includes others' clicks).
async function hitServer() {
  pendingHits++;
  try {
    const res = await fetch(`${API}/hit`, { method: "POST", cache: "no-store" });
    if (!res.ok) { setStatus(false, "Klick nicht gezählt (HTTP " + res.status + ")"); return; }
    applyState(await res.json());
  } catch (err) {
    console.warn("[cookie] hit failed:", err);
    setStatus(false, "Klick nicht gezählt – Zähler-Server blockiert/nicht erreichbar");
  } finally { pendingHits--; }
}

function applyState(data, bump = false) {
  if (typeof data.count === "number") { count = data.count; saveCount(); render(bump); }
  if (Array.isArray(data.comments)) renderComments(data.comments);
  setStatus(true, "geteilt · live");
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
    li.append(text, time);
    return li;
  }));
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
