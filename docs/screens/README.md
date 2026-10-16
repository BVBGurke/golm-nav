# Screenshots

Die Bilder in diesem Ordner stammen aus `docs/capture.mjs` und zeigen die laufende App.

```bash
npm run serve            # in einem zweiten Terminal
npm run shots            # schreibt nach docs/screens/
```

Aufgenommen wird mit Chromium in doppelter Pixeldichte (1600 × 1000 bzw. 390 × 844 mobil).
Direkt danach skaliert das Skript über ImageMagick auf das Nennmaß herunter und reduziert die
Farbtiefe; das hält die Dateien bei rund 160–200 kB und den Text trotzdem scharf. Fehlt
ImageMagick, bleiben die Bilder in doppelter Auflösung liegen – scharf, aber groß.

Chromium wird über `CHROME`, die üblichen Installationspfade und den Playwright-Cache
gesucht. Wenn nichts davon greift: `npx playwright install chromium`.

Der Standort für die Aufnahmen ist der Bahnhof Golm (52.40905, 12.97206), gesetzt über die
Geolocation-Emulation von Playwright – echte Standortdaten braucht das Skript nicht.

| Datei | Zeigt |
| --- | --- |
| `01-start.png` | Einstiegsbildschirm mit Standortfreigabe |
| `02-karte.png` | Karte mit allen 51 Zielen und Beschriftungen |
| `03-suche.png` | Volltextsuche mit Kategoriefilter „Wohnen“ |
| `04-route.png` | Route von der eigenen Position zum MPI Gravitationsphysik |
| `05-navigation.png` | Live-Navigation mit Abbiegehinweisen |
| `06-abweichung.png` | Neuberechnung nach Verlassen der Route |
| `07-mobil.png` | Zielliste auf dem Handy (390 × 844) |
