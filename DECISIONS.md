# DECISIONS

Architektur- und Design-Entscheidungen mit Begründung. Neueste oben.

## D001 – Vitest ohne DOM-Environment, strict Index-Checks (M0)
Testumgebung `node` statt jsdom: Die Sim ist DOM-frei (Architekturvorgabe), Rendering/UI
wird nicht Unit-getestet, sondern durch Build+Laufprobe verifiziert. `noUncheckedIndexedAccess`
ist an, weil Sim-Code massenhaft TypedArray-Indizes nutzt und falsch behandelte `undefined`
genau dort deterministische Bugs erzeugt.

## D002 – Savegame: JSON mit Zahl-Arrays für TypedArrays (M0)
TypedArrays werden pro Feld in normale Arrays serialisiert, Savegame bleibt menschenlesbar.
Bei 512x512 Karten (~262k Tiles) wird das mehrere MB gross; dann Umstieg auf base64/binäres
Format (BACKLOG). Grund für den Aufschub: YAGNI, Roundtrip-Korrektheit ist formatunabhängig
getestet, der Wechsel kostet eine Funktion.

## D003 – Action-Warteschlange als Determinismus-Grenze (M0)
Änderungen am Weltzustand laufen ausschliesslich über eine FIFO-Action-Warteschlange, die
`World.update()` zu Beginn des Ticks abarbeitet – nie direkt aus UI/Renderer. Damit ist
"gleicher Seed + gleiche Aktionsliste = identischer Zustand" strukturell garantiert, nicht
nur zufällig erfüllt. Out-of-Bounds-Actions werden still ignoriert (UI-Komfort), ungültige
Daten werfen (Programmfehler).

## D004 – SimLoop mit injizierbarer Uhr (M0)
Die Loop-Klasse bekommt Zeit über eine Funktion, nicht global. Browser injiziert
`performance.now`, Tests eine manuelle Uhr. Hält `/src/sim` DOM-frei und testbar.

## D005 – /src/persist als sechste Ebene (M0)
Die Architekturvorgabe nennt sim/render/ui/data/worldgen. Savegame-IO (IndexedDB, Datei-Export)
gehört in keine davon, ohne die Sim mit Browser-APIs zu kontaminieren. Lösung: eigene kleine
Ebene `/src/persist`, dokumentiert hier statt still abzuweichen.
