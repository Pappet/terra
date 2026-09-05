# BACKLOG (triagiert, M9.6 — Status je Eintrag: ERLEDIGT / VERWORFEN / ZUORDNUNG)

- **Einkommens-Mobilität (M4.2-Rest)** — ZUORDNUNG: **M10** (Vorschlag 2026-03-05, PLAN.md).
  Geburten landen derzeit nur in Einkommensgruppe 0/1 (nach elterlicher Bildung); Gruppe
  "hoch" entsteht nur durch Job-Zuweisung. Ist eine echte Verhaltensänderung → gehört in
  einen Feature-Meilenstein, nicht in die Konsolidierung.
- **Binäres/base64-Savegame-Format** — VERWORFEN (überholt). Layer sind seit M1 base64
  (worldSerialize.ts); der Rest sind kleine SoA-Arrays. 512er-Savegame bleibt getestet
  unter 5 MB JSON (world.test.ts), menschenlesbar, Roundtrip abgesichert. Nutzen eines
  Binärformats wäre nur Kompression — kein spielerischer Wert.
- **RNG als benannte Streams pro Subsystem** — VERWORFEN. Alle Subsysteme ticken in
  fester Reihenfolge innerhalb eines update(); ein einziger Welt-RNG genügt und ist der
  Kern des Determinismus-Modells. Streams würden den Golden Master ohne spielerischen
  Nutzen brechen (M9.1-Regel: Hash-Änderung braucht Begründung).
- **Einzelagenten-Visualisierung der Pendler** — ZUORDNUNG: **M10** (Vorgabe „ab jetzt
  erlaubt"). Reine Render-Feature, keine Sim-Änderung; gehört in einen Feature-
  Meilenstein, nicht in die Konsolidierung.
- **Web-Worker-Umzug der Sim** — VERWORFEN (durch M9.2-Messung entschieden). Bei
  6326 Gebäuden / 20434 Einwohnern: 1.011 ms/Tick avg, 4.467 ms max (Budget 16 ms,
  JOURNAL M9.2). Der Umzug brächte IPC-Komplexität ohne messbaren Gewinn.
