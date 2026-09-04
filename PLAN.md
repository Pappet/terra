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

## M4 – Menschen (AKTUELL)

DoD:
- Bevölkerung als Kohorten (Alter, Bildung, Einkommen).
- Arbeitsplätze; Zuweisung Wohnort→Arbeitsplatz über den Graphen.
- Reisezeit und Stau wirken auf die Zuweisung zurück.
- Zufriedenheit, Zuzug und Wegzug.
- Pendeln über Stadtgrenzen hinweg ist ausdrücklich erlaubt; Pendleraufkommen im
  Overlay sichtbar und reagiert auf neue Strassen.
- DoD: Zwei nahe Städte teilen sich einen Arbeitsmarkt.

Tasks:
- [x] M4.1 Kohorten-Datenmodell: pro Stadt Alters-/Bildungs-/Einkommens-Buckets (TypedArrays), Savegame v6
- [x] M4.2 Bevölkerungsdynamik: Alterung, Geburten/Sterbefälle, Wohnkapazität begrenzt
- [x] M4.3 Arbeitsplätze aus Gebäuden (R/C/I), Erwerbsquote, Zuweisung Wohnort->Job über A*
- [x] M4.4 Pendler-Modell: Job-Zuweisung über Stadtgrenzen nach Reisezeit; Stau/Kapazität dämpft
- [x] M4.5 Zufriedenheit + Zuzug/Wegzug (reagiert auf Jobs, Pendelzeit, Wohnraum)
- [~] M4.6 Pendler-Overlay (Flüsse zwischen Städten), Reaktivität auf neue Strassen getestet
- [ ] M4.7 DoD-Nachweis: zwei nahe Städte teilen sich einen Arbeitsmarkt (deterministisch)

## M4 – Menschen (nächster Meilenstein, noch nicht zerlegt)

DoD: Bevölkerung als Kohorten (Alter, Bildung, Einkommen), Arbeitsplätze, Zuweisung
Wohnort→Arbeitsplatz über den Graphen, Reisezeit/Stau wirken zurück; Zufriedenheit,
Zuzug/Wegzug; Pendeln über Stadtgrenzen hinweg sichtbar und reaktiv.
