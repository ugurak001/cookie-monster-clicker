# Krümelmonster – KooKI-Zähler

Ein minimalistischer Klick-Zähler: Klick das Krümelmonster, es isst eine KooKI
(Keks + KI), der Zähler steigt. Frontend ohne Framework und Build (HTML/CSS/JS), dazu
ein ~150-Zeilen-Backend (`main.ts`, Deno KV), das die Frontend-Dateien gleich mit ausliefert.

- **Team-URL:** https://ugurak001.github.io/cookie-monster-clicker/ (GitHub Pages, Frontend)
- **Backend + Zweit-URL:** https://kooki-zaehler.ugurak001.deno.net (Deno Deploy, Frontend + API)
- Änderungshistorie: [CHANGELOG.md](CHANGELOG.md)

Zähler und Kommentare sind für alle gleich; localStorage dient nur als Cache für
sofortiges Anzeigen.

## Funktionen

- Klick aufs Monster → +1 auf den geteilten Zähler.
- Nach dem Klick erscheint ein Kommentarfeld: „Warum diese KooKI?“ (optional, max. 100 Zeichen).
  Enter oder „Speichern“ legt den Kommentar für alle sichtbar ab.
- Rechts neben dem Monster (mobil darunter) stehen die letzten 20 Kommentare, alle 5 s aktualisiert.
  Jeder Kommentar hat ein „×“ zum Löschen (für alle, ohne Passwort).
- **Reset** (neuer Sprint) setzt den Zähler zurück – nur mit Team-Passwort. Kommentare werden
  dabei nicht gelöscht, sondern archiviert und unter `archive.html` (Link „Ältere Sprints“) einsehbar –
  dort ebenfalls einzeln per „×“ löschbar.

## Lokal starten

```
TEAM_PASSWORD_SHA256="$(printf '%s' 'test' | shasum -a 256 | cut -d' ' -f1)" deno task dev
```

Dann http://localhost:8000 öffnen (Frontend + API); Reset-Passwort lokal ist `test`.
Tests: `deno task test`, Lint: `deno lint main.ts main_test.ts`.

## Deploy (Deno Deploy, kostenlos, Login mit GitHub)

Einmalig eingerichtet: Org `ugurak001`, App `kooki-zaehler`, KV-Datenbank `kooki-kv`,
Secret `TEAM_PASSWORD_SHA256`. Bei jeder Änderung im Repo-Root:

```
export DENO_DEPLOY_TOKEN="$(security find-generic-password -s deno-deploy-token -w)"
deno deploy --prod
```

Neu aufsetzen (falls nötig):

```
deno deploy create --source local --runtime-mode dynamic --entrypoint main.ts --region eu --app kooki-zaehler
deno deploy database provision kooki-kv --kind denokv
deno deploy database assign kooki-kv --app kooki-zaehler
deno deploy env add --secret TEAM_PASSWORD_SHA256 "$(printf '%s' '<geheim>' | shasum -a 256 | cut -d' ' -f1)"
deno deploy --prod
```

Frontend-Änderungen gehen zusätzlich per `git push` live (GitHub Pages, Branch `main`, Root).
Pages cached 10 Minuten – bei Änderungen an `app.js`/`style.css` den `?v=`-Parameter in
`index.html` und `archive.html` hochzählen.

## Geheimnisse

Das Team-Passwort steht **nirgends im Klartext** – weder im Repo noch bei Deno Deploy.
Gespeichert ist nur sein SHA-256-Hash (Env-Variable `TEAM_PASSWORD_SHA256`); der Server
hasht die Eingabe und vergleicht. Ändern:

```
deno deploy env update-value TEAM_PASSWORD_SHA256 "$(printf '%s' '<neu>' | shasum -a 256 | cut -d' ' -f1)"
```

Zählerstand manuell setzen (z. B. nach Migration):

```
curl -X POST https://kooki-zaehler.ugurak001.deno.net/reset \
  -H 'Content-Type: application/json' \
  -d '{"password":"<geheim>","count":8}'
```

## API

| Methode | Pfad       | Beschreibung                                            |
|---------|------------|---------------------------------------------------------|
| GET     | `/state`   | `{count, comments:[{text, ts, id}]}` – letzte 20 Kommentare |
| POST    | `/hit`     | Zähler +1, gibt `{count}` zurück                        |
| POST    | `/comment` | `{text}` (1–100 Zeichen)                                |
| DELETE  | `/comment/{ts}/{seq}` | einen Kommentar löschen (`id` aus `/state` = `ts/seq`) |
| DELETE  | `/archive/{sprintEnd}/{ts}/{seq}` | einen archivierten Kommentar löschen (`id` aus `/archive`) |
| POST    | `/reset`   | `{password, count?}` – setzt Zähler (default 0), archiviert Kommentare |
| GET     | `/archive` | JSON `{sprints:[{sprintEnd, count, comments}]}` – wird von `archive.html` gerendert |
| GET     | `/`, `/app.js`, `/style.css`, `/archive.html` | Frontend             |
