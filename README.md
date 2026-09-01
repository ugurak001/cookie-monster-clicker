# Krümelmonster – KooKI-Zähler

Ein minimalistischer Klick-Zähler: Klick das Krümelmonster, es isst eine KooKI
(Keks + KI), der Zähler steigt. Reines Frontend (HTML/CSS/JS), kein Framework, kein Build.
Der Zählerstand und die Kommentare sind **für alle gleich** – sie liegen in einem
kleinen Deno-Deploy-Backend (`server/`, Deno KV). localStorage dient nur als Cache
für sofortiges Anzeigen.

## Funktionen

- Klick aufs Monster → +1 auf den geteilten Zähler.
- Nach dem Klick erscheint ein Kommentarfeld: „Warum diese KooKI?“ (optional, max. 100 Zeichen).
  Enter oder „Speichern“ legt den Kommentar für alle sichtbar ab.
- Rechts neben dem Monster (mobil darunter) stehen die letzten 20 Kommentare, alle 5 s aktualisiert.
- **Reset** (neuer Sprint) setzt den Zähler zurück – nur mit Team-Passwort. Kommentare werden
  dabei nicht gelöscht, sondern archiviert und sind unter `/archive` (Link „Ältere Sprints“) einsehbar.

## Lokal starten

Backend (Port 8000):

```
cd server
TEAM_PASSWORD=test deno task dev
```

Frontend: `index.html` über einen kleinen Server öffnen (auf `localhost` spricht die
App automatisch mit `http://localhost:8000`):

```
python3 -m http.server 8080
```

Dann http://localhost:8080 öffnen. Tests: `cd server && deno task test`.

## Deploy

**Frontend** – GitHub Pages: Settings → Pages → Branch `main`, Ordner `/ (root)`.
Live unter `https://<user>.github.io/<repo>/`.

**Backend** – Deno Deploy (kostenlos, Login mit GitHub):

```
cd server
deno deploy create            # einmalig: App anlegen (interaktiv)
deno deploy database provision kooki-kv --kind denokv
deno deploy database assign kooki-kv --app <app-name>
deno deploy env add --secret TEAM_PASSWORD '<geheim>'
deno deploy --prod            # bei jeder Änderung in server/
```

Die URL der App in `app.js` unter `API` eintragen.

## Geheimnisse

Im Repo liegt **kein** Passwort und kein API-Key. Das Team-Passwort ist ausschließlich
eine Env-Variable auf Deno Deploy (`TEAM_PASSWORD`) und wird serverseitig geprüft.
Ändern: `deno deploy env update-value TEAM_PASSWORD '<neu>'`.

Zählerstand manuell setzen (z. B. nach Migration):

```
curl -X POST https://<app>.deno.net/reset \
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
