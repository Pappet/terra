# Persistent Project Memory

> Maintained by dsh-memoir: a cross-session record of completed work, lessons learned, and follow-up actions.
> This human-readable projection guides future agents; it is not injected into the system prompt in full.
> New sessions receive only bounded Hot Memory. Use memoir_read to retrieve complete history on demand.

## Work Log

- [2026-09-04 22:47] [Work Log] TERRA M0 fertig — TERRA M0 abgeschlossen (Commits cad880f..HEAD): Vite+TS+Vitest-Gerüst, mulberry32-RNG mit Zustands-Export, World als Struct-of-Arrays mit FIFO-Action-Queue (Determinismus-Grenze), JSON-Savegame mit Validierung, SimLoop (20 TPS, Stufen 0/1/3/10, First-Frame-Guard, stepOnce), Kamera+Renderer mit Offscreen-Layer-Cache (max 16 device-px/Tile), HUD/Persistenz (IndexedDB 'terra'/store 'saves', Slot 'auto'). 41 Tests grün. DoD-Test: src/sim/determinism.test.ts. Nächster Schritt: M1 (Noise-Weltgen, 512x512, Layer, Minimap) – Tasks in PLAN.md.
- [2026-09-04 23:19] [Work Log] TERRA M1 fertig – Weltgen + Overlays — TERRA M1 abgeschlossen (Commits 98e3e80..285ac4c): Weltgen noise.ts (hash2/valueNoise2/fbm2, hash-basiert nicht sequentiell), terrain.ts (Domain-Warp + Rand-Falloff, Kartenrand immer Ozean), rivers.ts (Quellenwahl + bergab-Carving, Mündung garantiert getestet), derived.ts (Fruchtbarkeit/Wald, BFS-Distanzfeld), deposits.ts (Perzentil-Placement statt absoluter Schwellen – Menge als Designgröße), surface.ts (Tile-Mapping). World generiert im Konstruktor; Savegame v2 mit base64-Layern (sim/base64.ts, DOM-frei). Overlays + Minimap (render/overlay.ts fillTileColors, ImageData-Cache 1px/Tile). 89 Tests. Getroffene Lehren: Perzentil statt Schwellen, Perzentil-Vergleiche statt absoluter Verteilungsschwellen, kleine Karten (<Wellenlänge) können All-Ozean sein. Nächster Schritt: M2 Netz (Tasks in PLAN.md), aktuell M2.1.

## Lessons Learned

- [2026-09-04 22:24] [Lessons Learned] npm braucht Workspace-lokalen Cache — TERRA-Projekt (/home/peter/Projekte/WebSim): npm install scheitert mit EROFS, wenn npm den Standard-Cache /home/peter/.npm nutzt (Sandbox). Lösung: `npm install --cache ./.npm-cache` (Workspace-lokaler Cache, in .gitignore). Geschwindigkeit-Zerlegung: kleine Tasks, ein Commit pro Task, Format "M<n>: <Task>".
