# Changelog / Release Notes

Alle nennenswerten Änderungen am Krümelmonster-KooKI-Zähler. Format angelehnt an
[Keep a Changelog](https://keepachangelog.com/de/1.1.0/), Versionen nach SemVer.

## [2.0.0] – 2026-09-01

Großer Umbau: eigenes Backend statt Zähler-API, Kommentare, keine Geheimnisse mehr im Repo.

### Hinzugefügt
- **Kommentar pro KooKI**: Nach jedem Klick erscheint ein Feld „Warum diese KooKI?“ (optional,
  max. 100 Zeichen, server- und clientseitig geprüft). Die letzten 20 Kommentare stehen rechts
  neben dem Monster (mobil darunter) und werden alle 5 s aktualisiert.
- **Kommentare löschen**: „×“ an jedem Kommentar (aktuell und archiviert), mit Rückfrage,
  ohne Passwort – gleiche Vertrauensstufe wie das Anlegen.
- **Archiv statt Löschen beim Reset**: Ein Reset (neuer Sprint) verschiebt die Kommentare mit dem
  alten Zählerstand ins Archiv. Einsehbar über „Ältere Sprints →“ (`archive.html`), das die Daten
  per API holt – bleibt damit unter der eigenen URL (kein Sprung auf eine fremde Domain, der
  Sicherheitsfilter auslöst).
- **Backend** `main.ts` auf Deno Deploy mit Deno KV (Org `ugurak001`, App `kooki-zaehler`,
  KV `kooki-kv`). Liefert Frontend und API aus, siehe README → API.
- Tests (`deno task test`, 7 Tests) für Zähler, Kommentare, Reset/Archiv, Löschen, Static-Serving.

### Geändert
- **Abacus-Zähler-API entfernt** – Zähler liegt jetzt atomar in Deno KV. Zählerstand 8 aus Abacus
  übernommen.
- **Team-Passwort nur noch als SHA-256-Hash** in der Deno-Deploy-Env-Variable
  `TEAM_PASSWORD_SHA256`. Der Server hasht die Eingabe und vergleicht zeitkonstant. Das Passwort
  steht nirgends im Klartext (weder Repo, noch Deploy-Konsole, noch Keychain).
- `app.js` spricht same-origin mit dem Backend; nur die GitHub-Pages-Kopie
  (`ugurak001.github.io/cookie-monster-clicker`, weiterhin die Haupt-URL fürs Team) spricht
  cross-origin (CORS `*`).
- Kommentar-Schlüssel deterministisch (`[ts, laufende Nummer]` statt UUID) – Reihenfolge bei
  gleichem Millisekunden-Tick stabil; alte Archiv-Einträge mit UUID bleiben löschbar.
- `body { overflow-y: auto }`, damit die Kommentarliste mobil erreichbar ist.

### Sicherheit
- **Git-History bereinigt** (`git filter-repo`): alter Abacus-Admin-Key und altes Klartext-Passwort
  aus allen Commits und Commit-Messages entfernt, Force-Push am 2026-09-01. GitHub kann alte
  Objekte noch eine Weile cachen; beide Werte sind ohnehin wirkungslos, da Abacus nicht mehr
  genutzt wird.
- Nur `index.html`, `app.js`, `style.css`, `archive.html` werden statisch ausgeliefert
  (`main.ts` → 404).

### Betrieb
- Deploy: `export DENO_DEPLOY_TOKEN="$(security find-generic-password -s deno-deploy-token -w)" && deno deploy --prod`
- Passwort ändern: `deno deploy env update-value TEAM_PASSWORD_SHA256 "$(printf '%s' '<neu>' | shasum -a 256 | cut -d' ' -f1)"`
- Zählerstand setzen: `POST /reset` mit `{"password": "...", "count": N}` (archiviert dabei die
  aktuellen Kommentare).

## [1.2.0] – 2026-07-22
- Geteilter Zähler über die Abacus Counter-API (`get`/`hit`/`reset`), Polling alle 5 s.
- Reset per Team-Passwort (statt Admin-Token im Prompt).
- Sichtbare Status-Anzeige (Zähler-Server erreichbar?), Cache-Busting der Assets.

## [1.1.0] – 2026-07-22
- Sprechblase mit rotierenden „Immer wenn …“-Sprüchen, KooKI-Naming, Reset-Button.
- 15-Minuten-Regel in der Sprechblase, Sprint-Framing im Zähler-Label.

## [1.0.0] – 2026-07-22
- MVP: Krümelmonster-Keks-Zähler, frontend-only, localStorage.
