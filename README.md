# Krümelmonster – KooKI-Zähler

Ein minimalistischer Klick-Zähler: Klick das Krümelmonster, es isst eine KooKI
(Keks + KI), der Zähler steigt. Frontend ohne Framework und Build (HTML/CSS/JS), dazu
ein ~100-Zeilen-Backend (`main.ts`, Deno KV), das die drei Frontend-Dateien gleich mit
ausliefert – **alles unter einer URL**: https://kooki-zaehler.ugurak001.deno.net

Zähler und Kommentare sind für alle gleich; localStorage dient nur als Cache für
sofortiges Anzeigen.

## Funktionen

- Klick aufs Monster → +1 auf den geteilten Zähler.
- Nach dem Klick erscheint ein Kommentarfeld: „Warum diese KooKI?“ (optional, max. 100 Zeichen).
  Enter oder „Speichern“ legt den Kommentar für alle sichtbar ab.
- Rechts neben dem Monster (mobil darunter) stehen die letzten 20 Kommentare, alle 5 s aktualisiert.
- **Reset** (neuer Sprint) setzt den Zähler zurück – nur mit Team-Passwort. Kommentare werden
  dabei nicht gelöscht, sondern archiviert und sind unter `/archive` (Link „Ältere Sprints“) einsehbar.

## Lokal starten

```
TEAM_PASSWORD=test deno task dev
```

Dann http://localhost:8000 öffnen (Frontend + API). Tests: `deno task test`.

## Deploy (Deno Deploy, kostenlos, Login mit GitHub)

Einmalig eingerichtet: Org `ugurak001`, App `kooki-zaehler`, KV-Datenbank `kooki-kv`,
Secret `TEAM_PASSWORD`. Bei jeder Änderung im Repo-Root:

```
export DENO_DEPLOY_TOKEN="$(security find-generic-password -s deno-deploy-token -w)"
deno deploy --prod
```

Neu aufsetzen (falls nötig):

```
deno deploy create --source local --runtime-mode dynamic --entrypoint main.ts --region eu --app kooki-zaehler
deno deploy database provision kooki-kv --kind denokv
deno deploy database assign kooki-kv --app kooki-zaehler
deno deploy env add --secret TEAM_PASSWORD '<geheim>'
deno deploy --prod
```

Die alte GitHub-Pages-Kopie (`https://ugurak001.github.io/cookie-monster-clicker/`) funktioniert
weiter und spricht cross-origin mit demselben Backend.

## Geheimnisse

Im Repo liegt **kein** Passwort und kein API-Key. Das Team-Passwort ist ausschließlich
eine Env-Variable auf Deno Deploy (`TEAM_PASSWORD`) und wird serverseitig geprüft.
Ändern: `deno deploy env update-value TEAM_PASSWORD '<neu>'`.

Zählerstand manuell setzen (z. B. nach Migration):

```
curl -X POST https://kooki-zaehler.ugurak001.deno.net/reset \
  -H 'Content-Type: application/json' \
  -d '{"password":"<geheim>","count":8}'
```

## API

| Methode | Pfad       | Beschreibung                                            |
|---------|------------|---------------------------------------------------------|
| GET     | `/state`   | `{count, comments:[{text, ts}]}` – letzte 20 Kommentare |
| POST    | `/hit`     | Zähler +1, gibt `{count}` zurück                        |
| POST    | `/comment` | `{text}` (1–100 Zeichen)                                |
| POST    | `/reset`   | `{password, count?}` – setzt Zähler (default 0), archiviert Kommentare |
| GET     | `/archive` | HTML-Seite: alle abgeschlossenen Sprints mit ihren Kommentaren |
| GET     | `/`, `/app.js`, `/style.css` | Frontend                              |
