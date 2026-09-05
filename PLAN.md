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

## M5 – Wirtschaft (ABGESCHLOSSEN)

DoD erfüllt: Produktionsketten (Holz→Bretter→Werkzeug, Rezeptauswahl D006 nach Umgebung+Kettenausgleich),
Lagerbestände pro Stadt, lokale Preise aus Angebot/Nachfrage (geklemmt, deterministisch), Arbeitskraft als Input,
Performance-Review: 0.01 ms/Tick avg / 0.77 ms max bei 512er+10 Städten — kein Worker-Umzug nötig;
DoD-Test m5.proof.test.ts (Engpass-Kaskade über zwei Stufen).
Tasks: M5.1 Güter/Lager · M5.2 Produktion · M5.3 Preise · M5.4 Finanzen · M5.5 Performance · M5.6 Nachweis.

## M6 – Handel (ABGESCHLOSSEN)

DoD erfüllt: Güterflüsse als aggregierte Mengen pro Städtepaar und Tick; Arbitrage
(Preisdifferenz > Transportkosten + Mindestmarge), Korridorkapazität deckelt mit
Marge-Priorisierung (Verstopfung); Import/Export-Bilanzen (Savegame v9); Handels-Overlay;
DoD-Test m6.proof.test.ts (Rohstoff- vs. Industriestadt, Preis-Asymmetrie hält sich, Gegenprobe ohne Korridor).
Tasks: M6.1 Routen-Modell · M6.2 Arbitrage · M6.3 Transport/Kapazität · M6.4 Overlay+Bilanz · M6.5 Nachweis.

## M7 – Verwaltung (AKTUELL)

DoD:
- Steuersätze, Budget, Unterhaltskosten, Kredite, Bankrott.
- Statistiken mit Zeitreihen-Graphen.
- Vollständiges Speichern/Laden inklusive UI-Zustand.
- DoD: Man kann eine Stadt durch schlechte Steuerpolitik ruinieren.

Tasks:
- [x] M7.1 Steuersatz-Steuerung (setTaxRate-Action, HUD-Buttons 0–100 %), Einnahmen reagieren — Savegame v10
- [x] M7.2 Budget-Panel: Einnahmen/Ausgaben-Aufstellung (Steuern, Unterhalt, Netto/Tick, Schulden)
- [x] M7.3 Kredite: takeLoan/repayLoan, Zins kapitalisiert, Kreditlimit maxDebtPerAdult × Erwachsene
- [x] M7.4 Bankrott: Kasse < −100 → bankrupt blockiert Bau/Zonen; Erholung ab Kasse ≥ 0 — Savegame v11
- [x] M7.5 Statistiken: Zeitreihen (Kasse, Einwohner, Zufriedenheit) als Canvas-Liniendiagramm (Taste S) — Savegame v12
- [ ] M7.6 Speichern/Laden inkl. UI-Zustand (Geschwindigkeit, aktives Overlay; taxRate ist bereits im Savegame)
- [ ] M7.7 DoD-Nachweis: schlechte Steuerpolitik ruiniert eine Stadt (deterministisch; Hebel: taxBurdenOnSatisfaction → Wegzug → Kollaps)

## M8 – Tiefe (nächster Meilenstein, noch nicht zerlegt)

DoD: Strom- und Wassernetz, Verschmutzung und Umwelt, Bildung, Migration zwischen
Städten, Ereignisse/Katastrophen, Bodenwert. Jedes Subsystem hat mindestens eine
Rückkopplung in ein anderes.

## M9 – Konsolidierung (nach M8, benutzergelieferte Spec)

specs/M9-KONSOLIDIERUNG.md (von Peter): nach Abschluss und DoD-Nachweis von M8
zerlegen und abarbeiten. Grundregel: keine neuen Features, Verhaltensänderungen nur
wo eine Task es verlangt, zuerst Golden Master (M9.1) vor Umbauten.
