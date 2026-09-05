# M10.0 – UI-Shell (Spezifikation)

Vorgezogen vor die M10-Feature-Liste aus PLAN.md: die dort geplanten Features
(Overlays für die M8-Layer, Ereignis-Log, Pendler-Visualisierung, Stadt-Detail)
brauchen einen Ort, an dem sie erscheinen können. Den gibt es heute nicht.

## Ausgangslage

Das HUD besteht aus sechs unabhängigen `position: fixed`-Panels über einem
Vollbild-Canvas: `left-stack` (Status/Stats/Budget/Städte), `right-stack`
(Speed/Steuern/Minimap), `top-center` (Overlays), `bottom-center` (Werkzeuge),
`bottom-left` (Kontextzeile Zonen/Straßen/Tiles), `bottom-right` (Savegame).

Probleme:

- Panels konkurrieren um Bildschirmecken; jedes neue Feature braucht eine neue
  Ecke oder verdrängt ein bestehendes Panel (M9-Historie belegt das: das
  Tax-Panel kollidierte mit der Minimap, Budget/City/Stats überlappten sich).
- Keine Hierarchie: globaler Zustand (Kasse), Werkzeugmodus und
  Detailinformation liegen visuell gleichrangig nebeneinander.
- Kein Selektionsbegriff: Städte sind eine Textliste, einzelne Tiles lassen
  sich gar nicht inspizieren. Genau das ist die Sichtbarkeitslücke, die M10
  schließen soll (Verschmutzung und Versorgung sind simuliert, aber unsichtbar).
- CSS mit festen Pixelwerten und Ad-hoc-Farben, kein Token-System.
- Bug: `S` toggelt das Stats-Panel **und** pannt nach unten (WASD-Konflikt).

## Zielbild

Ein App-Frame statt schwebender Kästen. Der Canvas ist eine Grid-Zelle, kein
Vollbild. Chrome belegt echten Platz; nichts überlappt je die Karte.

```
┌──────────────────────────────────────────────┐
│ TERRA  Seed 1337 · T 4210      💰 12.4k  ⏸1x │  topbar
├──┬───────────────────────────────────┬───────┤
│🏙│                                   │ MINI  │
│🛣│                                   │ MAP   │
│▦ │            C A N V A S            ├───────┤
│⛏│                                   │ Inspek│
│📍│                                   │ tor   │
├──┴───────────────────────────────────┴───────┤
│ Overlay: [Oberfl][Strassen][Zonen]…   x,y … │  statusleiste
└──────────────────────────────────────────────┘
```

## 1 Shell

CSS-Grid mit fünf Regionen:

```
grid-template-areas:
  "topbar  topbar   topbar  topbar"
  "rail    options  canvas  dock"
  "status  status   status  status"
columns: 52px  0|168px  1fr  320px
rows:    44px  1fr      32px
```

- `index.html` schrumpft auf `<div id="app">`; die Shell baut die Regionen in
  TypeScript und gibt benannte Host-Elemente heraus.
- `position: fixed` verschwindet vollständig aus dem CSS. Kein z-index-Stapel,
  keine Kollisionen; jede Region wächst in ihrer Zelle.
- Die **Options-Spalte** ersetzt die alte Kontextzeile: 0 breit, wenn das
  aktive Werkzeug keine Optionen hat, 168px für Zonentypen, Straßentypen oder
  Tile-Palette. Ein Werkzeugwechsel ändert eine Spaltenbreite, nicht die
  Position anderer Panels.
- Dock und Options-Spalte sind einklappbar (Buttons in der Topbar). Unter
  1100px Fensterbreite startet das Dock eingeklappt.
- Canvas: `#game { width:100%; height:100% }` in seiner Zelle. `Renderer.draw`
  misst bereits `clientWidth/clientHeight` und braucht keine Änderung.
- `input.ts` beobachtet den Canvas per `ResizeObserver` statt `window.resize`;
  sonst stimmt der Viewport nach Ein-/Ausklappen des Docks nicht.

## 2 Regionen

**Topbar (44px)** — global gültiger Zustand:
Identität (`TERRA · Seed · Tick`), Kennzahlen (Kasse mit Netto/Tick, Einwohner,
mittlere Zufriedenheit, Schulden, Bankrott-Badge), Geschwindigkeits-Segment
(`⏸ 1x 3x 10x`), `Datei ▾` mit Speichern/Laden/Export/Import als angehängtes
Popover (transient, kein Dauer-Kasten), Umschalter für Dock/Options-Spalte.

**Werkzeug-Rail links (52px)** — Icon-Buttons vertikal, Tooltip mit Kürzel:
Auswahl (Startwerkzeug), Gründen, Zonen, Straße, Abriss, Route, abgesetzt
darunter Malen (Debug). `data/tools.ts` bekommt die Felder `icon` und
`shortcut`; die Rail rendert aus dem Array. Neues Werkzeug = ein Array-Eintrag.

