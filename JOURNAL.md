# JOURNAL

## 2026-03-05 – M7.7 DoD-Nachweis (Ruin durch Steuerpolitik)
**Gebaut:** m7.proof.test.ts auf der erweiterten lineWorld-Fake (demographics+settleResidents+bankrupt in der Pipeline): Zwei identische Städte, einziger Unterschied Steuersatz 100 % vs. 25 %, 600 Ticks/3 Intervalle — Ruin-Stadt klarer Wegzug (8.67 < 9 Start), moderat besteuerte Stadt besser erhalten, Differenz > 0.5; deterministisch.
**Entscheidungen + Lehren:**
- fakes.ts um demographics-Option, settleResidents, bankrupt-Check, history erweitert — die Fake-Pipeline deckt jetzt die volle Intervall-Mechanik ab.
- Assertions auf Differenz statt absolute Residenten-Schwellen: Sat-Oszillation durch Alterung/EMA macht Absolutwerte unzuverlässig; die Richtungs- und Größenordnungsaussage ist der DoD.
-tests/fakes.ts braucht jetzt auch history/bankrupt/settleResidents — das Fake deckt die volle Intervall-Mechanik ab (notiert für künftige Intervall-Features: Fake mitziehen).
**Offen:** M7.6 (UI-Zustand im Savegame) — letzter offener M7-Task.

## 2026-03-05 – M7.5 Statistiken mit Zeitreihen
**Gebaut:** `world.history` (Sample pro Demografie-Intervall: tick/treasury/residents/durchschnittliche Zufriedenheit, max 200 Einträge, Savegame **v12**) und StatsPanel (Taste S): minimales Canvas-Liniendiagramm ohne Library, zeichnet nur bei Sichtbarkeit.
**Entscheidungen:**
- Sampling im Demografie-Intervall (1 Sample ≈ 1 "Jahr") statt pro Tick: 200 Samples decken ~2000 s Spielzeit ab; Tick-Rauschen uninteressant.
- Diagramm bewusst handgezeichnet auf Canvas (Guardrail: minimal halten, keine Chart-Library).
**Offen:** M7.6 UI-State-Save, M7.7 Ruin-Nachweis.

## 2026-03-05 – M7.2 Budget-Panel
**Gebaut:** `computeTaxIncome` (erwartete Steuern pro Intervall, spiegelt die Intervall-Formel), Budget-Panel links: Kasse (+BANKROTT-Flag), Steuern/Intervall, Unterhalt/Tick (Straßen/Gebäude getrennt), Netto/Tick, Schulden. Aktualisierung im 4×/s-UI-Zyklus.
**Entscheidungen:** Panel liest die Steuerformel über die exportierte Funktion statt den letzten Intervallwert zu cachen — immer aktuell, auch bei Steuersatzwechsel mitten im Intervall.
**Offen:** M7.5 Statistiken, M7.6 UI-State-Save, M7.7 Ruin-Nachweis.

## 2026-03-05 – M7.3/M7.4 Kredite + Bankrott
**Gebaut:** `takeLoan`/`repayLoan`-Actions (Kreditlimit = maxDebtPerAdult × Erwachsene, Tilgung pay = min(Betrag, Schuld, Kasse)), Zins kapitalisiert pro Intervall (5 %), Bankrott-Prüfung in **jeden** update() (Kasse < −100 → bankrupt: kein Bau/Zonen; Erholung ab Kasse ≥ 0), `computeMaxDebt` läuft in jeden update (Actions brauchen das Limit sofort, nicht erst zum Intervall), Steuerlast senkt Zufriedenheit (−taxBurden 0.3 bei Volllast) — der M7.7-Ruin-Hebel. Tests isoliert (Berater-Hinweis): taxRate 0, keine Gebäude/Straßen → treasury = f(Kredite) exakt; Limit- und Tilgungsfälle separat. 218 Tests grün.
**Entscheidungen + Lehren:**
- Zins kapitalisiert (Schuld wächst) statt sofortiger Kassenbelastung — beides gebucht, Saldo treasury+debt bleibt ohne Unterhalt konstant (getestet).
- Bankrott-Prüfung pro Tick statt im Intervall: Zustands-Flag muss immer stimmen (Actions fragen es ab).
- maxDebt pro Update statt pro Intervall: Action-Kontext braucht aktuelle Limits.
- Berater-Hinweis exakt befolgt: exakte Kassen-Assertions nur auf isolierter Mechanik; Live-Sim-Assertions bleiben Bereichs-/Richtungschecks.
**Offen:** M7.2 Budget-Panel, M7.5 Statistiken, M7.6 UI-State-Save, M7.7 Ruin-Nachweis.

## 2026-03-05 – M7.1 Steuersatz-Steuerung
**Gebaut:** `setTaxRate`-Action (0..1, ungültig → lastRejected), `World.taxRate` (Savegame **v10**), Steuern in der Demografie × taxRate, HUD: Steuer-Buttons 0/25/50/75/100 % oben rechts. Tests: Satz 0 → keine Einnahmen, 0.5 → exakt halbe Brutto-Einnahmen, Ablehnung ungültiger Sätze, Roundtrip v10, Determinismus. 212 Tests grün.
**Entscheidungen:**
- Globaler Satz statt pro Stadt: M7-DoD ("Stadt durch Steuerpolitik ruinieren") funktioniert über den globalen Hebel; pro-Stadt-Sätze kommen mit M8 (Stadtidentität stärker differenzieren).
- Steuersatz als Sim-Parameter über die Action-Pipeline (D003): UI setzt nichts direkt.
**Offen:** M7.2 Budget-Panel, M7.3 Kredite, M7.4 Bankrott, M7.5 Statistiken, M7.6 UI-State-Save, M7.7 Ruin-Nachweis.

## 2026-03-05 – M6.5 DoD-Nachweis + M6-Abschluss
**Gebaut:** m6.proof.test.ts: Holzfäller-Stadt A, Sägewerk+Werkstatt-Stadt B. Über 300 Ticks: A exportiert Holz (>5 Einheiten), B importiert es und produziert Bretter; Preis-Asymmetrie (B-Holz teurer als A-Holz) hält sich selbst; Spezialisierung strukturell geprüft (A nur Extraktionsrezepte, B nur Verarbeitungsrezepte); B's Bretter-Überschuss fließt per Arbitrage zurück nach A (Preis-Boden). Gegenprobe: Wasser trennt die Städte → keine Importe, Industrie läuft in den Engpass-Stillstand. Determinismus geprüft. 207 Tests grün, Build grün. **M6 ist damit fertig.**
**Entscheidungen + Lehren:**
- Spezialisierung ist strukturell (Gebäuderezepte) + handelsökonomisch (Flussrichtung) geprüft; die Behauptung "A produziert keine Bretter" war falsch formuliert — A IMPORTIERT Bretter (Preis-Boden macht Arbitrage profitabel). assertion an Systemverhalten angepasst statt am Wunsch.
- Werkstatt blieb im Test ohne Volllast (12-Arbeiter-Limit, M4.3-Zuweisung) — keine Handelsfrage; dokumentiert statt behoben (M7/M8 können Prioritäten gewichten).
**Offen:** M7 (Verwaltung) — Zerlegung folgt.

