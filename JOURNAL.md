# JOURNAL

## 2026-03-05 – M2.1 Strassen-Datenmodell
**Gebaut:** `roads: Uint8Array` im WorldState, Strassentypen (Pfad/Strasse/Chaussee mit Baukosten, Unterhalt, Tempo, Kapazität) in `/src/data/roads.ts`, Actions `buildRoad`/`demolishRoad`, `treasury` mit Startkapital, `lastRejected` als deterministische Ablehnungs-Info fürs UI, Savegame **v3** (roads + treasury). applyAction bekam dafür einen `ActionContext` (strukturell erfüllt von World statt World-Import → keine zirkuläre Abhängigkeit).
**Entscheidungen:**
- Bau auf Wasser abgelehnt (Brücken kommen später), kein Erstattung beim Abriss, Ausbau auf belegtem Tile kostet voll.
- ActionContext als strukturelle Schnittstelle: actions.ts bleibt import-frei von world.ts; World gibt den Wasser-Layer per Getter top-level frei.
- Lehre: esbuild (vitest) typecheckt nicht – der fehlende `water`-Kontrakt fiel erst im Testlauf auf. `npm run build` (tsc) ist und bleibt Teil jedes Schritts.
**Offen:** nichts.

## 2026-03-05 – M1.8 Reproduzierbarkeit + M1-Abschluss
**Gebaut:** Gesamt-Nachweis auf 512x512: gleicher Seed -> identische Welt über alle Layer, Roundtrip mit Paint, Zeitbudget (Weltgen < 4 s, Savegame-JSON hin+her < 2 s), Vollständigkeit + Wasseranteil. 89 Tests grün, Build grün. **M1 ist damit fertig.**
**Entscheidungen:**
- Zeitbudget-Bounds bewusst grosszügig (4 s/2 s) – Weltgen ist Einmalkosten; das 16-ms-Budget gilt nur für Sim-Ticks.
**Offen:** Manuelle Browser-Durchsicht durch Peter (FRAGEN.md); M2 (Netz) beginnt.

## 2026-03-05 – M1.6 Layer im WorldState + Savegame v2
**Gebaut:** `World` generiert im Konstruktor die komplette Welt (Terrain -> Derived -> Deposits -> Surface-Mapping zu Tile-IDs); alle sechs Layer liegen als Uint8Arrays im Zustand. Savegame **v2**: Layer und Tiles als base64-Strings (eigene DOM-freie Implementierung in `sim/base64.ts`), harte Validierung beim Laden (Längen, Wertebereiche, unbekannte Vorkommens-Bits). Neue Task-ID "Wald" in der Palette-Tabelle. 512er-Savegame < 5 MB.
**Entscheidungen:**
- Savegame v1 wird klar abgelehnt (Versionsfehler) – M0-Saves sind Wegwerf-State, Migration nicht wert.
- Der base64-Umstieg kam früher als geplant (BACKLOG sagte M1 voraus): 6 Layer als JSON-Zahl-Arrays wären ~10 MB gewesen, base64 hält sie bei ~2 MB.
- Konstruktor generiert standardmässig – gleicher Seed, gleiche Welt, strukturell garantiert. Kleine Karten (Weltgrösse < Wellenlänge) können im Ozean liegen; Tests nutzen deshalb die Spielgrösse für Land-Annahmen.
**Offen:** nichts.

