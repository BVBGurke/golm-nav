# Oberfläche

Wie GolmNav aussieht, warum es so aussieht, und welche Fremdkomponenten
drinstecken. Die Datei ist für die nächste Person gedacht, die etwas umbaut.

## Gestaltungsgrundlage

Die App wird draußen benutzt, oft im Stehen, oft bei Sonne. Daraus folgen drei
Entscheidungen:

**Zwei Farben mit Bedeutung, der Rest ist neutral.** Blau (`--color-action`,
#0b4ea2) steht für Handlungen und für die eigene Position. Signalgold
(`--color-signal`, #f5b301) steht ausschließlich für die Fahrtrichtung: die
Route, den nächsten Abbiegehinweis, den Standortpunkt. Gebäude tragen höchstens
noch einen Nutzungsakzent, alles andere bleibt grau. Vorher hatte jede
Gebäudeart eine eigene Farbe; das hilft beim Lesen nicht, es macht die Karte
bunt.

**Eine Schriftfamilie in zwei Breiten.** Archivo (`--font-sans`) für Text,
Archivo Narrow (`--font-display`) für Namen und Zahlen. Die schmale Breite löst
zwei Probleme dieser Anwendung: deutsche Institutsnamen wie
„Fraunhofer-Konferenzzentrum“ passen in die Panelbreite, und Zahlen stehen
untereinander, weil die Schmale tabellarische Ziffern mitbringt (`.tnum`).

**Kanten statt Schatten.** Die Oberfläche liegt als Instrument über der Karte:
eine Haarlinie (`--color-line`) als Rand, keine abgerundeten Schwebekarten mit
weichem Schatten. Radius 2 px, an Knöpfen so gut wie nichts. Der Grund ist der
Untergrund — ein Schlagschatten auf einer dunklen Karte ist nicht zu sehen,
eine Kante schon.

## Aufbau der Flächen

```
┌──────────────────────────────────────────────────────────┐
│ Kopfzeile: Marke, Bereiche (Karte/Ziele/Route), Standort │  52 px, Haarlinie unten
├────────────┬─────────────────────────────────────────────┤
│ Panel      │                                             │
│ 400 px     │   Karte                                      │
│ Zielsuche  │   (Panels legen sich darüber, sie schieben   │
│ oder Route │    die Karte nicht)                          │
│ oder Navi  │                                             │
├────────────┴─────────────────────────────────────────────┤
│ Statusleiste: Maßstab, Ziele, GPS, Abbiegungen, Herkunft │
└──────────────────────────────────────────────────────────┘
```

Das Panel ist ein Overlay, kein Flex-Geschwister der Karte. Dadurch bleibt der
Kartenmittelpunkt beim Öffnen und Schließen an derselben Stelle, und die
Kamera-Rechnung braucht nur einen einzigen Randversatz.

## Bausteine

`src/components/ui.tsx` hält alles, was mehrere Bildschirme teilen:

| Baustein | Rolle |
| --- | --- |
| `Reading` | Zahl mit Einheit in der schmalen Breite — jede Strecke, jede Zeit |
| `SectionHead` | Beschriftung links, Beiwerk rechts, Haarlinie darunter |
| `ProgressLine` | Fortschritt als gesetztes Segment, kein Farbverlauf |
| `Notice` | Hinweis mit Handlung: was los ist und was zu tun ist |
| `Row` | Zeilenfläche; die aktive Zeile trägt eine Signalkante links |
| `KindDot` | Kategoriefarbe als Kante und Zeichen, nicht als Fläche |
| `SegmentRow` | Umschaltung innerhalb einer Zeile |
| `RubberSegment` | Dieselbe Umschaltung mit gleitender Fläche |

## Komponenten von React Bits

Herkunft: <https://reactbits.dev>, Registry `reactbits.dev/r/<Name>-TS-TW.json`,
TS+Tailwind-Variante, unverändert bis auf Pfad-Aliase. Neu holen mit
`node scripts/fetch_bits.mjs [Name ...]`, einspielen mit
`node scripts/extract_bits.mjs`.

### Im Einsatz

| Komponente | Wo | Warum |
| --- | --- | --- |
| `SplitText` | Einstieg, Überschrift | Zerlegt „Jedes Haus auf dem Campus.“ in Wörter |
| `CountUp` | Einstieg, vier Zahlen | Zählt die Datenmengen beim Öffnen aus |
| `DarkVeil` | Einstieg, Hintergrund | Ruhige Fläche statt Farbverlauf |
| `SpecularButton` | Einstieg, Hauptknopf | Glanzkante, ohne Schlagschatten |
| `GlassIcons` | Einstieg, Kategorien | Sechs Kategorien als Glasplättchen mit Namen |
| `Dock` | Karte, unten | Vergrößert den Knopf unter dem Zeiger |
| `GlideSelect` | Panel, Kategorie | Auswahl mit Zeigereingabe, lange deutsche Namen |
| `RubberSegment` | Panel, Sortierung | Gleitende Fläche statt Knopfreihe |
| `AnimatedList` | Panel, Trefferliste | Tastaturbedienung und Zeilenfokus |
| `FadeContent` | Panel, Bildschirmwechsel | Weicher Übergang zwischen Liste, Ziel und Navi |
| `HoldButton` | Navi, beenden | Absicht statt Fehlgriff |
| `StatusMark` | Liste, Navi | Zeichnet Häkchen und Zustand |
| `BorderGlow` | Navi, Maßstab | Fasst den Ring ein, ohne Schlagschatten |
| `CometDial` | Navi, Maßstab | Stellt den Kartenmaßstab am Ring ein |
| `SwipeToast` | Standorthinweis | Wischbar, blendet sich selbst aus |

### Ausprobiert und wieder ausgebaut

Damit sie nicht zweimal geprüft werden müssen:

| Komponente | Warum nicht |
| --- | --- |
| `PillNav` | Sieben Segmente, Farbverläufe und Eyebrow — passte nicht zur Kopfzeile. Die Bereiche brauchen Aktiv-Zustand, keinen Zeigerzauber. |
| `SwipeRow` | Für die Trefferliste zu breit und auf dem Desktop unerreichbar. |
| `PixelCard` | Für ein einzelnes Ziel zu laut. |
| `Radar`, `Silk`, `GlareHover`, `SpotlightCard`, `StarBorder`, `ScrollReveal` | Bewegung um ihrer selbst willen; die Karte ist die Bühne, nicht der Rahmen. |
| `GlassSurface`, `Magnet`, `LatticeLoader`, `AnimatedContent` | Haben keine Aufgabe, die nicht schon ein Baustein aus `ui.tsx` erfüllt. |
| `PromptBar` | Chat-Eingabe; die App stellt Fragen, sie beantwortet keine. |
| `ParallaxCard`, `ChromaGrid`, `BounceCards`, `MagicBento`, `BentoGrid` | Nicht geprüft. Die Liste der 218 Registry-Einträge ist voll von Karten- und Galerie-Komponenten, die eine Kartenanwendung nicht braucht. |

## Bewegung

Bewegung ist ein Zugang, kein Dekor, und sie respektiert
`prefers-reduced-motion` (siehe `src/index.css`).

- **Beim Öffnen** läuft eine Folge: Hintergrund einblenden, Überschrift in
  Wörtern, Zahlen auszählen, Knöpfe. Danach ist Ruhe.
- **Beim Zielen** reagiert die Oberfläche auf die Handlung: das Panel wechselt
  über `FadeContent`, die Antwort auf eine Suche erscheint, die nächste
  Abbiegung färbt ihre Fläche.
- **Dauerhaft** bewegt sich nur, was Zustand zeigt: der Standortpuls, die
  laufende Route, der Fortschritt.

Im Navigationsmodus dreht sich nichts von selbst. Die Kamerafahrt folgt dem
Standort oder der Route, sonst steht sie.
