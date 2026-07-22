# Krümelmonster – Keks-Zähler

Ein minimalistischer Klick-Zähler: Klick das Krümelmonster, es isst einen Keks,
der Zähler steigt. Reines Frontend (HTML/CSS/JS), kein Framework, kein Build.
Der Stand wird lokal im Browser gespeichert (localStorage).

## Lokal starten

`index.html` im Browser öffnen. Falls localStorage unter `file://` zickt, im
Ordner einen kleinen Server starten:

```
python3 -m http.server 8000
```

Dann http://localhost:8000 öffnen.

## Deploy auf GitHub Pages

1. Repo auf GitHub pushen.
2. Settings → Pages → Branch `main`, Ordner `/ (root)` → Save.
3. Nach ~1 Minute live unter `https://<user>.github.io/<repo>/`.

## Bewusste Grenze

Der Zähler ist **pro Browser/Gerät** (localStorage), nicht geteilt. Ein globaler,
geteilter Zähler mit Team-Links bräuchte ein Backend – der Ausbaupfad steht im
Projekt-Plan im Obsidian-Vault.