## 2026-03-05 – M1.7 Overlays + Minimap
**Gebaut:** Overlay-Definitionen in `/src/data/overlays.ts` (Oberfläche, Höhe, Wasser, Fruchtbarkeit, Wald, Vorkommen), `render/overlay.ts` füllt 1px/Tile-RGBA (Gradient-LUT, Bitmask-Mischung), Renderer-Cache jetzt über ImageData statt 262k fillRects, `render/minimap.ts` (Sichtfeld-Rechteck, Klick/Drag-Sprung), HUD-Overlay-Panel + Taste `o` zum Durchschalten. Karte auf 512x512.
**Entscheidungen:**
- ImageData-Ansatz ersetzt fillRect-Kaskade: Native-Auflösung 1px/Tile, Nearest-Scale auf Cache-Grösse – schneller und ohne Kantenritze.
- Minimap rendert ihr eigenes ImageData (gleicher Code-Pfad via fillTileColors) und invalidate auf tileRev|overlay.
**Offen:** nichts.
**Gebaut:** `generateDeposits`: Bitmaske (Stein/Ton/Kohle/Eisen/Öl), pro Rohstoff eigenes fBm-Feld auf Land-Tiles im Höhenband; Placement per **Perzentil** (oberster `rate`-Anteil der geeigneten Tiles), quantisiert über sortierte Feldwerte. Tests: Reproduzierbarkeit, nur definierte Bits, nur auf Land, Menge pro Rohstoff (0.1–12% des Landes), Klumpigkeit (grösste Komponente ≥ 15%), 512er-Perf.
**Entscheidungen:**
- Absolute fBm-Schwellen verworfen: Nicht kalibrierbar über Seeds (Stein @ seed 1: 0 Treffer), weil Value-Noise sich um 0.5 konzentriert. Perzentil macht die Menge zur Designgrösse; die räumliche Glätte liefert weiterhin regionale Klumpen.
- Fehler entdeckt: erste Höhenbänder lagen (Ton 0.02–0.35) komplett unter der Wasserlinie 0.38. Bänder gelten jetzt innerhalb der Landspanne 0.38–1.0. Öl bleibt Land-basiert (Flachland); Offshore-Öl ist BACKLOG.
**Offen:** nichts.

## 2026-03-05 – M1.4 Fruchtbarkeit + Wald
**Gebaut:** `distanceField` (BFS, Chebyshev, gekappt) und `generateDerived`: Fruchtbarkeit aus regionalem fBm × Höhenstrafe + Fluss-/Küsten-Boosts; Wald aus eigenem Feuchte-fBm + Flussnähe, nur unterhalb der Baumgrenze. Parameter in `/src/data/worldgen.ts`. Tests: Reproduzierbarkeit, Wertebereiche, Wald⊆Land, karge Hochlagen (Perzentil), fruchtbarere Flussnähe, sinnvolle Walddichte.
**Entscheidungen:**
- Heuristik-Test "elevation > 200" ging ins Leere (keine solchen Tiles bei manchen Seeds) → Perzentil-Vergleich (oberes Zehntel vs. unteres Drittel der Landtiles). Lehre: Verteilungs-Tests nie auf absolute Schwellen stützen.
- Fruchtbarkeit/Wald lesen die effektive Höhe (inkl. Fluss-Carving) – Wälder folgen den Tälern, das ist die gewollte Rückkopplung zwischen den Weltgen-Layern.
**Offen:** nichts.

## 2026-03-05 – M1.3 Flüsse
**Gebaut:** `generateRivers`: Quellen = höchste Landtiles mit Mindestabstand (gierig, deterministisch per Höhen-/Index-Tiebreak), Abstieg zum tiefsten 8er-Nachbarn mit Carving (Nachbar wird unter aktuelle Höhe gegraben -> Tälern), Mündung bei Kontakt mit Meer/See/Fluss, `river`-Layer als Teilmenge von `water`. `generateTerrain` liefert jetzt `{elevation, water, river}`. Tests: Reproduzierbarkeit, river⊆water, mindestens eine Meeresmündung pro Seed, Wasseranteil-Bounds, 512er-Perf.
**Entscheidungen:**
- Carving mutiert die Höhen weiter: Die Höhe gilt danach als "effektive Höhe inkl. Flussgräben" – spätere Layer (Fruchtbarkeit, Bodenwert) profitieren von realen Tälern.
- `prev`-Tile wird übersprungen, um Plateau-Bounce (A->B->A auf Höhe 0) zu vermeiden; `maxSteps` bleibt als harter Deckel.
- Quellenwahl ist rein höhenbasiert; der seed-Parameter von generateRivers ist bewusst ungenutzt (Jitter-Varianten später) und dokumentiert.
**Offen:** nichts.

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
