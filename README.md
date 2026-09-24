# Krümelmonster – KooKI-Zähler

Ein minimalistischer Klick-Zähler: Klick das Krümelmonster, es isst eine KooKI
(Keks + KI), der Zähler steigt. Frontend ohne Framework und Build (HTML/CSS/JS), Daten in
**Firebase Realtime Database** – kein eigenes Backend, kein Polling: jede Änderung wird live
an alle offenen Tabs gepusht.

- **Team-URL:** https://ugurak001.github.io/cookie-monster-clicker/ (GitHub Pages)
- **Datenbank:** Firebase-Projekt (Spark-Plan, kostenlos, keine Zahlungsmethode), Realtime Database
- Änderungshistorie: [CHANGELOG.md](CHANGELOG.md)

Zähler und Kommentare sind für alle gleich; localStorage dient nur als Cache für
sofortiges Anzeigen.

## Funktionen

- Klick aufs Monster → +1 auf den geteilten Zähler (atomarer Server-Increment).
- Nach dem Klick erscheint ein Kommentarfeld: „Warum diese KooKI?“ (optional, max. 100 Zeichen).
  Enter oder „Speichern“ legt den Kommentar für alle sichtbar ab.
- Rechts neben dem Monster (mobil darunter) stehen die letzten 20 Kommentare, live.
  Jeder Kommentar hat ein „×“ zum Löschen (für alle, ohne Passwort).
- **Reset** (neuer Sprint) setzt den Zähler zurück – nur mit Team-Passwort. Kommentare werden
  dabei nicht gelöscht, sondern archiviert und unter `archive.html` (Link „Ältere Sprints“) einsehbar –
  dort ebenfalls einzeln per „×“ löschbar.

## Dateien

| Datei | Zweck |
|---|---|
| `index.html`, `app.js`, `style.css` | Zähler-Seite |
| `archive.html` | Ältere Sprints |
| `db.js` | Firebase-Init, gemeinsam für beide Seiten (SDK per CDN, Version in der Import-URL) |
| `firebase-config.js` | Öffentliche Web-App-Config aus der Firebase-Konsole (kein Geheimnis) |
| `database.rules.json` | Security Rules – die eigentliche Zugriffskontrolle, in der Konsole einspielen |
| `archive/deno-backend/` | Altes Deno-Backend (v2.x), nur noch zur Referenz |

## Datenmodell

```
board/
  count                     Zahl – nur +1 (Klick) oder per Reset
  comments/<key>            {text, ts} – anlegen/löschen für alle
  archive/<sprintEnd>/<key> {text, ts} – nur löschen für alle, angelegt nur per Reset
  sprints/<sprintEnd>       {sprintEnd, count, comments} – nur per Reset
  resetAuth                 Hash des letzten Resets (nicht lesbar), sperrt board-Überschreiben
secret                      SHA-256 des Team-Passworts (nicht lesbar, nicht schreibbar)
```

Reset im Browser: Passwort → SHA-256 → `board/resetAuth` löschen → `board` komplett neu
schreiben (Kommentare ins Archiv, `count` 0, `resetAuth` = Hash). Die Rules erlauben das
Überschreiben von `board` nur, wenn der mitgeschickte Hash `secret` entspricht. Falsches
Passwort → `PERMISSION_DENIED`.

## Einrichten (einmalig)

1. https://console.firebase.google.com → Projekt anlegen (Google Analytics aus).
2. Build → Realtime Database → Datenbank erstellen, Region `europe-west1`, Modus egal (Rules kommen gleich).
3. Rules-Tab → Inhalt von `database.rules.json` einfügen → Veröffentlichen.
4. Daten-Tab → ⋮ → JSON importieren → `firebase-import.json` (enthält Zähler, Kommentare und den
   Passwort-Hash unter `secret`; die Datei ist per `.gitignore` vom Repo ausgeschlossen).
5. Projektübersicht → Web-App hinzufügen (`</>`) → die `firebaseConfig` nach `firebase-config.js` kopieren.
6. `git push` → GitHub Pages.

## Lokal starten

Beliebiger statischer Server im Repo-Root, z. B. `python3 -m http.server 8000`, dann
http://localhost:8000. Es wird die echte Datenbank benutzt (kein Emulator).

## Deploy

`git push origin main` → GitHub Pages (Branch `main`, Root). Pages cached 10 Minuten – bei
Änderungen an `app.js`/`db.js`/`style.css` den `?v=`-Parameter in `index.html`, `archive.html`
und im `db.js`-Import hochzählen.

## Geheimnisse

Das Team-Passwort steht **nirgends im Klartext** – weder im Repo noch in Firebase.
Gespeichert ist nur sein SHA-256-Hash unter `secret` (per Rules weder lesbar noch schreibbar).
Ändern: in der Konsole (Daten-Tab) den Wert von `secret` ersetzen:

```
printf '%s' '<neu>' | shasum -a 256 | cut -d' ' -f1
```

Der API-Key in `firebase-config.js` ist öffentlich und kein Geheimnis – Zugriff regeln allein
die Security Rules.

## Free-Tier-Limits (Spark)

100 gleichzeitige Verbindungen, 1 GB Speicher, 10 GB Download/Monat. Ein Team-Zähler
bleibt weit darunter; bei Überschreitung wird gedrosselt, es entstehen keine Kosten.
