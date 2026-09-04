# JOURNAL

## 2026-03-05 – M1.2 Höhen-Layer + Wasserlinie
**Gebaut:** `generateTerrain(seed, w, h)`: fBm-Grundhöhe + Domain-Warp (zwei eigene fBm-Felder, organische Küsten) + Rand-Falloff, `elevation: Uint8Array` + `water: Uint8Array`. Parameter komplett in `/src/data/worldgen.ts`. Tests: Reproduzierbarkeit, Seed-Sensitivität, Rand-Ozean-Garantie, Wasseranteil, grösste zusammenhängende Landmasse (Flood-Fill), Höhen/Wasser-Konsistenz, 512x512-Performance < 1 s.
**Entscheidungen:**
- Rand-Falloff korrigiert: erst falsch ab Kartenmitte angewandt (86% Ozean); jetzt normierte Randdistanz mit Rampenbeginn bei `edgeFalloffStart` und 0 exakt an der Kante. Der Kartenrand ist immer Ozean – wichtig für M2/M6 (jede Binnenlage später über Wasser/Netz erreichbar).
- Test "Zentrum ist Land" durch "grösste zusammenhängende Landmasse ≥ 12% der Karte" ersetzt – das ist die echte Spielanforderung (mehrere Städte auf einer Landmasse), keine Ästhetik-Annahme.
- 512x512 liegt im Perf-Test klar unter 1 s (Weltgen ist Einmalkosten, Budget 16 ms gilt nur für Ticks).
**Offen:** nichts.

## 2026-03-05 – M1.1 Noise-Basis
**Gebaut:** `/src/worldgen/noise.ts`: `hash2` (32-Bit-Integer-Hash, Seed-abhängig), `valueNoise2` (quintisch interpoliert), `fbm2` (fBm mit gain/lacunarity, normalisiert, Offsets zur Feldtrennung). Tests: Determinismus, Wertebereich, Glattheit, Pin-Werte, exakte Oktaven-Identitäten.
**Entscheidungen:**
- Hash-basiert statt sequentiell: Jede Stelle liefert unabhängig von der Abfrage-Reihenfolge denselben Wert – wichtig, weil Weltgen-Schritte (Höhe, Flüsse, Vorkommen) später punktuell nachsample werden.
- Statistik-Test "mehr Oktaven -> mehr Varianz" verworfen (fragil entlang eines Sample-Pfads); stattdessen exakte Kompositions-Identitäten für octaves=1/2. Lehre: Eigenschaften testen, keine Heuristiken.
**Offen:** nichts.

## 2026-03-05 – M0.7 Determinismus-Test + M0-Abschluss
**Gebaut:** Der DoD-Test: gleicher Seed + gleiche (deterministisch erzeugte) Aktionsliste -> identischer Weltzustand nach 1000 Ticks, einmal direkt getaktet, einmal über SimLoop mit manueller Uhr; zusätzlich Savegame-Roundtrip im deterministischen Lauf und Negativprobe (abweichende Liste -> anderer Zustand). 41 Tests grün, Build grün. **M0 ist damit fertig.**
**Entscheidungen:**
- Die Aktionsliste wird per Formel erzeugt, nicht mit Math.random – die Nicht-Zufälligkeit gilt in Tests genauso wie in /src/sim.
- Negativprobe zuerst mit verschobenen Ticks gebaut: Diese ist wirkungsidentisch (Paints hängen nicht vom Tick ab) und beweist nichts; der Test vergleicht jetzt unterschiedliche Tile-Werte.
- Bedienprobe im echten Browser bleibt als Aufgabe für Peter offen (FRAGEN.md); automatisiert abgedeckt sind Sim, Loop, Kamera-Mathe und Build/Preview.
**Offen:** Manuelle Browser-Durchsicht durch Peter; M1-Zerlegung folgt sofort.

## 2026-03-05 – M0.6 HUD + Persistenz
**Gebaut:** `/src/persist` (IndexedDB-Hülle + Save/Load/Export/Import), `Hud` (Statuszeile, Speed-Buttons, Tile-Palette, Savegame-Buttons), `input.ts` (Canvas-Eingabe, gibt Frame-Poll für Tastatur-Pan zurück), `main.ts` neu gegliedert, `SimLoop.setWorld` fürs Nachladen.
**Entscheidungen:**
- Import/Export nutzen dasselbe JSON-Format wie der Browser-Slot – ein Format, ein Validierungspfad.
- HUD enthält keinerlei Logik: Callbacks nach unten, Aktivmarkierungen von aussen gesetzt (Speed-Änderungen können auch per Tastatur kommen).
- Kein Framework, reines DOM – panelweise gebaute Elemente, < 200 Zeilen pro Modul.
**Offen:** nichts.
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