## 2026-03-05 – M6.4 Handels-Overlay + Bilanz im Panel
**Gebaut:** Overlay "Handel": grüne Pfeile zwischen Stadtzentren (Strichstärke log zur Mengensumme des Paares); Stadt-Panel zeigt kumulierte X/M-Bilanzen.
**Entscheidungen:** Pfeile pro Frame gezeichnet (commute-Muster); Bilanzen als kumulierte Mengen (Preisbewertung kommt mit M7-Statistik).
**Offen:** M6.5.

## 2026-03-05 – M6.1–M6.3 Handelssystem
**Gebaut:** `trade.ts`: pro ungeordnetem Städtepaar eine Route (A*-Pfad, Korridorkapazität), Arbitrage je Gut und Richtung (Preisdifferenz − Reisezeit×Kostenfaktor ≥ Mindestmarge), Kandidaten nach Marge priorisiert teilen sich EIN Korridorbudget (Verstopfung), Flüsse aggregiert (Mengen/Tick), kumulierte Import-/Export-Bilanzen (Savegame **v9**). World.update: Handelsticker nach Markt. Tests: Arbitrage fließt, keine Preisdifferenz → kein Handel, Korridor-Deckel mit Priorisierung, Wasser trennt, Bilanz-Roundtrip, Determinismus. 204 Tests grün.
**Entscheidungen + Lehren:**
- **Doppelt-Versendung-Bug:** Routen pro geordnetem Paar liessen beide Richtungen dieselbe profitable Richtung mit 2× Kapazität versenden. Fix: ein Budget pro ungeordnetem Paar, beide Richtungen konkurrieren.
- **flows-Matrix:** ensureTradeSize füllte Zeilen mit Zahlen statt Gut-Arrays ("Cannot create property '0' on number '0'"); Struktur korrigiert, Zeilen wachsen mit (Städte werden später gegründet).
- Fake-Pipeline braucht syncPopulation-Äquivalent (ensureCity für population/storage/market), sonst skippt updateMarket still.
- Handel reagiert verzögert auf Preise (Drift bis Marge > Schwelle) — Tests messen in Fenstern/Fehlertoleranzen statt exakter Ticks.
- **tests/fakes.ts** zentralisiert (Berater-Hinweis befolgt): lineWorld/addAdults für employment-, m4-/m5-proof-Tests; m5.proof-Fake nutzt production:true-Pipeline.
**Offen:** M6.5.

## 2026-03-05 – M5.6 DoD-Nachweis + M5-Abschluss
**Gebaut:** m5.proof.test.ts auf deterministischer lineWorld (Fake-Welt mit schlanker update-Pipeline: Zuweisung + Produktion): Kette Holzfäller→Sägewerk→Werkstatt; Ausfall des Holzfällers → Restholz läuft leer → Sägewerk still → Werkstatt kaskadiert nach (Produktionsraten vor/nach verglichen, Erz reicht reichlich). 197 Tests grün, Build grün. **M5 ist damit fertig.**
**Entscheidungen:**
- lineWorld-Fake statt generierter Karte (Lektion aus M4 befolgt: keine Wasser-Roulette-Geographie in Kettentests); der Fake implementiert nur update/removeBuildingAt — die vollständige update()-Verkabelung ist durch die realen World-Tests abgedeckt.
- wood-Check `< 2` statt `=== 0`: take() kann den Bestand nie unter den Sägewerk-Bedarf senken, der Rest bleibt liegen — semantisch korrekter Engpass-Nachweis.
- Redaktionsunfälle (doppelte Deklaration, unreachable Code) kosteten mehrere Iterationen: künftig solche Umbauten in einem Schritt mit write statt mehrfachen python-Patches.
**Offen:** M6 (Handel) — Zerlegung folgt.

## 2026-03-05 – M5.5 Performance-Review
**Gebaut:** perf.test.ts mit realistischer Last: 512er-Karte, 10 Städte (Gründung, Straßenkreuz, je 5 Gebäude mit Anschluss, 60 Einwohner). Messung über 250 Ticks inkl. mindestens einem Demografie-/Migrations-/Zuweisungs-Intervall: **0.010 ms/Tick Durchschnitt, 0.766 ms teuerster Einzeltick** gegen Budget 16 ms. 
**Entscheidungen:**
- Kein Worker-Umzug: Budget um Faktor ~20 unterschritten; Umzug wäre verfrühte Komplexität (Guardrail: erst messen, dann optimieren). Der Test bleibt als Regressionsschutz (max-Tick-Assert) im Suite-Bestand.
- Max-Tick statt nur Durchschnitt gemessen: Der Intervall-Tick (Demografie+Migration+Zuweisung) ist der Peak und würde vom 250-Tick-Mittel verschleiert.
**Offen:** Worker-Umzug bleibt BACKLOG-Eintrag für den Fall, dass Karten/Städte deutlich wachsen.

## 2026-03-05 – M5.4 Finanzen + Intervall-Semantik-Bugfix
**Gebaut:** `FINANCE` in data/cities.ts (Steuern 6/Erwachsenem/Intervall, Einkommensfaktor 0.6/1/1.6, Gebäudeunterhalt 0.01/Tick); Steuern im Demografie-Intervall kassiert (nach Einkommensgruppe), Gebäudeunterhalt im Produktionstick abgezogen. **Echter Sim-Bug dabei gefunden:** das Demografie-Intervall feuerte mit `this.tick` (VOR Inkrement), also einen Tick vor dem "abschliessenden Tick" — inkonsistent mit der currentTick-Semantik aus M3.1 und Ursache der nicht erklärbaren Kassen-Deltas. Fix: Intervall-Argument = abschliessender Tick (tick+1). Tests: Steuer-Erwartung exakt (Steuern 71.856 − Unterhalt 35.64 über 198 Ticks), Unterhalt pro Tick, Determinismus, Druck-Szenario. 194 Tests grün.
**Entscheidungen:**
- Taxquote 6/Intervall ≈ 0.03/Tick/Kopf: bewusst auf Augenhöhe mit Straßenunterhalt (0.03/Tick/Tile) — eine Straße "kostet" so viel wie ein Bürger "bringt"; Feinbalance macht M7 (Steuersätze!).
- Rebalancing-Schritt war echtes Balancing-Ergebnis, nicht Testfälschung: Erst die Daten schief, dann Messung, dann Quote angepasst.
- Lehre: Off-by-one zwischen "Tick-Argument" und "abschließendem Tick" war nur durch Instrumentierung (taxdbg) auffindbar — die wiederholten identischen Zahlen (446.28) über mehrere Läufe waren das Alarmsignal.
**Offen:** M5.5 Performance-Review, M5.6 Engpass-Nachweis (Mechanismus getestet, formaler Test folgt).

