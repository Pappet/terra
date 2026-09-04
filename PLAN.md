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

## M3 – Siedlung (ABGESCHLOSSEN)

DoD erfüllt: Stadtgründung per Werkzeug; Zonen R/C/I im Stadtradius; Gebäude entstehen
und verfallen nach Nachfrage, Strassenanschluss und Lage; gezonte angeschlossene Stadt
wächst von selbst (DoD-Test m3.proof.test.ts).
Tasks: M3.1 Städte-SoA · M3.2 Zonen+Gebäude · M3.3 Nachfrage · M3.4 Wachstums-Tick ·
M3.5 Panel/Werkzeug · M3.6 Wachstums-Nachweis.

## M4 – Menschen (ABGESCHLOSSEN)

DoD erfüllt: Bevölkerung als Kohorten (Alter/Bildung/Einkommen), Arbeitsplätze mit
Zuweisung Wohnort→Job über A* (städtepaarweise aggregiert), Stau/Korridorkapazität dämpft,
Zufriedenheit + Zuzug/Wegzug, Pendeln über Stadtgrenzen; Pendler-Overlay; DoD-Test
m4.proof.test.ts (geteilter Arbeitsmarkt, Reaktivität auf Strassenausbau).
Tasks: M4.1 Kohorten · M4.2 Dynamik · M4.3 Jobs/Zuweisung · M4.4 Korridore ·
M4.5 Zufriedenheit/Migration · M4.6 Overlay · M4.7 Nachweis.

## M5 – Wirtschaft (AKTUELL)

DoD:
- Produktionsketten (Rohstoff → Zwischengut → Konsumgut).
- Lagerbestände, lokale Preise aus Angebot und Nachfrage.
- Arbeitskraft als Input.
- Performance-Review: falls der Tick das Budget (16 ms) reisst, jetzt in den Web Worker umziehen.
- DoD: Ein Engpass in einer Vorstufe schlägt messbar auf die nachgelagerte Produktion durch.

Tasks:
- [x] M5.1 Güter- und Rezept-Tabellen in /src/data (Holz, Stein, Erz, Bretter, Werkzeug, Nahrung, ...), Lagerbestände pro Stadt (SoA/Float64Array)
- [~] M5.2 Produktions-Tick: Gebäude wandeln Inputs unter Einsatz von Arbeitskraft in Outputs, engpassgetrieben
- [ ] M5.3 Lokale Preise aus Angebot/Nachfrage (Preisanpassung pro Gut und Stadt, deterministisch)
- [ ] M5.4 Bau-/Unterhaltskosten an Wirtschaft koppeln (Kasse/Einnahmen aus Steuern vorbereiten)
- [ ] M5.5 Performance-Review: Tick-Zeit messen (512er-Karte, 10 Städte); ggf. Worker-Umzug
- [ ] M5.6 DoD-Nachweis: Vorstufen-Engpass schlägt auf nachgelagerte Produktion durch (deterministisch)

## M6 – Handel (nächster Meilenstein, noch nicht zerlegt)

DoD: Güterflüsse zwischen Städten entlang des Netzes; Handel entsteht, wenn die
Preisdifferenz die Transportkosten übersteigt; Transportkapazität begrenzt, Routen
können verstopfen; Import/Export-Bilanz pro Stadt; DoD: rohstoffreiche und
industrielle Stadt spezialisieren sich von selbst.

## M4 – Menschen (nächster Meilenstein, noch nicht zerlegt)

DoD: Bevölkerung als Kohorten (Alter, Bildung, Einkommen), Arbeitsplätze, Zuweisung
Wohnort→Arbeitsplatz über den Graphen, Reisezeit/Stau wirken zurück; Zufriedenheit,
Zuzug/Wegzug; Pendeln über Stadtgrenzen hinweg sichtbar und reaktiv.
