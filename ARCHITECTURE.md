# ARCHITECTURE

Diese Datei ist der Einstieg für jede Session, die den Tickfluss verstehen will —
sie ersetzt die Rekonstruktion aus dem Code. Stand: nach M9 (Konsolidierung).

## Grundsätze

1. **Determinismus:** Die Simulation ist bei gleichem Seed und gleichen Actions
   bitidentisch reproduzierbar (`src/sim/golden.test.ts` friert den Endzustand
   einer festen Szene als Hash ein). Es gibt genau einen Welt-RNG
   (`Rng`, mulberry32, Zustand im Savegame). Kein `Math.random` in `/src/sim`.
2. **Grenzen:** `/src/sim` + `/src/worldgen` + `/src/data` sind DOM-frei und lesen
   nichts aus der UI. `/src/render` liest nur Snapshots (`tileRev`-basierte Caches).
   `/src/ui` baut Panels und erzeugt Actions — sie schreibt **nie** direkt in den
   Weltzustand, sondern einreihen über `World.enqueue()`.
3. **Balance:** Keine Balance-Zahl im Sim-Code. Schwellen, Raten, Faktoren,
   Intervalle stehen als Tabellen in `/src/data` (`cities.ts`, `demographics.ts`,
   `goods.ts`, `landvalue.ts`, `networks.ts`, `pollution.ts`, `events.ts`, `trade.ts`,
   `roads.ts`, `tiles.ts`, `deposits.ts`, `worldgen.ts`, `config.ts`).

## Tick-Reihenfolge (world.update() → worldTick.runWorldTick)

Ein Sim-Tick = `update()`-Aufruf; Ticks laufen im Fixed-Tick-Loop (20/s bei 1x,
max 400 Ticks/Frame). `world.tick` zählt abgelaufene Ticks; Aktionen gelten im
**abschliessenden** Tick (`currentTick = tick + 1`).

1. **Kassen/Bankrott:** Unterhalt (Strassen `upkeepPerTick` — zu Tickbeginn),
   `maxDebt` aktualisieren, Bankrott-Flag setzen/über `treasury ≥ 0` heben.
2. **Actions:** FIFO-Queue (`World.enqueue`) wird vollständig abgearbeitet
   (`actions.applyAction`). Strassenaktionen setzen `roadsChanged`, `foundCity`
   invalidiert Zuweisung/Versorgung, `requestRoute/clearRoute` markieren die Route.
   Danach `tileRev++` (Renderer-Bookkeeping) und — bei Strassenänderungen —
   `roadRev++` (Pfad-Cache-Invalidierung) + Unterhalt neu + Versorgung dirty.
3. **Route-Anzeige:** Bei offener Routenanfrage A* über `routeContext()`.
4. **Abgeleitete M8-Layer** (nur bei `_dirty`): `recomputeSupply` (BFS vom
   Stadtzentrum über Strassen, 1-Halo versorgt) und `recomputePollution`
   (Falloff-Stempel je Industriegebäude). Beide Layer sind **nicht serialisiert** —
   Laden rechnet sie neu (wie `buildingIndex`).
5. **Wachstum** (`growth.runGrowthTick`): Verfall ohne Strassenanschluss, Neubau
   nach Nachfrage (`demand.computeDemand`) auf gezonten, angeschlossenen Tiles,
   Rezeptwahl nach Umgebung + Kettenausgleich (`production.chooseRecipe`, D006).
6. **Demografie-Intervall** (alle `AGE_TICK_INTERVAL = 200` Ticks):
   `demographics.runDemographicsTick` (Alterung mit Bildungschancen je Schulangebot,
   Geburten kapazitätsbegrenzt, Sterbefälle, Kreditzins, Steuern), dann
   `runMigration` (Zufriedenheit → Zuzug/Wegzug) und `events.runEventTick`
   (höchstens ein Ereignis pro Intervall, Welt-RNG).
7. **syncPopulation:** Lager/Markt/Handels-Matrizen an Stadtanzahl anpassen.
8. **Beschäftigung** (nur bei `commuteDirty`): `employment.assignWorkers` — gierig
   nach Städtepaar-Reisezeit (Routen-Cache pro `roadRev`+Stadtanzahl, eigene
   PathFinder-Instanz), Korridorkapazität als Stau-Deckel.
9. **Produktion** (`production.runProductionTick`): Gebäudeunterhalt, Arbeiter in
   fester Gebäude-Reihenfolge, Input-Engpass stoppt Output komplett,
   `NETWORKS.unsuppliedRateFactor` ohne Netzanschluss.
10. **Markt** (`market.updateMarket`): EMA der Flüsse, Preise aus Druck (geklemmt).
11. **Handel** (`trade.runTradeTick`): Arbitrage pro ungeordnetem Städtepaar
    (Preisdifferenz − Reisezeit×Kosten ≥ Mindestmarge), EIN Korridorbudget pro
    Paar, Marge-Priorisierung; A* über den geteilten `world.pathfinder`
    (Key-Raum `roadRev`).

### Wer liest/schreibt was (Kurzform)

