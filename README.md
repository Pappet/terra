# TERRA

Browserbasierte Städtebau- und Wirtschaftssimulation. Leitsatz: **Simulationstiefe vor Grafik.**

Eine grosse, prozedural erzeugte Karte (512×512) mit Terrain, Flüssen, Fruchtbarkeit und
Rohstoffen. Der Spieler gründet mehrere Städte, zont Wohnen/Gewerbe/Industrie und baut
Strassen. Die Simulation erweckt das zum Leben:

- **Wachstum:** Gebäude entstehen nach Nachfrage, Strassenanschluss und Umgebung (D006).
- **Menschen:** Bevölkerung als Kohorten (Alter/Bildung/Einkommen), Geburten, Sterbefälle,
  Zufriedenheit, Zuzug/Wegzug, Pendler über Stadtgrenzen hinweg (A* mit Korridorkapazität).
- **Wirtschaft:** Produktionsketten (Holz→Bretter→Werkzeug, Nahrung), lokale Preise aus
  Angebot/Nachfrage, Handel zwischen Städten per Arbitrage mit Korridorkapazität.
- **Verwaltung:** Steuersatz, Budget, Kredite mit Zins, Bankrott, Zeitreihen-Statistiken,
  vollständiges Speichern/Laden inklusive UI-Zustand.
- **Tiefe (M8):** Bodenwert, Bildung über Schulen, Verschmutzung (drückt Fruchtbarkeit und
  Zufriedenheit), Versorgungsnetze entlang des Straßengraphs, Ereignisse (Brand, Missernte).
  Jedes Subsystem koppelt mindestens getestet in ein anderes (m8.proof.test.ts).

## Stack

- TypeScript + Vite, UI als normales DOM (kein Framework)
- Canvas2D, Tile-basiert, Kamera mit Pan/Zoom, Layer-Caching
- Eigener Fixed-Tick-Loop, von Rendering entkoppelt, deterministisch, seeded RNG (mulberry32)
- Savegames in IndexedDB plus Export/Import als Datei (JSON, Layer base64)
- Tests mit Vitest (260+, DOM-frei), Golden-Master-Regression gegen referenz-Hash
- Kein Backend, kein Multiplayer, kein 3D, keine Assets von Dritten

## Starten

```bash
npm install
npm run dev      # Entwicklung
npm test         # Vitest (stummer Testlauf; der Perf-Gate-Test loggt bewusst Messwerte)
npm run build    # Typcheck + Production-Build
```

Der Seed lässt sich per URL-Parameter setzen: `?seed=12345`.

## Bedienung

Die Oberfläche ist ein App-Frame (M10.0): Topbar mit Kennzahlen und Geschwindigkeit,
Werkzeugleiste links, Optionen des aktiven Werkzeugs daneben, Karte in der Mitte,
Dock rechts (Minimap + Inspektor), Statusleiste unten mit Overlay-Wahl.

| Eingabe | Wirkung |
| --- | --- |
| `1`…`7` | Werkzeug (Auswahl, Gründen, Zonen, Strasse, Abriss, Route, Malen) |
| Linke Maustaste | Werkzeug anwenden, ziehen malt eine Linie |
| Rechte/mittlere Maustaste | Karte schwenken |
| Mausrad, `+` / `-` | Zoom |
| `W A S D` / Pfeiltasten | Karte schwenken |
| Leertaste | Pause an/aus |
| `[` / `]` | Geschwindigkeit langsamer/schneller (Pause, 1x, 3x, 10x) |
| `O` | nächstes Overlay |
| `ESC` | Auswahl aufheben (Inspektor zurück auf Region) |

Der Inspektor im Dock folgt der Auswahl: ohne Auswahl Region (Übersicht, Budget,
Statistik), nach Klick auf eine Stadt deren Tabs (Übersicht, Wirtschaft, Bevölkerung),
sonst das einzelne Tile (inklusive Verschmutzung und Versorgungsnetz).

## Architektur

Die detaillierte Tick-Reihenfolge, Leser/Schreiber-Beziehungen und die Regeln zu
Determinismus, Savegame-Versionierung und der sim/render/ui-Grenze stehen in
[ARCHITECTURE.md](ARCHITECTURE.md). Kurz:

```
/src/sim        reine Simulation: deterministisch, kein DOM, kein Rendering
/src/render     Zeichnen, liest nur Snapshots aus der Sim
/src/ui         Panels, Tools, Eingabe
/src/data       alle Balance-Werte als Tabellen (keine Balance-Zahl im Code)
/src/worldgen   Kartengenerierung (Terrain, Flüsse, Fruchtbarkeit, Vorkommen)
/src/persist    Savegame: IndexedDB + Datei-Export/Import
```

Weltzustand als Struct-of-Arrays / TypedArrays, Referenzen über numerische IDs. Die Sim
ist DOM-frei und damit Worker-fähig geschrieben; die Messung im Perf-Gate (M9.2:
1.011 ms/Tick avg bei 6326 Gebäuden / 20434 Einwohnern, Budget 16 ms) hat den Umzug in
einen Web Worker bewusst **nicht** nötig gemacht.

## Stand

M0–M9 abgeschlossen (Gerüst, Welt, Netz, Siedlung, Menschen, Wirtschaft, Handel,
Verwaltung, Tiefe, Konsolidierung), dazu M10.0 (UI-Shell, siehe
[specs/M10-UI-SHELL.md](specs/M10-UI-SHELL.md)). Details und Task-Listen: [PLAN.md](PLAN.md).
Entscheidungen: [DECISIONS.md](DECISIONS.md). Entwicklungslog: [JOURNAL.md](JOURNAL.md).
Offene Ideen: [BACKLOG.md](BACKLOG.md).