## 2026-03-05 – M5.3 Lokale Preise
**Gebaut:** `Market` (Preise + EMA der Produktions-/Verbrauchsraten pro Stadt × Gut) und `updateMarket`: Druck = Nachfrage (Verbrauch-EMA + Grundnachfrage) / Angebot (Produktions-EMA + Lager/targetStock); Preis nähert sich basePrice × clamp(Druck, 0.5, 2) gedämpft an. Produktionstick liefert jetzt Güterflüsse (produced/consumed pro Stadt) an den Markt. Savegame **v8** (Marktvektoren serialisiert). Tests: Startpreise, Nachfrageüberschuss (Nahrung über Basis), Angebotsüberschuss (Holz unter Basis), Klemmen, Roundtrip, Determinismus. 189 Tests grün.
**Entscheidungen:**
- Grundnachfrage pro Gut in data/goods.ts: Güter ohne Verbraucher bekommen einen Preis-Boden (sonst kollabiert der Preis auf ε und M6-Handel kann nie lohnen).
- Preise sind deterministischer Zustand (in equalWorlds via Savegame-JSON gleich); Druckformel bewusst einfach (Nachfrage/(Produktion+Lageranteil)) — Elastizitäten kommen, wenn M6-Handel daraus entscheidet.
**Offen:** M5.4 Kasse, M5.5 Performance-Review, M5.6 Engpass-Nachweis (formal).

## 2026-03-05 – M5.2 Produktionstick + Rezeptauswahl (D006)
**Gebaut:** `Recipe.requires` (datengetriebene Umgebungsfilter: deposit-Bits/Forest/fertility mit Radius), `buildings.recipe`-SoA-Spalte (Savegame validiert), `chooseRecipe` (Umgebungsfilter → Kettenausgleich: wenigste Produzenten, Tie-Break ID), `runProductionTick` (beschäftigte Arbeiter in fester Gebäude-Reihenfolge zugeteilt, Rate = Arbeitsanteil, fehlender Input stoppt Output komplett). Tests: Kette baut sich selbst (Holzfäller→Sägewerk→Werkstatt), Umgebungsfilter, Produktion mit Arbeitern, Engpass (2 Sägewerke frieren bei leerem Holz-Lager ein), kein Arbeiter → kein Output, Determinismus. 183 Tests grün.
**Entscheidungen:**
- D006 (DECISIONS.md) zuerst skizziert, dann implementiert — Berater-Hinweis befolgt, der auf die Abhängigkeit des M5.6-DoD von dieser Regel hinwies.
- Hart-Engpass statt Teilauslastung bei fehlendem Input: messbar und einfach; weiche Drosselung später, falls M6-Handel Teilmengen braucht.
- Arbeitskraft-Zuteilung nach Gebäude-Reihenfolge (Array-Index): erste Stadtindustrie wird bedient zuerst — später kann Zufriedenheit/Bodenwert die Reihenfolge gewichten (BACKLOG).
- Testlehre verfeinert: "Waldtile" reicht nicht — Farm-Filter (fertility ≥ 0.35) machte fruchtbaren Wald zur gültigen Farm-Alternative. Die Regel war richtig, der Test suchte den falschen Tile (unfruchtbarer Wald).
**Offen:** M5.3 Preise, M5.4 Kasse, M5.5 Performance-Review, M5.6 Engpass-Nachweis (formal, Mechanismus getestet).

## 2026-03-05 – M5.1 Güter/Rezepte/Lager
**Gebaut:** `/src/data/goods.ts` (6 Güter mit Basispreisen, 7 Rezepte: Holzfäller/Steinbruch/Erzgrube/Farm → Sägewerk → Werkstatt, Markt als Konsument) und `Storage` (pro Stadt Float64-Vektor über Güter, add/take mit Bestandsdeckel), Savegame **v7** (Lagervektoren). Tests: ID-Kontiguität, Kettenverweise (Holz→Bretter→Werkzeug), add/take-Deckel, Roundtrip, Ablehnung kaputter Vektoren.
**Entscheidungen:**
- Rezept-Zuordnung (welches I-Gebäude welches Rezept ausführt) verschiebe ich auf M5.2: Bei Fertigstellung anhand Umgebung (Wald/Fels/Erz-Vorkommen) festlegen — dann ist die DoD-Kette "Engpass Vorstufe → nachgelagert" direkt testbar.
- Markt als reiner Konsument mit Output 0: Rezept-Invariante ist deshalb `output >= 0`, nicht `> 0` (getestet).
**Offen:** M5.2 Produktionstick, M5.3 Preise, M5.4 Kasse, M5.5 Performance-Review, M5.6 Engpass-Nachweis.

## 2026-03-05 – M4.7 DoD-Nachweis + M4-Abschluss
**Gebaut:** m4.proof.test.ts: Drei Städte in einer Reihe, Jobs nur in der mittleren — beide Nachbarstädte pendeln dorthin (geteilter Arbeitsmarkt, openJobs sinken), Pfad-Kapazität deckelt jeden Fluss bei 10, Chaussee-Ausbau hebt auf workerlimitiert 18 (Reaktivität). 171 Tests grün, Build grün. **M4 ist damit fertig.**
**Entscheidungen:**
- Reaktivitäts-Test auf der fake-Zeilenwelt über assignWorkers + Rev-Sprung; die Action→Dirty→Update-Verkabelung ist separat in employment.test abgedeckt — kleine Einheiten statt einer riesigen Integration.
**Offen:** Manuelle Browser-Abnahme durch Peter (FRAGEN.md); M5 (Wirtschaft) beginnt.

## 2026-03-05 – M4.6 Pendler-Overlay + Panel-Erweiterung
**Gebaut:** Overlay "Pendler": Oberflächenbasis + Linien zwischen Stadtzentren, Strichstärke logarithmisch zum Fluss; Zufriedenheit in Prozent im Stadt-Panel. Reaktivität auf neue Strassen ist bereits durch den M4.4-Test gedeckt (bessere Strasse erhöht Korridorfluss).
**Entscheidungen:** Linien bewusst pro Frame gezeichnet (nicht im Tile-Cache) – sie hängen von commute ab, das sich ohne tileRev-Änderung theoretisch ändern kann; ein Stroke pro Paar ist billig.
**Offen:** M4.7 (DoD-Nachweis).

## 2026-03-05 – M4.5 Zufriedenheit + Zuzug/Wegzug
**Gebaut:** `computeSatisfaction` (0..1 aus Beschäftigungsanteil ×0.45, Pendelzeit ×0.25 gegen Toleranz 60 Ticks, Wohnraum ×0.3) und `runMigration` im Demografie-Intervall: Zuzug ab 0.6 in freie Wohnkapazität (junge Erwachsene, Bildung per RNG), Wegzug unter 0.35 proportional über alle Kohorten. Läuft über `World.settleResidents` (neue API, setzt commuteDirty). Tests: Zufriedenheits-Sensitivität (Jobs ↑, Überbevölkerung ↓), Zuzug wächst innerhalb Kapazität, Wegzug schrumpft, Determinismus.
**Entscheidungen:**
- Migration im selben Intervall wie Demografie: ein "Jahrestick", saubere Reihenfolge (Alterung → Geburten → Migration → Zuweisung).
- Lehre (drittes Mal): feste Tile-Offsets auf generierten Karten treffen irgendwann Wasser. `findSpot`-Helper (freies Land + optional Strassenanschluss) ersetzt Offsets in den Demografie-Tests; growth.test hatte das Muster schon richtig.
- Zwischenfall dokumentiert: Beim Nachziehen von M4.5 löschte ein Python-Slice versehentlich `runDemographicsTick` — Datei komplett neu geschrieben statt geflickt.
**Offen:** nichts.

