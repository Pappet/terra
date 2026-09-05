# M9 – Konsolidierung (Spezifikation, von Peter)

Dieser Meilenstein wird nach Abschluss und DoD-Nachweis von M8 bearbeitet.
Zerlege ihn dann in PLAN.md in Tasks und arbeite sie in der üblichen
Arbeitsschleife ab.

GRUNDREGEL FÜR M9
In M9 werden keine neuen Spielfeatures gebaut. Jede Feature-Idee, die dir
unterwegs kommt, wandert nach BACKLOG.md und wird nicht umgesetzt.
Verhaltensänderungen an der Simulation sind nur dort erlaubt, wo eine Task
das ausdrücklich verlangt. Alles andere ist reines Umsortieren bei
unverändertem Verhalten.

M9.1 Golden Master (zuerst, vor allem anderen)
  Baue ein Regressionsnetz, bevor du irgendetwas umbaust: fester Seed, feste
  Aktionsliste, feste Tickzahl (gross genug, dass Wachstum, Demografie,
  Produktion, Preise und Handel alle mindestens einmal gefeuert haben).
  Serialisiere den Endzustand, bilde einen Hash darüber und committe ihn als
  Referenzdatei. Ein Test vergleicht gegen diese Referenz.
  Regel: Der Hash darf sich in M9 nur ändern, wenn eine Task ausdrücklich eine
  Verhaltensänderung verlangt oder die Savegame-Version bewusst erhöht wird.
  Dann wird die Referenz in einem eigenen Commit neu erzeugt, mit Begründung
  im JOURNAL. Ändert sich der Hash unerwartet, ist das ein Bug – nicht die
  Referenz anpassen, sondern die Ursache suchen.
  DoD: Test grün, Referenz committed.

M9.2 Perf-Gate mit echter Last
  Der bisherige Performance-Test misst 10 Städte mit je 5 Gebäuden. Das ist
  keine realistische Last und trägt die Entscheidung gegen den Web Worker nicht.
  Ersetze ihn: Welt 512x512, Städte gründen, zonen, anschliessen und dann so
  lange laufen lassen, bis die Städte tatsächlich gewachsen sind
  (Zielgrösse mindestens 2000 Gebäude und 20.000 Einwohner gesamt). Erst dann
  über mehrere hundert Ticks messen.
  Miss zusätzlich pro Subsystem (Wachstum, Demografie, Beschäftigung,
  Produktion, Markt, Handel, M8-Netze), nicht nur den Gesamttick, und
  protokolliere die Zahlen im JOURNAL.
  Wird das Budget von 16 ms gerissen: erst die teuerste Stelle optimieren,
  dann erneut messen. Bleibt es gerissen, ist der Worker-Umzug eine Task in
  M9 und kein Backlog-Eintrag.
  DoD: Messwerte bei realistischer Last dokumentiert, Entscheidung zum Worker
  mit diesen Zahlen begründet.

M9.3 world.ts aufteilen
  src/sim/world.ts ist über 400 Zeilen und der Kern, an dem jedes Subsystem
  hängt. Zerlege ihn entlang der Verantwortlichkeiten, z.B. Zustand/SoA-Anlage,
  Tick-Orchestrierung, Serialisierung, Anwendung von Actions.
  Keine Verhaltensänderung: Golden-Master-Hash und alle Tests müssen vor und
  nach dem Umbau identisch sein. Arbeite in kleinen Schritten mit Commit nach
  jedem Teilschritt, nicht in einem grossen Rutsch.
  Prüfe anschliessend alle Dateien: nichts über 400 Zeilen.
  DoD: keine Datei über 400 Zeilen, Hash unverändert, Tests grün.

M9.4 Test-Hygiene
  tests/dbg6.test.ts und tests/dbg11.test.ts sind Debug-Reste und geben bei
  jedem Lauf console.log aus. Prüfe, ob sie echtes Verhalten absichern: wenn
  ja, in einen benannten Regressionstest ohne Ausgabe überführen, wenn nein,
  löschen. Danach: keine console-Ausgabe mehr im Testlauf ausser bei
  bewussten Diagnosewerkzeugen.
  Sieh die Testnamen einmal durch: jeder Test soll benennen, welches
  Verhalten er absichert, nicht welche Task ihn erzeugt hat.
  DoD: sauberer, stummer Testlauf, alle Tests grün.

