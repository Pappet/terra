# PLAN

## M0 – Gerüst (ABGESCHLOSSEN)

DoD (alle erfüllt):
- [x] Test "gleicher Seed + gleiche Aktionsliste = identischer Weltzustand nach 1000 Ticks" ist grün.
- [x] Man kann über ein leeres Grid scrollen und zoomen.
- [x] Fixed-Tick-Loop mit Geschwindigkeitsstufen Pause/1x/3x/10x.
- [x] Savegame-Roundtrip (Serialisierung + Deserialisierung) getestet.

Tasks (alle [x]): M0.1 Gerüst · M0.2 Seeded RNG · M0.3 Weltzustand/Actions/Savegame ·
M0.4 Fixed-Tick-Loop · M0.5 Kamera+Renderer · M0.6 HUD+Persistenz · M0.7 Determinismus-Test.

## M1 – Welt (AKTUELL)

DoD:
- Karte per Seed reproduzierbar, mindestens 512x512.
- Layer: Höhe, Wasser/Flüsse, Fruchtbarkeit, Wald, Vorkommen (Stein, Ton, Kohle, Eisen, Öl).
- Minimap; jeder Layer einzeln als Debug-Overlay einblendbar.

Tasks:
- [x] M1.1 Noise-Basis: Value-Noise (2D, fBm) auf Rng-Basis, DOM-frei getestet
- [x] M1.2 Höhen-Layer + Wasserlinie; Kartengrösse auf 512x512, Performance-Check
- [~] M1.3 Flüsse: Abfluss von Höhen-Hochpunkten, Graben zur Senke, Wasser-Layer
- [ ] M1.4 Fruchtbarkeit + Wald als abgeleitete Layer
- [ ] M1.5 Vorkommen: Stein, Ton, Kohle, Eisen, Öl (regionalisiert, seed-abhängig)
- [ ] M1.6 Layer-Datenmodell im WorldState (Uint8Arrays) + Speicherung im Savegame
- [ ] M1.7 Debug-Overlays: Layer-Umschalter (Tasten/HUD), Minimap
- [ ] M1.8 Reproduzierbarkeits-Test: gleicher Seed -> identische Karte; 512er-Karte im Zeitbudget

## M2 – Netz (nächster Meilenstein, noch nicht zerlegt)

DoD: Strassen bauen/abreissen (Drag), Bau-/Unterhaltskosten, Strassentypen mit
Kapazität/Tempo, Grid-Graph, A* mit Cache; Route + Reisezeit sichtbar.
