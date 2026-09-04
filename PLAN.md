# PLAN

## M0 – Gerüst (AKTUELL)

DoD:
- Test "gleicher Seed + gleiche Aktionsliste = identischer Weltzustand nach 1000 Ticks" ist grün.
- Man kann über ein leeres Grid scrollen und zoomen.
- Fixed-Tick-Loop mit Geschwindigkeitsstufen Pause/1x/3x/10x.
- Savegame-Roundtrip (Serialisierung + Deserialisierung) getestet.

Tasks:
- [x] M0.1 Projektgerüst: Vite+TS+Vitest, Ordnerstruktur, Docs
- [x] M0.2 Seeded RNG (mulberry32) mit Zustands-Export für Savegames + Tests
- [x] M0.3 Weltzustand (TypedArrays), Action-Pipeline, Savegame-Serialisierung + Tests
- [~] M0.4 Fixed-Tick-Loop mit Geschwindigkeitsstufen, entkoppelt vom Rendering + Tests
- [ ] M0.5 Kamera (Pan/Zoom/Tastatur) + Canvas-Rendering mit Layer-Caching
- [ ] M0.6 UI: HUD (Speed, Seed, Tick), Paint-Tool, IndexedDB-Save + Datei-Export/Import
- [ ] M0.7 Determinismus-Test (1000 Ticks, identischer Zustand) + Build grün

## M1 – Welt (nächster Meilenstein, noch nicht begonnen)

DoD:
- Karte per Seed reproduzierbar (mindestens 512x512).
- Layer Höhe, Wasser/Flüsse, Fruchtbarkeit, Wald, Vorkommen (Stein, Ton, Kohle, Eisen, Öl).
- Minimap; jeder Layer einzeln als Debug-Overlay einblendbar.

(Zerlegung in Tasks erfolgt, wenn M0 abgeschlossen ist.)