**Statusleiste (32px)** — links Overlay-Chips (horizontal scrollbar bei
Überlauf, Taste `O` zykelt weiter), Mitte Meldungs-Slot (die bisherigen
`flash`-Toasts), rechts Live-Text mit `tabular-nums`: Tile unter der Maus
(`x,y · Typ · Höhe · Zone · Straße`), Route-Information, FPS.

**Dock rechts (320px)** — Minimap oben fix, darunter der Inspektor.

Der Stats-Panel-Toggle auf `S` entfällt (Statistik wird Dock-Tab); `S` ist
danach ausschließlich Pan.

## 3 Inspektor: Selektion + Tab-Registry

```ts
type Selection =
  | { kind: 'region' }
  | { kind: 'city'; cityId: number }
  | { kind: 'tile'; index: number };

interface InspectorTab {
  readonly id: string;
  readonly label: string;
  readonly context: Selection['kind'];
  mount(host: HTMLElement): void;        // einmalig
  update(ctx: InspectorContext): void;   // 4 Hz, nur wenn aktiv
}
```

`INSPECTOR_TABS` ist ein Array in `src/ui/inspector/registry.ts`. Das Dock
filtert nach `context` und zeigt genau einen Tab. Ein neues Feature ist ein
Eintrag in diesem Array — kein Layout-Eingriff.

Start-Belegung:

- `region`: **Übersicht** (Kennzahlen + klickbare Städteliste) · **Budget**
  (Kasse, Steuern, Unterhalt getrennt, Netto/Tick, Schulden, Steuersatz-Buttons)
  · **Statistik** (`stats.ts` als Tab, Canvas auf Dockbreite)
- `city`: **Übersicht** (EW, Jobs, Zufriedenheit, R/C/I, Nachfrage) ·
  **Wirtschaft** (Lager, Preise, Export/Import) · **Bevölkerung** (Kohorten
  nach Alter/Bildung, Pendler, mittlere Pendelzeit)
- `tile`: eine Tabelle ohne Tabs (Typ, Höhe, Fruchtbarkeit, Wald, Vorkommen,
  Zone, Zonenstadt, Straße, Verschmutzung, Versorgung, Bodenwert)

M10-Features hängen sich ohne Strukturarbeit ein: Ereignis-Log als
`region`-Tab, Versorgung/Verschmutzung als `city`-Tab.

Selektion erfolgt über das Auswahl-Werkzeug: Klick auf die Karte wählt die
Stadt, wenn das Tile zu einer Stadt gehört (Zonenzuordnung oder Nähe zum
Zentrum), sonst das Tile. `ESC` oder Klick auf freies Wasser fällt auf
`region` zurück. Die Auflösung ist eine reine Funktion
`resolveSelection(world, tileIndex): Selection` und damit ohne DOM testbar.

Aktualisierung wie bisher alle 0.25 s im Frame-Loop, aber nur für den aktiven
Tab — heute berechnet `updateCityPanel` in jedem Zyklus alle Kennzahlen aller
Städte.

## 4 Struktur, Tokens, Tests

Neu unter `src/ui/`: `shell.ts`, `topbar.ts`, `toolrail.ts`, `tooloptions.ts`,
`dock.ts`, `statusbar.ts`, `selection.ts`, `format.ts`,
`inspector/registry.ts` sowie je eine Datei pro Tab-Gruppe.

Entfällt: `hud.ts`. Umgebaut: `stats.ts` (Tab statt Toggle-Panel), `main.ts`
(reine Verdrahtung), `input.ts` (ResizeObserver, `onHover`, `onSelect`).

CSS: `tokens.css` (Farbrampe bg/surface/border/text/muted/accent, 4px-Spacing-
Skala, drei Textgrößen, ein Fokus-Stil, semantische Farben für positiv/negativ/
Warnung), `shell.css`, `components.css`. UI-Sans für Beschriftungen, Monospace
mit `tabular-nums` für Zahlen, damit Werte beim Ticken nicht zappeln.

Keine Quelldatei über 400 Zeilen (M9-Regel gilt weiter).

**Nicht angefasst**: `src/sim/**`, `src/render/{renderer,overlay,camera}.ts`,
das Savegame-Format.

## Definition of Done

- Kein `position: fixed` mehr im UI-CSS; alle Panels liegen in Grid-Zellen.
- Werkzeugwechsel, Overlay-Wechsel und Selektion verschieben kein anderes Panel.
- Stadt und Tile sind per Klick inspizierbar; `region` ist der Rückfallzustand.
- Ein neuer Inspektor-Tab erfordert genau einen Registry-Eintrag (im Code
  nachweisbar durch die drei bestehenden Kontexte).
- Alle bestehenden Tests grün, `npm run build` grün.
- Golden-Master-Hash unverändert `5e5226f6964efe8d` (kein Sim-Eingriff).
- Neue Tests für `resolveSelection`, Registry-Filterung und Zahlenformatierung.
- Visuelle Abnahme durch Peter.