## 2026-03-05 – M4.4 Pendler-Korridorkapazität (Stau)
**Gebaut:** `routeCapacity` (kleinste Korridorkapazität entlang des A*-Pfades; Strassentyp-Kapazität, offroad = Trampelpfad 2) deckelt den Pendlerfluss pro Städtepaar: `take = min(Jobs, Erwerbstätige, Korridor)`. Überlauf geht auf die nächstbessere Route oder bleibt arbeitslos. `MOVEMENT.offroadCapacity = 2` in data. Tests: Pfad deckelt bei 10, Chaussee hebt auf joblimitiert 80 (Reaktivität auf Strassenausbau), Trampelpfad trägt nur 2, Regressions-Tests auf Kapazität umgestellt (lineWorld mit Strassentyp-Parameter).
**Entscheidungen:**
- Harte Korridor-Deckelung statt weicher Zeitverlängerung: einfach, deterministisch, direkt am DoD ("Stau/Kapazität dämpft die Zuweisung"). Weiche Stau-Faktoren auf Reisezeiten kommen mit M5/M8, wenn Preise/Attraktivität Reisezeiten gewichten.
- Korridorkapazität = min über alle Pfad-Tiles: der Engpass bestimmt die Route (klassische Fluss-Semantik).
**Offen:** nichts.

## 2026-03-05 – M4.3 Arbeitsplätze + Zuweisung über A*
**Gebaut:** `employment.ts`: `jobsOf` (C/I-Gebäude × jobsPerBuilding), `assignWorkers` (gierige Zuweisung nach Städtepaar-Reisezeit, eigene Stadt zuerst, Pendeln über Stadtgrenzen erlaubt; Kandidaten sortiert nach (Zeit, ID); nicht Erreichbare bleiben arbeitslos). `World.commute` (flows/employed/unemployed/openJobs) als deterministisch abgeleiteter Zustand (in equalWorlds verglichen, nicht serialisiert – beim Laden frisch gerechnet). `commuteDirty`-Invalidierung bei Stadtgründung, Gebäudebau/-verfall, Demografie-Intervall und Strassenwechsel. Reisezeiten: Zentrum→Zentrum über den A*-Cache, aggregiert pro Städtepaar.
**Entscheidungen:**
- Aggregierte Städtepaar-Flüsse statt Einzelpersonen-Routing (DoD verlangt Pendleraufkommen im Overlay, nicht Agenten); Einzel-Home→Job-Granularität wäre O(Worker×Jobs) A* – erst bei Bedarf (BACKLOG).
- `World.settleResidents` als echte API für Zuzug (M4.5) statt direkter Populations-Manipulation: hält das Dirty-Tracking zentral.
- Bug gefunden durch Roundtrip-Tests: Demografie-Intervall und Gebäudewechsel setzten commuteDirty nicht → stale Zuweisung vs. frisch geladene Welt. Zusätzlich Save/Replay-Test über das Demografie-Intervall nachgetragen (Berater-Frage: RNG wird nur in Intervall-Ticks konsumiert, Zustand reist im Savegame mit → bewiesen identisch).
- Testtechnik: handgebaute 1-Zeilen-Welten (lineWorld) für Assignment-Fälle mit voller Kontrolle (verbunden/getrennt/Konkurrenz), statt auf zufällige Kartenlayouts zu hoffen.
**Offen:** nichts.

## 2026-03-05 – M4.2 Nachtrag: Save/Replay-Beweis
**Gebaut:** Test "Save/Replay mitten im Lauf": Live-Lauf wird bei Tick 151 gespeichert, beide Läufe führen über das Demografie-Intervall (Tick 200) – identical worlds inklusive RNG-Verbrauch durch Bildungs-/Geburten-Würfe. Beantwortet die Berater-Frage: `runDemographicsTick` konsumiert den Welt-RNG nur in Intervall-Ticks, und da der RNG-Zustand im Savegame mitreist, ist die Fortsetzung exakt.
**Entscheidungen:**
- BACKLOG-Eintrag: Einkommens-Mobilität bei Geburten (derzeit nur Gruppe 0/1 nach elterlicher Bildung; "hoch" entsteht mit Job-Zuweisung M4.3 bzw. dynamisch ab M4.5/M7).
**Offen:** nichts.

## 2026-03-05 – M4.2 Bevölkerungsdynamik
**Gebaut:** `runDemographicsTick` (wirkt alle AGE_TICK_INTERVAL=200 Ticks): Alterung mit Bildungswanderung (Kinder→Grundbildung p=0.9, junge Erwachsene→Hochschule p=0.15), Sterbefälle je Altersgruppe, Geburten proportional zu Erwachsenen und **kapazitätsbegrenzt** durch Wohnhäuser (Häuser × residentsPerHouse). `housingCapacity()` für Tests/UI. Tests: Weiterziehen der Kohorten, Kapazitätsdeckel, Aussterben ohne Häuser, Ausdünnen der ältesten Gruppe, Determinismus. 155 Tests grün, Build grün.
**Entscheidungen:**
- Menschen als float in aggregierten Kohorten (Anzeige rundet) – glatte Dynamik, M4 bleibt Kohortenmodell; Einzelagenten bleiben Visualisierungs-Feature nach M6.
- Kinder haben Bildung 0→1 mit Chance; Einkommen der Kinder folgt elterlicher Bildung (vereinfachte soziale Herkunft).
**Offen:** M4.3 (Arbeitsplätze + Zuweisung über A*), M4.4 (Pendler), M4.5 (Zufriedenheit/Zuzug/Wegzug), M4.6 (Overlay), M4.7 (DoD-Nachweis) — siehe PLAN.md.

## 2026-03-05 – M4.1 Bevölkerungs-Kohorten
**Gebaut:** `Population` als pro-Stadt-Kohortenvektoren (4 Altersgruppen × 3 Bildung × 3 Einkommen = 36 Buckets, float), `cohortIndex`-Mapping (einzigartig, getestet), `workforce()` (Gruppen 1+2), Savegame **v6** (Kohorten als Zahl-Arrays mit Validierung), `syncPopulation()` hält Vektoren an Stadtanzahl synchron.
**Entscheidungen:**
- Kohorten pro Stadt statt global: Pendel (M4.4) arbeitet auf Städtepaaren, Zuweisung braucht Wohnort-Kontext.
- Alterung als Intervall-Ereignis (200 Ticks ≈ 1 "Jahr") statt kontinuierlich: billig, deterministisch, nachvollziehbar.
**Offen:** nichts.

## 2026-03-05 – M3.6 Wachstums-Nachweis + M3-Abschluss
**Gebaut:** Der DoD-Test in einer Welt mit zwei Städten: Stadt A (Strasse + 2 Wohnzonen) wächst in 800 Ticks von selbst (≥ 2 Häuser, Einwohner > 0); Stadt B (Startbestand ohne Anschluss) schrumpft vollständig auf 0. Savegame-Replay über 50 Ticks bleibt identitätsgetreu. 144 Tests grün, Build grün. **M3 ist damit fertig.**
**Entscheidungen:**
- Test sucht Stadt-B-Spot mit absteigenden Distanz-Alternativen (kleine Karten haben nicht immer Land in 28+ Tiles Distanz – gleiche Lehre wie in M1).
**Offen:** Manuelle Browser-Abnahme durch Peter; M4 (Menschen) beginnt.

