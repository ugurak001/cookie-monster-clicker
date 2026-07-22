// Cookie Monster Clicker – shared counter via Abacus API (frontend only, GitHub Pages).
const KEY = "cookieMonster.count"; // localStorage cache for instant paint

// Shared counter (Abacus) – same number for everyone who opens the link.
const API = "https://abacus.jasoncameron.dev";
const NS = "cookie-monster-ugurak001";
const CKEY = "sprint-kookis-v2";
// Reset needs Abacus' admin key. It sits in the frontend, so it's public —
// fine for a fun counter; the team password below is just a "don't click by accident" guard.
const ADMIN_KEY = "***REMOVED-ADMIN-KEY***";
const TEAM_PASSWORD = "***REMOVED-PASSWORD***";
const HIT_URL = `${API}/hit/${NS}/${CKEY}`;
const GET_URL = `${API}/get/${NS}/${CKEY}`;
const RESET_URL = `${API}/reset/${NS}/${CKEY}`;
const POLL_MS = 5000;
let pendingHits = 0;
const countEl = document.getElementById("count");
const monster = document.getElementById("monster");
const hint = document.getElementById("hint");
const bubble = document.getElementById("bubble");
const resetBtn = document.getElementById("reset");
const statusEl = document.getElementById("status");
const nf = new Intl.NumberFormat("de-DE");

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
syncFromServer();          // fetch the real shared value
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
  hitServer();  // count on the shared counter (authoritative)
});

resetBtn.addEventListener("click", async () => {
  const pw = prompt("Team-Passwort für neuen Sprint (setzt den geteilten Zähler auf 0):");
  if (!pw) return;
  if (pw.trim() !== TEAM_PASSWORD) {
    alert("Falsches Passwort.");
    return;
  }
  try {
    const res = await fetch(RESET_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${ADMIN_KEY}` },
    });
    if (!res.ok) throw new Error("Zähler-Server hat abgelehnt (HTTP " + res.status + ")");
    const data = await res.json();
    count = typeof data.value === "number" ? data.value : 0;
    saveCount();
    render(true);
  } catch (err) {
    alert("Reset fehlgeschlagen: " + err.message);
  }
});

function loadCount() {
  const n = parseInt(localStorage.getItem(KEY) ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function saveCount() {
  // Wrapped: localStorage can throw in private mode / on file:// in some browsers.
  try { localStorage.setItem(KEY, String(count)); } catch (_) {}
}

// Read the shared count from Abacus and show it (source of truth).
async function syncFromServer() {
  if (pendingHits > 0) return; // don't stomp an optimistic value mid-click
  try {
    const res = await fetch(GET_URL, { cache: "no-store" });
    if (!res.ok) { setStatus(false, "Zähler-Server antwortet nicht (HTTP " + res.status + ")"); return; }
    const data = await res.json();
    if (typeof data.value === "number") { count = data.value; saveCount(); render(); setStatus(true, "geteilt · live"); }
  } catch (err) {
    console.warn("[cookie] sync failed:", err);
    setStatus(false, "Zähler-Server nicht erreichbar – evtl. Adblocker/Tracking-Schutz");
  }
}

// Increment the shared counter; the response is authoritative (includes others' clicks).
async function hitServer() {
  pendingHits++;
  try {
    const res = await fetch(HIT_URL, { cache: "no-store" });
    if (!res.ok) { setStatus(false, "Klick nicht gezählt (HTTP " + res.status + ")"); return; }
    const data = await res.json();
    if (typeof data.value === "number") { count = data.value; saveCount(); render(); setStatus(true, "geteilt · live"); }
  } catch (err) {
    console.warn("[cookie] hit failed:", err);
    setStatus(false, "Klick nicht gezählt – Zähler-Server blockiert/nicht erreichbar");
  } finally { pendingHits--; }
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
