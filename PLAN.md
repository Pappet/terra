# PLAN

## M0 – Gerüst (ABGESCHLOSSEN)

DoD erfüllt: Determinismus-Test (1000 Ticks) grün, Pan/Zoom über Grid, Fixed-Tick-Loop
(Pause/1x/3x/10x), Savegame-Roundtrip getestet.
Tasks: M0.1 Gerüst · M0.2 RNG · M0.3 Zustand/Actions/Savegame · M0.4 Loop ·
M0.5 Kamera+Renderer · M0.6 HUD+Persistenz · M0.7 Determinismus-Test.

## M1 – Welt (ABGESCHLOSSEN)

DoD erfüllt: 512x512 per Seed reproduzierbar; Layer Höhe, Wasser/Flüsse, Fruchtbarkeit,
Wald, Vorkommen (Stein, Ton, Kohle, Eisen, Öl); Minimap; jeder Layer als Debug-Overlay.
Tasks: M1.1 Noise · M1.2 Höhe+Wasser · M1.3 Flüsse · M1.4 Fruchtbarkeit+Wald ·
M1.5 Vorkommen · M1.6 Layer im WorldState/Savegame v2 · M1.7 Overlays+Minimap · M1.8 Repro-Tests.

## M2 – Netz (AKTUELL)

DoD:
- Strassen bauen und abreissen mit der Maus (Drag), Bau- und Unterhaltskosten.
- Strassentypen mit Kapazität und Tempo.
- Aufbau eines Graphen aus dem Grid, A*-Pathfinding mit Cache.
- Zwei Punkte verbinden: Route und Reisezeit werden angezeigt.

Tasks:
- [x] M2.1 Strassen-Datenmodell: road-Layer im WorldState, Strassentypen + Kosten in /src/data, Actions buildRoad/demolishRoad
- [~] M2.2 Grid-Graph + A* mit Cache (DOM-frei, getestet: Korrektheit, Determinismus, Cache-Wirksamkeit)
- [ ] M2.3 Reisezeit-Modell pro Strassentyp/Terrain, Routenberechnung als Action/Ergebnis-Layer
- [ ] M2.4 UI: Drag-Bau/-Abriss mit Kostenabzug, Routen-Overlay (Pfad + Reisezeit-Anzeige)
- [ ] M2.5 Unterhaltskosten-Basis (pro Tick verbucht, sichtbar im HUD), Savegame erweitert

## M3 – Siedlung (nächster Meilenstein, noch nicht zerlegt)

DoD: Stadtgründung an beliebiger Stelle, Zonen (Wohnen/Gewerbe/Industrie), Gebäude
entstehen und verfallen abhängig von Nachfrage, Strassenanschluss und Lage;
eine gezonte, angeschlossene Stadt wächst über die Zeit von selbst.