## 2026-03-05 – M3.5 Gründen-Werkzeug + Stadt-Panel
**Gebaut:** Werkzeug "Gründen" (Klick auf Land -> foundCity mit Auto-Name), Stadt-Panel links: pro Stadt Name, Einwohner (Vollbelegung), Jobs, Gebäudezahl R/C/I und Nachfrage-Prozente; Klick springt mit der Kamera zum Zentrum; Panel aktualisiert 4×/s, verschwindet ohne Städte.
**Entscheidungen:** Panel liest Sim-Zustand direkt (computeStats/computeDemand) statt Snapshot-Structs – Lesen ist nebenläufig gefahrlos, solange nur im UI-Frame zugegriffen wird; Worker-Umzug (M5) führt dann echte Snapshot-Grenzen ein.
**Offen:** nichts.

## 2026-03-05 – M3.4 Gebäude-Entstehung/-Verfall
**Gebaut:** `runGrowthTick` pro Tick: (1) Verfall – Gebäude ohne Strassenanschluss (4er-Nachbarschaft) verlieren 0.03 Substanz/Tick und fallen unter 0.25; das gezonte Tile wird wieder Bauland. (2) Neubau – pro Stadt Nachfrage aus M3.3; auf gezonten, angeschlossenen, freien Tiles Bau mit Chance `constructionChance × Nachfrage`, max. 2/Stadt/Tick, Zufall nur über Welt-RNG. `cityZoneTiles` als pro-Stadt-Bauland-Listen (gepflegt von paintZone/addBuildingAt/removeBuildingAt, beim Laden aus den Layern rekonstruiert). Tests: Wachstum von selbst, kein Bau ohne Anschluss, Verfall + Rückkehr ins Bauland, Nachfragekette R→I, Determinismus, Kapazitätsdeckel.
**Entscheidungen:**
- Bauland-Listen statt 262k-Tile-Scan pro Tick: O(freie Zonen), Tick bleibt im Budget.
- "Lage" = Strassenanschluss (M3-DoD-Lesart); Distanz zum Zentrum/Bodenwert kommt in M8.
- rng.chance wird bei Nachfrage 0 übersprungen (weniger RNG-Verbrauch, gleiche Determinismus-Garantie).
**Offen:** nichts.

## 2026-03-05 – M3.3 Nachfrage-Modell
**Gebaut:** `computeDemand` als reine Funktion: Gebäudebestand (R/C/I mit Substanz > Schwelle) -> Nachfrage 0..1 je Zonentyp. Wohnnachfrage = Grunddruck + Arbeitsplatzüberschuss; C/I-Nachfrage aus Einwohner-Zielquoten. Parameter in `GROWTH` (data/cities.ts). Tests: Leerstadt, Job-Überschuss, Gleichgewicht.
**Entscheidungen:** Vollbelegung (residents = Häuser × 4) in M3; M4 ersetzt sie durch echte Kohorten – der Nachfrage-Code bleibt, die Eingabegrössen werden präziser.
**Offen:** nichts.

## 2026-03-05 – M3.2 Zonen + Gebäude-Datenmodell
**Gebaut:** `zoneType`/`zoneCity`-Layer, Action `paintZone` (Land, kein Strassenbau-Tile, keine bebauten Tiles, max. Distanz zum Stadtzentrum, Zuordnung zur nächsten Stadt), `Buildings` als SoA mit `buildingIndex` (Tile -> Gebäude-ID), World-API `addBuildingAt`/`removeBuildingAt` (inkl. Swap-Removal-ID-Pflege im Index), Zonen-Overlay + Zonen-Werkzeug (Wohnen/Gewerbe/Industrie/Aufheben, dragbar), Stadtmarker im Kartenbild, Savegame **v5** (Zonen base64, zoneCity als 2-Byte-LE, Gebäude-SoA; buildingIndex beim Laden abgeleitet).
**Entscheidungen:**
- zoneCity als Int16Array mit Little-Endian-2-Byte-Serialisierung (1 Byte würde Stadt-IDs > 255 truncaten).
- Gebäude-IDs = Arrayposition+1: Swap-Removal verschiebt IDs – der Tile-Index wird in removeBuildingAt nachgezogen (getestet).
**Offen:** nichts.

## 2026-03-05 – M3.1 Städte-Datenmodell
**Gebaut:** `Cities` als SoA (IDs ab 1, Namen/x/y/founded), Action `foundCity` (Land + Mindestabstand), Savegame **v4** mit Städten. ActionContext erweitert um `cities` und `currentTick` (Aktionen gelten als im abschliessenden Tick passiert – Gründungszeitpunkt ist damit eindeutig). Werkzeuge/Marker-Rendering folgen mit M3.2/M3.5.
**Entscheidungen:**
- SoA mit plain Arrays für Städte statt TypedArrays: Namen erzwingen string[] ohnehin; TypedArrays kommen in M4 für Kohorten (fixe Skalare), dokumentiert als bewusster Pragmatismus – Serialisierbarkeit bleibt garantiert.
- Semantik "Aktionen gelten im abschliessenden Tick": state nach update() IST Tick N; founded = N. Testbestätigung statt stiller Konvention.
**Offen:** nichts.

## 2026-03-05 – M2.5 Unterhaltskosten + M2-Abschluss
**Gebaut:** `upkeepPerTick` (Summe über alle Strassentiles, nur bei Strassenänderungen neu summiert), verbucht zu **Tickbeginn** auf den Bestand – der Bautick selbst ist gratis (Bau zahlt Baukosten, Unterhalt greift ab nächstem Tick). `deserialize` berechnet den Unterhalt beim Laden nach (echter Bug, den der Roundtrip-Test aufdeckte). HUD-Infozeile zeigt Kasse + Unterhalt. 118 Tests grün, Build grün. **M2 ist damit fertig: DoD "Zwei Punkte verbinden, Route und Reisezeit werden angezeigt" erfüllt.**
**Entscheidungen:**
- Unterhalt zu Tickbeginn auf den Bestand: einfache, deterministische Semantik ("Was am Tickbeginn steht, kostet diesen Tick").
- Float-Akkumulation der Kasse (0.01er Beträge) mit toBeCloseTo getestet; bei M7 (Budget/Statistik) wird die Kasse voraussichtlich auf Centbeträge gerundet (BACKLOG).
**Offen:** Manuelle Browser-Abnahme durch Peter (FRAGEN.md); M3 (Siedlung) beginnt.