M9.5 FRAGEN.md leeren
  In FRAGEN.md liegen seit M0 unbeantwortete Punkte. Du wartest nicht länger
  darauf. Entscheide jede offene Frage selbst, nach der Leitplanke
  "Simulationstiefe vor Grafik", setze sie um, halte die Entscheidung mit
  Begründung in DECISIONS.md fest und streiche sie aus FRAGEN.md.
  Ab jetzt gilt: FRAGEN.md enthält nur noch Punkte, die du wirklich nicht
  selbst entscheiden kannst, weil sie Peters Geschmack betreffen und das
  Spiel ohne Antwort nicht weitergebaut werden kann. Alles andere entscheidest
  du und dokumentierst es.
  DoD: FRAGEN.md ist leer oder enthält nur echte Blocker.

M9.6 BACKLOG triagieren
  Gehe jeden Eintrag in BACKLOG.md durch und gib ihm genau einen von drei
  Ausgängen:
  (a) jetzt erledigen, wenn es klein ist und zur Konsolidierung passt,
  (b) verwerfen mit einem Satz Begründung, wenn es sich überholt hat,
  (c) einem künftigen Meilenstein zuordnen, mit Datum und Zielmeilenstein.
  Konkret offen sind unter anderem: Einkommens-Mobilität aus M4.2, benannte
  RNG-Streams pro Subsystem, binäres Savegame-Format, Einzelagenten-
  Visualisierung der Pendler (ab jetzt erlaubt).
  Die RNG-Streams sind der einzige Eintrag mit Determinismus-Risiko: wenn du
  ihn umsetzt, ändert sich der Golden Master zwangsläufig — dann als eigene
  Task mit neu erzeugter Referenz und Begründung.
  DoD: kein untriagierter Eintrag mehr im BACKLOG.

M9.7 Balance-Werte einsammeln
  Die Architekturregel lautet: keine Balance-Zahl steht im Code. Prüfe
  src/sim und src/worldgen auf Zahlen-Literale, die faktisch Designgrössen
  sind (Schwellen, Raten, Faktoren, Intervalle) und ziehe sie nach src/data.
  Reine Struktur-Konstanten (Array-Indizes, Bitmasken, Nachbarschafts-Offsets)
  bleiben, wo sie sind.
  DoD: die Tabellen in src/data sind die einzige Stelle, an der man das
  Spielgefühl verstellt; Hash unverändert.

M9.8 Toter Code
  Aktiviere noUnusedLocals/noUnusedParameters in tsconfig und räume auf, was
  auffällt: nicht genutzte Exporte, tote Zustandsfelder, verwaiste
  TODO-Kommentare. Ein totes Feld im Weltzustand ist besonders teuer, weil es
  mitserialisiert wird.
  DoD: Build ohne Warnungen, Hash unverändert.

M9.9 Dokumentation
  README.md: was das Spiel ist, wie man es startet, wie man testet, welchen
  Stand es hat.
  Neu ARCHITECTURE.md: die Reihenfolge der Subsysteme innerhalb eines Ticks
  und wer von wem liest und schreibt, dazu die Regeln zu Determinismus,
  Savegame-Versionierung und der Grenze zwischen sim, render und ui.
  Das ist die Datei, die eine spätere Session zuerst liest, damit sie den
  Tickfluss nicht aus dem Code rekonstruieren muss.
  DoD: beide Dateien aktuell und mit dem Code konsistent.

M9.10 Abnahme
  Prüfe am Stück und protokolliere das Ergebnis im JOURNAL:
  - alle Tests grün, Testlauf ohne Fremdausgabe
  - npm run build grün
  - Golden-Master-Hash gleich dem Stand nach M9.1, oder jede Abweichung im
    JOURNAL begründet
  - keine Quelldatei über 400 Zeilen
  - FRAGEN.md leer oder nur echte Blocker
  - BACKLOG vollständig triagiert
  - Perf-Zahlen bei realistischer Last dokumentiert
  Danach schreibst du in PLAN.md einen Vorschlag für M10 auf Basis dessen,
  was dir bei der Konsolidierung an Schwächen aufgefallen ist.
