# Krümelmonster – KooKI-Zähler

Ein Team-Zähler für Arbeit, die nicht im Sprint steht. Wer länger als 15 Minuten an etwas
Ungeplantem hängt (spontaner Anruf, „kannst du mal draufschauen“, Prod-Incident …), klickt aufs
Krümelmonster: Es isst eine KooKI (Keks + KI), der Zähler steigt. Am Sprint-Ende sieht das Team
schwarz auf weiß, wie viel Zeit der Sprint an Unterbrechungen verloren hat.

**Live:** https://ugurak001.github.io/cookie-monster-clicker/

## Funktionen

- **Klick aufs Monster** → +1 auf den gemeinsamen Zähler, live in allen offenen Tabs.
- **Kommentar** „Warum diese KooKI?“ nach dem Klick (optional, max. 100 Zeichen).
  Die letzten 20 Kommentare stehen neben dem Monster und lassen sich per „×“ löschen.
- **Neuer Sprint** setzt den Zähler zurück (geschützte Aktion). Die Kommentare wandern ins
  Archiv unter „Ältere Sprints“ (`archive.html`).

## Technik

- Statisches Frontend ohne Framework und Build (HTML, CSS, JS als ES-Module).
- Daten in **Firebase Realtime Database** (Spark-Plan, kostenlos). Kein eigenes Backend,
  kein Polling – Änderungen kommen per Push.
- Zugriffskontrolle allein über die Security Rules in `database.rules.json`. Der API-Key in
  `firebase-config.js` ist laut Firebase öffentlich und kein Geheimnis.
- Hosting über GitHub Pages (Branch `main`, Root).

| Datei | Zweck |
|---|---|
| `index.html`, `app.js`, `style.css` | Zähler-Seite |
| `archive.html` | Ältere Sprints |
| `db.js` | Firebase-Init für beide Seiten |
| `firebase-config.js` | Web-App-Config aus der Firebase-Konsole |
| `database.rules.json` | Security Rules |
| `archive/deno-backend/` | Altes Deno-Backend (v2.x), nur zur Referenz |

## Lokal starten

```
python3 -m http.server 8000
```

Dann http://localhost:8000 öffnen. Es läuft gegen die echte Datenbank (kein Emulator).

## Deploy

`git push origin main` → GitHub Pages. Pages cached rund 10 Minuten: Nach Änderungen an
`app.js`, `db.js` oder `style.css` den `?v=`-Parameter in `index.html`, `archive.html` und im
Import in `db.js` hochzählen.

## Neu einrichten

1. In der [Firebase-Konsole](https://console.firebase.google.com) ein Projekt anlegen.
2. Realtime Database erstellen (Region `europe-west1`).
3. Inhalt von `database.rules.json` im Rules-Tab einfügen und veröffentlichen.
4. Startdaten aus der lokalen `firebase-import.json` importieren (nicht im Repo).
5. Web-App hinzufügen und die `firebaseConfig` nach `firebase-config.js` kopieren.
6. Pushen.

Änderungshistorie: [CHANGELOG.md](CHANGELOG.md)