## 2026-03-05 – M2.4 Werkzeug-UI + Strassen-/Routen-Overlays
**Gebaut:** Werkzeuge (Malen / Strasse / Abriss / Route) unten mittig; Kontextzeile zeigt je nach Werkzeug Tile-Palette oder Strassentypen mit Kosten-Tooltip. Route-Werkzeug zweiphasig (Klick Start, Klick Ziel); Drag baut/reisst kontinuierlich ab. Neue Overlays "Strassen" und "Route" (Oberflächenbasis + Highlight, Start/Ziel farblich); Oberflächen- und Minimap-Darstellung überprägt Strassen. `lastRejected` wird als HUD-Flash angezeigt, Infozeile zeigt Pfadlänge + Reisezeit.
**Entscheidungen:**
- Strassenfarbe überprägt die Oberfläche im Normalmodus – kein Extra-Umschalten nötig, um Bauergebnis zu sehen.
- Route-Werkzeug bewusst zweiphasig statt Drag: Ziehen würde ungewollt Zwischenziele anfragen; bei Bedarf später Drag-Variante.
- HUD-Refaktor lief eine Weile schief (halb angewandter Edit); Konstruktorbereich wurde komplett neu geschrieben – Lehre: bei mehrteiligen Edits in einer Datei lieber ganz neu schreiben.
**Offen:** nichts.

## 2026-03-05 – M2.3 Reisezeit-Modell + Routen-Action
**Gebaut:** Terrain-Faktoren auf offroad-Tempo (`TERRAIN_OFFROAD_FACTOR`, Wald 0.6/Fels 0.7/Wasser 0) in `/src/data/roads.ts`; `PathfindingContext.tiles` erweitert; Actions `requestRoute`/`clearRoute`; World hält eine PathFinder-Instanz (Cache-Wiederverwendung über tileRev) und speichert das Ergebnis als `world.route` (Snapshot mit rev, transient – nicht im Savegame, weil reines Anzeige-Derivat). Tests: Tempo-Formeln, waldfreie Routen bevorzugt, Route setzen/löschen/unmöglich, Reaktion auf neue Strassen, Determinismus inkl. Route (equalWorlds vergleicht sie jetzt).
**Entscheidungen:**
- Route ist Teil des deterministischen Zustands (Action-Ergebnis) aber Savegame-transient: Nach dem Laden existiert sie nicht – sie ist ein Werkzeug-Overlay, kein Weltbestandteil.
- Strassen ignorieren Terrain bewusst: Ausbau gleicht das Terrain aus (einfaches, ehrliches Modell).
**Offen:** nichts.

## 2026-03-05 – M2.2 Grid-Graph + A* mit Cache
**Gebaut:** `PathFinder` mit Binär-Heap (lazy deletion, deterministischer Tie-Break über Node-Index), Octile-Heuristik geteilt durch beste Geschwindigkeit (zulässig -> optimal), Kantenkosten = 1/Tempo des Zielfelds (Strassentyp oder offroad), Wasser unpassierbar. Ergebnis-Cache mit Revisions-Schlüssel (World.tileRev) – Strassenänderungen invalidieren automatisch; Cache-Hits melden `visited: 0`. Bequemer Einzelfall `findPath()` ohne Cache-Wiederverwendung für Tests.
**Entscheidungen:**
- Cache schlüsselt über `rev:start:goal` und räumt komplett auf, wenn 512 Einträge überschritten sind (einfach und gutmütig; echtes LRU erst bei Bedarf).
- Testdaten-Bugs zweimal selbst erwischt (undichte Wasserwand, 'R' statt Ziffer, eingeschlossener Start) – die Mini-Grid-Helfer zwingen zu exakten Karten.
- Erwartungsfehler "0.25 pro offroad-Tile" vs. korrekt "4 Ticks pro offroad-Tile": Tempo ≠ Kosten; der Test dokumentiert jetzt die Formel.
**Offen:** nichts.

## 2026-03-05 – M2.1 Strassen-Datenmodell
**Gebaut:** `roads: Uint8Array` im WorldState, Strassentypen (Pfad/Strasse/Chaussee mit Baukosten, Unterhalt, Tempo, Kapazität) in `/src/data/roads.ts`, Actions `buildRoad`/`demolishRoad`, `treasury` mit Startkapital, `lastRejected` als deterministische Ablehnungs-Info fürs UI, Savegame **v3** (roads + treasury). applyAction bekam dafür einen `ActionContext` (strukturell erfüllt von World statt World-Import → keine zirkuläre Abhängigkeit).
**Entscheidungen:**
- Bau auf Wasser abgelehnt (Brücken kommen später), kein Erstattung beim Abriss, Ausbau auf belegtem Tile kostet voll.
- ActionContext als strukturelle Schnittstelle: actions.ts bleibt import-frei von world.ts; World gibt den Wasser-Layer per Getter top-level frei.
- Lehre: esbuild (vitest) typecheckt nicht – der fehlende `water`-Kontrakt fiel erst im Testlauf auf. `npm run build` (tsc) ist und bleibt Teil jedes Schritts.
**Offen:** nichts.

## 2026-03-05 – M1.8 Reproduzierbarkeit + M1-Abschluss
**Gebaut:** Gesamt-Nachweis auf 512x512: gleicher Seed -> identische Welt über alle Layer, Roundtrip mit Paint, Zeitbudget (Weltgen < 4 s, Savegame-JSON hin+her < 2 s), Vollständigkeit + Wasseranteil. 89 Tests grün, Build grün. **M1 ist damit fertig.**
**Entscheidungen:**
- Zeitbudget-Bounds bewusst grosszügig (4 s/2 s) – Weltgen ist Einmalkosten; das 16-ms-Budget gilt nur für Sim-Ticks.
**Offen:** Manuelle Browser-Durchsicht durch Peter (FRAGEN.md); M2 (Netz) beginnt.

## 2026-03-05 – M1.6 Layer im WorldState + Savegame v2
**Gebaut:** `World` generiert im Konstruktor die komplette Welt (Terrain -> Derived -> Deposits -> Surface-Mapping zu Tile-IDs); alle sechs Layer liegen als Uint8Arrays im Zustand. Savegame **v2**: Layer und Tiles als base64-Strings (eigene DOM-freie Implementierung in `sim/base64.ts`), harte Validierung beim Laden (Längen, Wertebereiche, unbekannte Vorkommens-Bits). Neue Task-ID "Wald" in der Palette-Tabelle. 512er-Savegame < 5 MB.
**Entscheidungen:**
- Savegame v1 wird klar abgelehnt (Versionsfehler) – M0-Saves sind Wegwerf-State, Migration nicht wert.
- Der base64-Umstieg kam früher als geplant (BACKLOG sagte M1 voraus): 6 Layer als JSON-Zahl-Arrays wären ~10 MB gewesen, base64 hält sie bei ~2 MB.
- Konstruktor generiert standardmässig – gleicher Seed, gleiche Welt, strukturell garantiert. Kleine Karten (Weltgrösse < Wellenlänge) können im Ozean liegen; Tests nutzen deshalb die Spielgrösse für Land-Annahmen.
**Offen:** nichts.

