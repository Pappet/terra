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

## M2 – Netz (ABGESCHLOSSEN)

DoD erfüllt: Strassen bauen/abrissen per Drag mit Bau-/Unterhaltskosten; drei Typen mit
Kapazität/Tempo; Grid-Graph + A* mit Cache; Route + Reisezeit sichtbar (Overlay + Infozeile).
Tasks: M2.1 Datenmodell · M2.2 A*+Cache · M2.3 Reisezeit+Route-Action · M2.4 Werkzeug-UI · M2.5 Unterhalt.

## M3 – Siedlung (AKTUELL)

DoD:
- Stadtgründung an beliebiger Stelle (auf Land, per Werkzeug).
- Zonen (Wohnen/Gewerbe/Industrie) innerhalb eines Stadtradius.
- Gebäude entstehen und verfallen abhängig von Nachfrage, Strassenanschluss und Lage.
- Eine gezonte, angeschlossene Stadt wächst über die Zeit von selbst.

Tasks:
- [x] M3.1 Städte-Datenmodell: cities als SoA (IDs, Position, Name), Action foundCity
- [x] M3.2 Zonen als Layer + Zonen-Werkzeug/Actions, Gebäude-Datenmodell (SoA)
- [x] M3.3 Nachfrage-Modell (R/C/I im Gleichgewicht, Wachstumsdruck aus Anschluss/Lage)
- [x] M3.4 Gebäude-Entstehung/-Verfall pro Tick (gezont + angeschlossen -> Bau; ohne Anschluss -> Verfall)
- [x] M3.5 Stadt-Panel (Bevölkerung/Zonen/Gebäude), Debug-Overlay Zonen/Gebäude, Savegame
- [~] M3.6 Wachstums-Nachweis: gezonte angeschlossene Stadt wächst; nicht angeschlossene schrumpft

## M4 – Menschen (nächster Meilenstein, noch nicht zerlegt)

DoD: Bevölkerung als Kohorten (Alter, Bildung, Einkommen), Arbeitsplätze, Zuweisung
Wohnort→Arbeitsplatz über den Graphen, Reisezeit/Stau wirken zurück; Zufriedenheit,
Zuzug/Wegzug; Pendeln über Stadtgrenzen hinweg sichtbar und reaktiv.
