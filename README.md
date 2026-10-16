# GolmNav – Campus Golm Navigator

Navigationssystem für den **Campus Golm der Universität Potsdam**. Alle Häuser liegen auf
einer Karte, du wählst ein Ziel und bekommst mit deinen Live-Standortdaten den Weg dorthin –
inklusive Blickrichtung, automatischer Neuberechnung und Schritt-für-Schritt-Hinweisen.

**React + Vite + TypeScript + Tailwind, Karte mit MapLibre GL, Routing vollständig im Browser.**

## Was es macht

- **Karte mit allen Häusern.** 51 ausgewählte Ziele (Haus 1–70, BaseCamp 1–6, H-Labor,
  GO:IN, Mensa, Stellwerk, Fraunhofer, Max-Planck-Campus, Bahnhof Golm) auf 1 233 echten
  Gebäudeumrissen. Jedes Ziel ist anklickbar und wird mit Namen und Hausnummer beschriftet.
- **Live-Navigation.** GPS-Position, Kompass-Blickrichtung, Fortschrittsanzeige und
  automatische Neuberechnung, sobald du mehr als 40 m von der Route abweichst.
- **Eigenes Routing.** Ein Fußweg-Graph aus OpenStreetMap (3 404 Knoten, 3 832 Kanten) wird
  mit A\* und einer Luftlinien-Heuristik im Browser durchgerechnet. Keine Anfragen an einen
  Routing-Dienst, kein API-Key, funktioniert offline, Antwortzeit unter einer Millisekunde.
- **Suche und Filter.** Volltextsuche über Name, Hausnummer, Straße und Kategorie, dazu
  Filter nach Universität, Forschung, Essen, Lernen, Wohnen, Sport, Service und Verkehr.
- **Startpunkt per Klick.** Ohne Standortfreigabe tippst du einfach auf die Karte.

## Starten

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # Produktionsbuild in dist/
npm run preview  # gebauten Stand lokal ausliefern
```

Für den Handy-Test im gleichen WLAN läuft `npm run dev` bereits auf allen Interfaces
(`--host`), die Adresse steht beim Start in der Konsole.

## Woher die Daten kommen

Alle Karten- und Gebäudedaten stammen aus **OpenStreetMap (ODbL)**. Die Kacheln liefert
**CARTO** (dark matter, kostenlos, ohne Account).

```
scripts/
  fetch_osm.mjs      Rohdaten für Campus Golm herunterladen (scripts/data/tile-*.xml)
  build_campus.mjs   Fußweg-Graph + Gebäudeumrisse  ->  src/data/campus.json
  dump_places.mjs    benannte POIs aus den Rohdaten  ->  out/pois_raw.json
  build_pois.mjs     kuratierte Zielliste            ->  src/data/pois.json
  extract_bits.mjs   React-Bits-Komponenten aus der Registry -> src/bits/
```

```bash
npm run data:fetch   # nur nötig, wenn die OSM-Rohdaten neu gezogen werden sollen
npm run data:build   # baut campus.json und pois.json aus scripts/data/
```

`build_campus.mjs` behält nur die große zusammenhängende Wegekomponente, verbindet
Kreuzungspunkte über ihre Koordinaten und zeichnet die Umrisse mit Douglas-Peucker nach,
damit die Datei klein bleibt. Neue Ziele trägst du in `build_pois.mjs` in `EXTRAS` bzw.
`OVERRIDES` ein und lässt `npm run data:build` erneut laufen.

## Aufbau

```
src/
  App.tsx                    Zustand, Suche, Route, Navigationsmodus
  components/MapView.tsx     MapLibre-Karte, Kamera, Klick-Handling
  components/panels.tsx      Zielliste, Ziel-Detail, Live-Navigation
  components/ui.tsx          Icons und Kategorie-Marker
  hooks/useLiveLocation.ts   GPS, Kompass, Permission-Handling
  lib/geo.ts                 Distanz, Peilung, Formatierung
  lib/graph.ts               Routing-Graph + A* mit Binärheap
  lib/routing.ts             Route, Abbiegehinweise, Abweichungserkennung
  lib/mapLayers.ts           Style-Layer für Gebäude, Route, Marker
  bits/                      React-Bits-Komponenten (unverändert übernommen)
  data/                      campus.json und pois.json
```

Die Komponenten in `src/bits/` sind 1:1 aus der [React Bits](https://reactbits.dev)-Registry
(TS+Tailwind-Variante) übernommen: Silk, SplitText, ShinyText, CountUp, SpotlightCard,
GlareHover, Magnet, AnimatedList, LatticeLoader, GlassSurface, PillNav, ScrollReveal.

## Bedienung

| Aktion | Desktop | Mobil |
| --- | --- | --- |
| Suche fokussieren | `/` | Suchfeld antippen |
| Auswahl aufheben | `Esc` | × im Panel |
| Standort freigeben | `L` | Schaltfläche oben rechts |
| Startpunkt setzen | auf die Karte klicken | auf die Karte tippen |

Die Standortfreigabe ist optional. Ohne sie zeigt die App weiter alle Häuser und du kannst
einen Startpunkt auf der Karte setzen. Der Standort verlässt das Gerät nicht – es gibt keinen
Server, an den etwas gesendet wird.

## Hinweis zu den Daten

Die Hausnummern und Zuordnungen stammen aus OpenStreetMap und sind nicht die amtliche
Campus-Nummerierung. Für die Orientierung auf dem Campus reicht es, für Aushänge oder
offizielle Wegbeschreibungen bitte gegen den Campusplan der Universität prüfen.