## 2026-03-05 – M1.7 Overlays + Minimap
**Gebaut:** Overlay-Definitionen in `/src/data/overlays.ts` (Oberfläche, Höhe, Wasser, Fruchtbarkeit, Wald, Vorkommen), `render/overlay.ts` füllt 1px/Tile-RGBA (Gradient-LUT, Bitmask-Mischung), Renderer-Cache jetzt über ImageData statt 262k fillRects, `render/minimap.ts` (Sichtfeld-Rechteck, Klick/Drag-Sprung), HUD-Overlay-Panel + Taste `o` zum Durchschalten. Karte auf 512x512.
**Entscheidungen:**
- ImageData-Ansatz ersetzt fillRect-Kaskade: Native-Auflösung 1px/Tile, Nearest-Scale auf Cache-Grösse – schneller und ohne Kantenritze.
- Minimap rendert ihr eigenes ImageData (gleicher Code-Pfad via fillTileColors) und invalidate auf tileRev|overlay.
**Offen:** nichts.
**Gebaut:** `generateDeposits`: Bitmaske (Stein/Ton/Kohle/Eisen/Öl), pro Rohstoff eigenes fBm-Feld auf Land-Tiles im Höhenband; Placement per **Perzentil** (oberster `rate`-Anteil der geeigneten Tiles), quantisiert über sortierte Feldwerte. Tests: Reproduzierbarkeit, nur definierte Bits, nur auf Land, Menge pro Rohstoff (0.1–12% des Landes), Klumpigkeit (grösste Komponente ≥ 15%), 512er-Perf.
**Entscheidungen:**
- Absolute fBm-Schwellen verworfen: Nicht kalibrierbar über Seeds (Stein @ seed 1: 0 Treffer), weil Value-Noise sich um 0.5 konzentriert. Perzentil macht die Menge zur Designgrösse; die räumliche Glätte liefert weiterhin regionale Klumpen.
- Fehler entdeckt: erste Höhenbänder lagen (Ton 0.02–0.35) komplett unter der Wasserlinie 0.38. Bänder gelten jetzt innerhalb der Landspanne 0.38–1.0. Öl bleibt Land-basiert (Flachland); Offshore-Öl ist BACKLOG.
**Offen:** nichts.

## 2026-03-05 – M1.4 Fruchtbarkeit + Wald
**Gebaut:** `distanceField` (BFS, Chebyshev, gekappt) und `generateDerived`: Fruchtbarkeit aus regionalem fBm × Höhenstrafe + Fluss-/Küsten-Boosts; Wald aus eigenem Feuchte-fBm + Flussnähe, nur unterhalb der Baumgrenze. Parameter in `/src/data/worldgen.ts`. Tests: Reproduzierbarkeit, Wertebereiche, Wald⊆Land, karge Hochlagen (Perzentil), fruchtbarere Flussnähe, sinnvolle Walddichte.
**Entscheidungen:**
- Heuristik-Test "elevation > 200" ging ins Leere (keine solchen Tiles bei manchen Seeds) → Perzentil-Vergleich (oberes Zehntel vs. unteres Drittel der Landtiles). Lehre: Verteilungs-Tests nie auf absolute Schwellen stützen.
- Fruchtbarkeit/Wald lesen die effektive Höhe (inkl. Fluss-Carving) – Wälder folgen den Tälern, das ist die gewollte Rückkopplung zwischen den Weltgen-Layern.
**Offen:** nichts.

## 2026-03-05 – M1.3 Flüsse
**Gebaut:** `generateRivers`: Quellen = höchste Landtiles mit Mindestabstand (gierig, deterministisch per Höhen-/Index-Tiebreak), Abstieg zum tiefsten 8er-Nachbarn mit Carving (Nachbar wird unter aktuelle Höhe gegraben -> Tälern), Mündung bei Kontakt mit Meer/See/Fluss, `river`-Layer als Teilmenge von `water`. `generateTerrain` liefert jetzt `{elevation, water, river}`. Tests: Reproduzierbarkeit, river⊆water, mindestens eine Meeresmündung pro Seed, Wasseranteil-Bounds, 512er-Perf.
**Entscheidungen:**
- Carving mutiert die Höhen weiter: Die Höhe gilt danach als "effektive Höhe inkl. Flussgräben" – spätere Layer (Fruchtbarkeit, Bodenwert) profitieren von realen Tälern.
- `prev`-Tile wird übersprungen, um Plateau-Bounce (A->B->A auf Höhe 0) zu vermeiden; `maxSteps` bleibt als harter Deckel.
- Quellenwahl ist rein höhenbasiert; der seed-Parameter von generateRivers ist bewusst ungenutzt (Jitter-Varianten später) und dokumentiert.
**Offen:** nichts.

## 2026-03-05 – M1.2 Höhen-Layer + Wasserlinie
**Gebaut:** `generateTerrain(seed, w, h)`: fBm-Grundhöhe + Domain-Warp (zwei eigene fBm-Felder, organische Küsten) + Rand-Falloff, `elevation: Uint8Array` + `water: Uint8Array`. Parameter komplett in `/src/data/worldgen.ts`. Tests: Reproduzierbarkeit, Seed-Sensitivität, Rand-Ozean-Garantie, Wasseranteil, grösste zusammenhängende Landmasse (Flood-Fill), Höhen/Wasser-Konsistenz, 512x512-Performance < 1 s.
**Entscheidungen:**
- Rand-Falloff korrigiert: erst falsch ab Kartenmitte angewandt (86% Ozean); jetzt normierte Randdistanz mit Rampenbeginn bei `edgeFalloffStart` und 0 exakt an der Kante. Der Kartenrand ist immer Ozean – wichtig für M2/M6 (jede Binnenlage später über Wasser/Netz erreichbar).
- Test "Zentrum ist Land" durch "grösste zusammenhängende Landmasse ≥ 12% der Karte" ersetzt – das ist die echte Spielanforderung (mehrere Städte auf einer Landmasse), keine Ästhetik-Annahme.
- 512x512 liegt im Perf-Test klar unter 1 s (Weltgen ist Einmalkosten, Budget 16 ms gilt nur für Ticks).
**Offen:** nichts.

## 2026-03-05 – M1.1 Noise-Basis
**Gebaut:** `/src/worldgen/noise.ts`: `hash2` (32-Bit-Integer-Hash, Seed-abhängig), `valueNoise2` (quintisch interpoliert), `fbm2` (fBm mit gain/lacunarity, normalisiert, Offsets zur Feldtrennung). Tests: Determinismus, Wertebereich, Glattheit, Pin-Werte, exakte Oktaven-Identitäten.
**Entscheidungen:**
- Hash-basiert statt sequentiell: Jede Stelle liefert unabhängig von der Abfrage-Reihenfolge denselben Wert – wichtig, weil Weltgen-Schritte (Höhe, Flüsse, Vorkommen) später punktuell nachsample werden.
- Statistik-Test "mehr Oktaven -> mehr Varianz" verworfen (fragil entlang eines Sample-Pfads); stattdessen exakte Kompositions-Identitäten für octaves=1/2. Lehre: Eigenschaften testen, keine Heuristiken.
**Offen:** nichts.

