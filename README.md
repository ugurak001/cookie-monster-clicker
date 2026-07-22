# Krümelmonster – KooKI-Zähler

Ein minimalistischer Klick-Zähler: Klick das Krümelmonster, es isst eine KooKI
(Keks + KI), der Zähler steigt. Reines Frontend (HTML/CSS/JS), kein Framework, kein Build.
Der Zählerstand ist **für alle gleich** (geteilt über die kostenlose Abacus Counter-API);
localStorage dient nur als Cache für sofortiges Anzeigen.

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

## Geteilter Zähler

Der Zähler ist **für alle gleich** – er läuft über die kostenlose
[Abacus](https://jasoncameron.dev/abacus/) Counter-API (kein eigener Account).
Beim Laden wird der Wert geholt und alle 5 Sekunden aktualisiert, damit man
fremde Klicks live sieht. Der Reset-Button setzt den geteilten Zähler auf 0 und
verlangt dafür das Admin-Token (nur der Owner kann zurücksetzen).