| Subsystem | schreibt | liest |
|---|---|---|
| Actions | roads, zones, cities, treasury, taxRate, routeRequest | tiles, water, treasury, bankrupt |
| Netze (M8.4) | `supply`-Layer | cities.x/y, roads |
| Verschmutzung (M8.3) | `pollution`-Layer | buildings (Industrie) |
| Wachstum | buildings, cityZoneTiles, tileRev, RNG | zoneType, roads, demand, Rezepte |
| Demografie | population, treasury (Zins/Steuern), history, RNG | buildings (Schulen/Häuser), Kapazität |
| Ereignisse | buildings.condition, storage (Nahrung), RNG | buildings, storage |
| Beschäftigung | `commute` | population, buildings (Jobs), Route-Zeiten (roadRev-Cache) |
| Produktion | storage, treasury (Unterhalt) | commute, storage, buildings, `supply` (kein RNG — deterministisch) |
| Markt | market.preises/EMA | storage, Flows |
| Handel | trade.flows/exports/imports, storage | market.preise, storage, Route-Zeiten (roadRev) |

### Abgeleitete vs. serialisierte Zustände

Serialisiert: tiles, roads, zoneType/zoneCity, cities, buildings, population,
storage, market, trade-Bilanzen, history, treasury/taxRate/debt/bankrupt,
Layers (base64), rngState. **Abgeleitet (nicht serialisiert, Laden rechnet neu):**
`buildingIndex`, `cityZoneTiles`, `pollution`, `supply`, `commute`, Route.
`tileRev`/`roadRev` sind Revisionszähler (Renderer- bzw. Pfad-Cache), nicht
Teil des Zustands; `equalWorlds` vergleicht sie bewusst nicht.

## Determinismus-Regeln

- Alles Zufall läuft über die eine `Rng`-Instanz der Welt; Reihenfolge der
  RNG-Draws ist durch die feste Tick-Reihenfolge definiert. Ein
  `rng.chance`-Draw entscheidet über einen **ganzen Kohorten-Bucket**.
- Cache-Keys unterschiedlicher Revisionszähler dürfen sich nie teilen:
  `roadRev` (Straßen) ist der Key für alle Pfad-Caches; Employment nutzt dafür
  eine eigene `PathFinder`-Instanz (isoliert vom geteilten `world.pathfinder`,
  den Handel und Route-Anzeige nutzen).
- Der Golden Master (`golden.test.ts`, Seed 1337, 1200 Ticks, Referenz
  `golden-master.json`) darf sich nur ändern, wenn eine Task das ausdrücklich
  verlangt; dann Referenz in eigenem Commit neu erzeugen und im JOURNAL begründen.

## Savegame-Versionierung

`SIM_CONFIG.saveVersion` wird beim Laden hart geprüft (aktuelle Version, keine
Migration alter Formate). Neue **serialisierte** Felder erfordern einen Bump;
abgeleitete Felder (siehe oben) dürfen ohne Bump ergänzt werden. UI-Zustand
(Speed/Overlay) reist als optionaler `ui`-Block im selben JSON ohne Versionsbump
(`persist/save.ts`, withUi/readUi).

## Grenze sim / render / ui

- `sim` kennt kein `window`/`document`; Zeit kommt als injizierbare Uhr in den
  SimLoop (`loop.ts`).
- `render` (camera/renderer/minimap/overlay) liest Weltzustand und invalidiert
  Offscreen-Caches über `tileRev`; Overlay-Farbtabellen liegen in `data/overlays.ts`.
- `ui` (shell/main/panels) rendert Panel-DOM 4×/s, mappt Eingaben auf Actions
  (`enqueue`) und Speed-Änderungen am SimLoop.

### UI-Shell (M10.0)

- `shell.ts` besitzt das CSS-Grid mit fünf Regionen (Topbar, Werkzeug-Rail,
  Werkzeug-Optionen, Canvas, Dock, Statusleiste). Der Canvas ist eine Grid-Zelle:
  kein `position: fixed`, kein z-index-Stapel, keine überlappenden Panels.
- Der Inspektor im Dock zeigt genau einen Tab; welche Tabs zur Wahl stehen,
  entscheidet der Selektionskontext (`region` / `city` / `tile`).
  **Ein neues Panel ist ein Eintrag in `ui/inspector/registry.ts`** — kein
  Eingriff ins Layout. Nur der sichtbare Tab rechnet.
- Auflösung eines Kartenklicks in eine Selektion: `ui/selection.ts`
  (reine Funktion, ohne DOM getestet). Zahlenformate: `ui/format.ts`.
- Kennzahlen lesen alle über `ui/metrics.ts`, damit Topbar und Inspektor
  dieselben Werte zeigen.
- Farben, Abstände, Schriften und Layoutmaße stehen ausschliesslich in
  `ui/tokens.css`.

## Test-Layout

- Subsystem-Tests neben dem Code (`src/sim/*.test.ts`, `src/render`, `src/persist`).
- DoD-Nachweise: `m3`–`m8.proof.test.ts` (jeweils differential, deterministisch).
- Golden Master: `golden.test.ts` (Referenz nur mit JOURNAL-Begründung neu).
- Perf-Gate: `perf.test.ts` (echte Last, Subsystem-Profiling, Budget 16 ms).
- Zentrale Test-Fakes: `tests/fakes.ts` (lineWorld-Pipeline ohne Weltgen-Geographie).
