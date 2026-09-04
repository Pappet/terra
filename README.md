# TERRA

Browserbasierte Städtebau- und Wirtschaftssimulation. Leitsatz: **Simulationstiefe vor Grafik.**

Eine grosse, prozedural erzeugte Karte mit Terrain und Rohstoffen. Der Spieler gründet
mehrere Städte, baut Strassen und Infrastruktur, und die Simulation erweckt das zum Leben:
Bevölkerung siedelt sich an, Arbeiter pendeln (auch über Stadtgrenzen hinweg), Güter werden
produziert und zwischen Städten gehandelt.

## Stack

- TypeScript + Vite, UI als normales DOM (kein Framework)
- Canvas2D, Tile-basiert, Kamera mit Pan/Zoom, Layer-Caching
- Eigener Fixed-Tick-Loop, von Rendering entkoppelt, deterministisch, seeded RNG
- Savegames in IndexedDB plus Export/Import als Datei
- Tests mit Vitest, Sim-Logik DOM-frei
- Kein Backend, kein Multiplayer, kein 3D, keine Assets von Dritten

## Starten

```bash
npm install
npm run dev      # Entwicklung
npm test         # Vitest
npm run build    # Typcheck + Production-Build
```

Der Seed lässt sich per URL-Parameter setzen: `?seed=12345`.

## Architektur

```
/src/sim      reine Simulation: deterministisch, kein DOM, kein Rendering
/src/render   Zeichnen, liest nur Snapshots aus der Sim
/src/ui       Panels, Tools, Eingabe
/src/data     alle Balance-Werte als Tabellen (keine Balance-Zahl im Code)
/src/worldgen Kartengenerierung (ab M1)
/src/persist  Savegame: IndexedDB + Datei-Export/Import
```

Weltzustand als Struct-of-Arrays / TypedArrays, Referenzen über numerische IDs.
Die Sim ist von Anfang an Worker-fähig geschrieben (keine DOM-Zugriffe, klare
Message-Grenze); der tatsächliche Umzug in einen Web Worker ist eine Task in M5.

## Meilensteine

M0 Gerüst · M1 Welt · M2 Netz · M3 Siedlung · M4 Menschen · M5 Wirtschaft ·
M6 Handel · M7 Verwaltung · M8 Tiefe

Details und Task-Lists: [PLAN.md](PLAN.md). Entscheidungen: [DECISIONS.md](DECISIONS.md).
Entwicklungslog: [JOURNAL.md](JOURNAL.md).
