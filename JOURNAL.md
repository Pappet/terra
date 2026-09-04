# JOURNAL

## 2026-03-05 – M0.5 Kamera + Renderer mit Layer-Caching
**Gebaut:** `Camera` (DOM-frei, getestet: Roundtrip, ortsfestes Cursor-Zoom, Clamping), `Renderer` mit Offscreen-Tile-Ebene: Cache wird nur bei `tileRev`-/Auflösungswechsel neu gezeichnet, pro Frame nur Blit + Gitter-/Rand-Overlay. `main.ts` nutzt jetzt Loop + Kamera: Linksklick/Ziehen malt, Rechtsklick/Mitte schwenkt, Rad zoomt, WASD/Pfeile pan, +/- zoomt, Leertaste Pause, 1/2/3 Speed.
**Entscheidungen:**
- Cache-Auflösung auf max. 16 Gerätepixel/Tile gekappt: Bei zoom 48 und dpr 2 wäre die Vollauflösung ~600 MB gross; flächige Tiles vertragen Nearest-Neighbor-Upscaling. Bei 512x512-Karten (M1) kommt Chunk-Caching (BACKLOG).
- Gitterlinien bewusst NICHT in den Cache (wären nach Upscaling matschig), sondern als billiger Overlay-Stroke pro Frame.
- `SimLoop.stepOnce()`: Editor-Actions (Malen) sollen auch bei Pause sichtbar werden, ohne die Sim-Uhr weiterlaufen zu lassen.
- TS-Lehre (nachgetragen aus M0.3/M0.4): Exhaustiveness-Guards per `never`-Zuweisung greifen erst ab dem zweiten Union-Member.
**Offen:** nichts.

## 2026-03-05 – Projektstart, M0.1
**Gebaut:** Repo angelegt (README, PLAN, JOURNAL, BACKLOG, FRAGEN, DECISIONS), Vite+TS+Vitest-Gerüst, Ordnerstruktur nach Architekturvorgabe.
**Entscheidungen:**
- Testumgebung `node` (kein jsdom nötig, da Sim DOM-frei ist und bleibt).
- `noUncheckedIndexedAccess` an: erzwingt sauberen Umgang mit TypedArray-Indizes in der Sim.
- `/src/persist` als zusätzliche Ebene neben der vorgegebenen Struktur: Savegame-IO (IndexedDB, Datei) ist weder Sim noch UI; wird in JOURNAL/DECISIONS dokumentiert statt sim mit Browser-APIs zu verschmutzen.
**Offen:** Rest von M0.

## 2026-03-05 – M0.2 Seeded RNG
**Gebaut:** `mulberry32` als Klasse mit exportierbarem Zustand (`Rng.state`, `Rng.fromState`), damit Savegames den RNG-Stand mitschreiben und die Sequenz nach Laden exakt weiterläuft. Pin-Test friert konkrete Sequenzwerte ein, damit der Algorithmus nie unbemerkt ändert.
**Entscheidungen:** Eine einzige RNG-Instanz pro Welt (kein Stream-System) – erst wenn mehrere Subsysteme unabhängig weiterticken (M3+), wird auf benannte Streams umgestellt (BACKLOG).
**Offen:** nichts.

## 2026-03-05 – M0.3 Weltzustand, Actions, Savegame
**Gebaut:** `World` als Struct-of-Arrays (`tiles: Uint8Array`), FIFO-Action-Warteschlange (Actions greifen zu Beginn des nächsten Sim-Ticks – Determinismus-Grenze, siehe DECISIONS D003), JSON-Serialisierung mit Versionsfeld und harten Validierungen beim Laden, `tileRev` als Cache-Invalidierungszähler. Minimales lauffähiges UI-Shell (index.html + main.ts): Boot mit URL-Seed, statisches Grid-Rendering, Klick-Paint über die Action-Pipeline – damit ist der Build ab sofort lauffähig.
**Entscheidungen:**
- TypedArrays werden im Savegame als normale Zahl-Arrays serialisiert (JSON, menschenlesbar). Bei 512x512 sind das ~2 MB; binäres/base64-Format steht im BACKLOG.
- `tileRev` ist Renderer-Bookkeeping: wird nicht serialisiert und nicht in `equalWorlds` verglichen (erwies sich im Roundtrip-Test als Designfrage).
- TS-Lehre: Exhaustiveness-Checks (`const x: never = action`) nach `switch` funktionieren erst ab dem zweiten Union-Member; bei Ein-Member-Unionen subtrahiert TS nicht bis `never`. Bis dahin fängt ein Runtime-Throw in `default` unbekannte Kinds ab.
**Offen:** nichts.

## 2026-03-05 – M0.4 Fixed-Tick-Loop
**Gebaut:** `SimLoop` mit Akkumulator, injizierbarer Uhr (Browser: `performance.now`, Tests: manuelle Uhr), Geschwindigkeitsstufen 0/1/3/10, Catch-up-Deckel gegen Todesspirale, Tick-Zähler-Rückgabe pro `update()` fürs Rendering.
**Entscheidungen:**
- Basis-Tickrate 20/s (in `/src/data`), max. 400 Ticks pro Frame; nach langer Pause wird die verstrichene Zeit gekappt und der Rest verworfen, statt sie nachzuholen.
- First-Frame-Guard: der erste `update()`-Aufruf setzt nur die Zeitbasis, die Zeitspanne zwischen Loop-Konstruktion und erstem Aufruf wird verworfen (schutz vor Phantom-Bursts; in Tests via Warm-up-Call berücksichtigt).
**Offen:** nichts.