## 2026-03-05 – M0.7 Determinismus-Test + M0-Abschluss
**Gebaut:** Der DoD-Test: gleicher Seed + gleiche (deterministisch erzeugte) Aktionsliste -> identischer Weltzustand nach 1000 Ticks, einmal direkt getaktet, einmal über SimLoop mit manueller Uhr; zusätzlich Savegame-Roundtrip im deterministischen Lauf und Negativprobe (abweichende Liste -> anderer Zustand). 41 Tests grün, Build grün. **M0 ist damit fertig.**
**Entscheidungen:**
- Die Aktionsliste wird per Formel erzeugt, nicht mit Math.random – die Nicht-Zufälligkeit gilt in Tests genauso wie in /src/sim.
- Negativprobe zuerst mit verschobenen Ticks gebaut: Diese ist wirkungsidentisch (Paints hängen nicht vom Tick ab) und beweist nichts; der Test vergleicht jetzt unterschiedliche Tile-Werte.
- Bedienprobe im echten Browser bleibt als Aufgabe für Peter offen (FRAGEN.md); automatisiert abgedeckt sind Sim, Loop, Kamera-Mathe und Build/Preview.
**Offen:** Manuelle Browser-Durchsicht durch Peter; M1-Zerlegung folgt sofort.

## 2026-03-05 – M0.6 HUD + Persistenz
**Gebaut:** `/src/persist` (IndexedDB-Hülle + Save/Load/Export/Import), `Hud` (Statuszeile, Speed-Buttons, Tile-Palette, Savegame-Buttons), `input.ts` (Canvas-Eingabe, gibt Frame-Poll für Tastatur-Pan zurück), `main.ts` neu gegliedert, `SimLoop.setWorld` fürs Nachladen.
**Entscheidungen:**
- Import/Export nutzen dasselbe JSON-Format wie der Browser-Slot – ein Format, ein Validierungspfad.
- HUD enthält keinerlei Logik: Callbacks nach unten, Aktivmarkierungen von aussen gesetzt (Speed-Änderungen können auch per Tastatur kommen).
- Kein Framework, reines DOM – panelweise gebaute Elemente, < 200 Zeilen pro Modul.
**Offen:** nichts.
**Gebaut:** `Camera` (DOM-frei, getestet: Roundtrip, ortsfestes Cursor-Zoom, Clamping), `Renderer` mit Offscreen-Tile-Ebene: Cache wird nur bei `tileRev`-/Auflösungswechsel neu gezeichnet, pro Frame nur Blit + Gitter-/Rand-Overlay. `main.ts` nutzt jetzt Loop + Kamera: Linksklick/Ziehen malt, Rechtsklick/Mitte schwenkt, Rad zoomt, WASD/Pfeile pan, +/- zoomt, Leertaste Pause, 1/2/3 Speed.
**Entscheidungen:**
- Cache-Auflösung auf max. 16 Gerätepixel/Tile gekappt: Bei zoom 48 und dpr 2 wäre die Vollauflösung ~600 MB gross; flächige Tiles vertragen Nearest-Neighbor-Upscaling. Bei 512x512-Karten (M1) kommt Chunk-Caching (BACKLOG).
- Gitterlinien bewusst NICHT in den Cache (wären nach Upscaling matschig), sondern als billiger Overlay-Stroke pro Frame.
- `SimLoop.stepOnce()`: Editor-Actions (Malen) sollen auch bei Pause sichtbar werden, ohne die Sim-Uhr weiterlaufen zu lassen.
- TS-Lehre (nachgetragen aus M0.3/M0.4): Exhaustiveness-Guards per `never`-Zuweisung greifen erst ab dem zweiten Union-Member.
**Offen:** nichts.

## 2026-03-05 – Projektstart, M0.1
**Gebaut:** Repo angelegt (README, PLAN, JOURNAL, BACKLOG, FRAGEN, DECISIONS), Vite+TS+Vitest-Gerüst, Ordnerstruktur nach Architekturvorgabe.
**Entscheidungen:**
- Testumgebung `node` (kein jsdom nötig, da Sim DOM-frei ist und bleibt).
- `noUncheckedIndexedAccess` an: erzwingt sauberen Umgang mit TypedArray-Indizes in der Sim.
- `/src/persist` als zusätzliche Ebene neben der vorgegebenen Struktur: Savegame-IO (IndexedDB, Datei) ist weder Sim noch UI; wird in JOURNAL/DECISIONS dokumentiert statt sim mit Browser-APIs zu verschmutzen.
**Offen:** Rest von M0.

## 2026-03-05 – M0.2 Seeded RNG
**Gebaut:** `mulberry32` als Klasse mit exportierbarem Zustand (`Rng.state`, `Rng.fromState`), damit Savegames den RNG-Stand mitschreiben und die Sequenz nach Laden exakt weiterläuft. Pin-Test friert konkrete Sequenzwerte ein, damit der Algorithmus nie unbemerkt ändert.
**Entscheidungen:** Eine einzige RNG-Instanz pro Welt (kein Stream-System) – erst wenn mehrere Subsysteme unabhängig weiterticken (M3+), wird auf benannte Streams umgestellt (BACKLOG).
**Offen:** nichts.

## 2026-03-05 – M0.3 Weltzustand, Actions, Savegame
**Gebaut:** `World` als Struct-of-Arrays (`tiles: Uint8Array`), FIFO-Action-Warteschlange (Actions greifen zu Beginn des nächsten Sim-Ticks – Determinismus-Grenze, siehe DECISIONS D003), JSON-Serialisierung mit Versionsfeld und harten Validierungen beim Laden, `tileRev` als Cache-Invalidierungszähler. Minimales lauffähiges UI-Shell (index.html + main.ts): Boot mit URL-Seed, statisches Grid-Rendering, Klick-Paint über die Action-Pipeline – damit ist der Build ab sofort lauffähig.
**Entscheidungen:**
- TypedArrays werden im Savegame als normale Zahl-Arrays serialisiert (JSON, menschenlesbar). Bei 512x512 sind das ~2 MB; binäres/base64-Format steht im BACKLOG.
- `tileRev` ist Renderer-Bookkeeping: wird nicht serialisiert und nicht in `equalWorlds` verglichen (erwies sich im Roundtrip-Test als Designfrage).
- TS-Lehre: Exhaustiveness-Checks (`const x: never = action`) nach `switch` funktionieren erst ab dem zweiten Union-Member; bei Ein-Member-Unionen subtrahiert TS nicht bis `never`. Bis dahin fängt ein Runtime-Throw in `default` unbekannte Kinds ab.
**Offen:** nichts.

## 2026-03-05 – M0.4 Fixed-Tick-Loop
**Gebaut:** `SimLoop` mit Akkumulator, injizierbarer Uhr (Browser: `performance.now`, Tests: manuelle Uhr), Geschwindigkeitsstufen 0/1/3/10, Catch-up-Deckel gegen Todesspirale, Tick-Zähler-Rückgabe pro `update()` fürs Rendering.
**Entscheidungen:**
- Basis-Tickrate 20/s (in `/src/data`), max. 400 Ticks pro Frame; nach langer Pause wird die verstrichene Zeit gekappt und der Rest verworfen, statt sie nachzuholen.
- First-Frame-Guard: der erste `update()`-Aufruf setzt nur die Zeitbasis, die Zeitspanne zwischen Loop-Konstruktion und erstem Aufruf wird verworfen (schutz vor Phantom-Bursts; in Tests via Warm-up-Call berücksichtigt).
**Offen:** nichts.
