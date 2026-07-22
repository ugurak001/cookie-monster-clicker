// Cookie Monster Clicker – frontend only, state persisted in localStorage.
const KEY = "cookieMonster.count";
const countEl = document.getElementById("count");
const monster = document.getElementById("monster");
const hint = document.getElementById("hint");
const bubble = document.getElementById("bubble");
const resetBtn = document.getElementById("reset");
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
  "Immer wenn die Retro nichts ändert",
];

let count = loadCount();
render();

monster.addEventListener("click", (e) => {
  count += 1;
  saveCount();
  render(true);
  chomp();
  jiggleEyes();
  flyCookie(e);
  newBubble();
  hint.classList.add("gone");
});

resetBtn.addEventListener("click", () => {
  if (!confirm("Zähler wirklich auf 0 zurücksetzen?")) return;
  count = 0;
  saveCount();
  render(true);
});

function loadCount() {
  const n = parseInt(localStorage.getItem(KEY) ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function saveCount() {
  // Wrapped: localStorage can throw in private mode / on file:// in some browsers.
  try { localStorage.setItem(KEY, String(count)); } catch (_) {}
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
