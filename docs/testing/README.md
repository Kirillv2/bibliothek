# Test-Grundlagen Woche 1 (F-01 … F-07)

- Geschrieben von: Testing-Agent, Modus „Tests schreiben“ (vor Gate 2)
- Bezug: [ADR 002](../adr/002-persistenz-datenbank.md) (PGlite), [ADR 004](../adr/004-schichten-und-ordnerstruktur.md) (Schichten, Uhr), [ADR 006](../adr/006-konfigurationswerte.md) (Konfigurationswerte), [ADR 008](../adr/008-datum-und-zeitzone.md) (Datum), [Schnittstellen](../architektur/schnittstellen.md)
- Testpläne je Feature: [F-01](F-01.md) · [F-02](F-02.md) · [F-03](F-03.md) · [F-04](F-04.md) · [F-05](F-05.md) · [F-06](F-06.md) · [F-07](F-07.md)

Diese Seite beschreibt, was alle Tests der Woche 1 gemeinsam benutzen, und welchen **Vertrag** Development dafür erfüllen muss. Der Vertrag ergänzt [schnittstellen.md](../architektur/schnittstellen.md) nur dort, wo Tests eine konkrete Form brauchen (Modulpfad, Parameter). Fachliche Regeln kommen ausschließlich aus den Specs.

## Wo die Tests liegen

| Art | Ort | Befehl |
|---|---|---|
| Unit (reine Fachlogik `src/lib/`) | `src/lib/*.test.ts` | `npm test` |
| Integration (Anwendungsschicht + PGlite) | `tests/integration/F-xx_Enn-USnn.test.ts` | `npm run test:int` |
| Rechte (je Rolle) | `tests/security/F-xx_Enn-USnn.test.ts` | `npm run test:security` |
| E2E (nur Abläufe ohne Testdaten) | `e2e/F-xx_Enn-USnn.spec.ts` | `npm run test:e2e` |
| Gemeinsame Hilfen | `tests/helpers/` | – |

Jeder `describe`-Block trägt die FR-ID, jeder Test die Nummer des Akzeptanzkriteriums (z. B. `AK-03.2`). Querverweise auf andere Features stehen im Namen (z. B. „Querverweis F-01“). `npm run fr-abdeckung` zeigt, welche FR einen Test hat.

## Gemeinsame Hilfen (`tests/helpers/`)

| Datei | Inhalt |
|---|---|
| `testdb.ts` | `nutzeTestDatenbank()`: eine PGlite-Instanz je Testdatei, vor jedem Test werden alle Tabellen in `public` geleert. `kontext(sitzung, uhr?)` baut den Kontext für die Anwendungsschicht. `momentaufnahme(pg)` für „ohne Wirkung in der DB“. |
| `uhr.ts` | `festeUhr("JJJJ-MM-TT")`, `plusTage`, `tageZwischen` (eigene Rechnung der Tests, unabhängig vom App-Code) |
| `konfiguration.ts` | Standard und Grenzen aus `config/system.defaults.json`, `andererGueltigerWert`, `gebuehrCents` |
| `daten.ts` | Testdaten direkt per SQL: Nutzer, Titel, Exemplare, Ausleihvorgänge, Mahnungen, Vormerkungen, Systemparameter |
| `ergebnis.ts` | `erwarteOk`, `erwarteFehler` für `Ergebnis<T>` |
| `personendaten.ts` | `erwarteKeinePersonendaten` für öffentliche Antworten |

### Feste Uhr

Alles Zeitabhängige läuft mit `festeUhr`. Standard-Stichtag ist `2026-11-10` (Winterzeit, keine Zeitumstellung in der Nähe). Tests, die Fristen prüfen, setzen ihren Stichtag selbst.

### Konfigurationswerte

Tests schreiben keine eigenen Zahlen für Leihfrist, Limit, Verlängerungen, Tagessatz oder Abholfrist. Sie lesen `standard`, `min` und `max` aus `config/system.defaults.json`, setzen den Wert über die Tabelle `system_settings` (wie später der Administrator) und rechnen die Erwartung daraus (ADR 006, Punkt 4). Ändert die Konfigurationsrolle einen Standardwert, bleiben die Tests gültig. Ausnahmen sind Zahlen, die in einem Akzeptanzkriterium selbst stehen (z. B. `maxVerlaengerungen = 0` in F-06 AK-02.3, 20 Treffer je Seite in F-01 AK-02.8).

## Vertrag mit Development

### 1. Datenbank

- `@/server/db` exportiert `erstelleDatenbank(client: PGlite): Promise<Datenbank>`. Die Funktion wendet **alle Migrationen** auf die übergebene PGlite-Instanz an und gibt die Datenbank zurück, mit der die Anwendungsschicht arbeitet (z. B. Drizzle).
- Tabellen und Spalten heißen wie in [datenmodell.md](../architektur/datenmodell.md), Spalten in snake_case (ADR 001): `users`, `sessions`, `titles`, `copies`, `loans`, `dunnings`, `reservations`, `notifications`, `system_settings`, `job_runs`. Die Tests legen Daten per SQL mit diesen Namen an (siehe `tests/helpers/daten.ts`).
- Werte von Aufzählungen sind Text in Großbuchstaben (`GUT`, `WARTEND`, `MITGLIED` …). `system_settings.key` ist eindeutig.

### 2. Kontext statt globaler Zustände

Jede Funktion der Anwendungsschicht bekommt als **ersten Parameter** einen Kontext:

```ts
type Kontext = {
  db: Datenbank;                 // aus erstelleDatenbank
  uhr: { heute(): string;        // "JJJJ-MM-TT" in Europe/Berlin (ADR 008)
         jetzt(): Date };        // Zeitpunkt, z. B. für returnedAt
  sitzung: { userId: string; role: "MITGLIED" | "BIBLIOTHEKAR" | "ADMINISTRATOR" } | null; // null = Gast
};
```

Die Server Actions in `src/app/` bauen den Kontext aus `getSession()` (ADR 003), der echten Uhr und der Datenbank und rufen dann diese Funktionen. Rolle und Mitglieds-ID kommen nur aus `sitzung`, nie aus der Eingabe.

`uhr.jetzt()` ergänzt die in ADR 004 genannte Methode `heute()`, weil F-07 das Rückgabedatum als Zeitpunkt speichert und Tests dafür eine feste Uhr brauchen.

### 3. Funktionen und Module

Alle Funktionen liefern `Ergebnis<T> = { ok: true; daten: T } | { ok: false; fehler: Fehlercode; felder?: Record<string, string> }` (schnittstellen.md). Feldnamen in `felder` sind die Namen der Eingabefelder (z. B. `title`, `isbn`).

| Modul | Funktion | Feature |
|---|---|---|
| `@/server/katalog/suche` | `sucheKatalog(k, anfrage)`, `ladeKategorien(k)` → `string[]` | F-01 |
| `@/server/katalog/detail` | `ladeTitelDetail(k, titleId)` | F-02 |
| `@/server/titel` | `titelAnlegen(k, eingabe)`, `titelBearbeiten(k, eingabe)`, `titelArchivieren(k, { titleId })`, `ladeVerwaltungsliste(k)` → `{ titleId, title, archiviert }[]` | F-03 |
| `@/server/exemplare` | `exemplarAnlegen(k, { titleId, condition? })`, `exemplarZustandAendern(k, { copyId, condition })` | F-04 |
| `@/server/ausleihe` | `ausleihen(k, { titleId })` | F-05 |
| `@/server/verlaengerung` | `ladeMeineAusleihen(k)`, `verlaengern(k, { loanId })` | F-06 |
| `@/server/rueckgabe` | `rueckgabeErfassen(k, { inventoryNumber })` | F-07 |

Eingaben und Ergebnisse wie in schnittstellen.md. Zwei Lese-Funktionen sind dort nicht genannt und kommen aus Akzeptanzkriterien: `ladeKategorien` (F-01 AK-02.7, Kategorien für den Filter) und `ladeVerwaltungsliste` (F-03 AK-03.7, Bibliothekar sieht archivierte Titel in der Verwaltung). Datumswerte in Ergebnissen sind Text `"JJJJ-MM-TT"`.

Reine Fachfunktionen in `src/lib/` (ADR 004), getestet mit Unit-Tests:

| Modul | Funktion | Feature |
|---|---|---|
| `@/lib/datum` | `formatiereDatum("JJJJ-MM-TT")` → `"TT.MM.JJJJ"` | F-02 |
| `@/lib/exemplarstatus` | `leiteExemplarstatusAb({ condition, offeneAusleihe, abholbereitZugeordnet })` | F-02, F-04 |
| `@/lib/isbn` | `istGueltigeIsbnForm(text)` | F-03 |
| `@/lib/inventarnummer` | `formatiereInventarnummer(zahl)` | F-04 |
| `@/lib/faelligkeit` | `berechneFaelligkeit(startDate, leihfristTage)` | F-05 |
| `@/lib/verlaengerung` | `berechneNeueFaelligkeit({ alteFaelligkeit, verlaengerungstag, leihfristTage })` | F-06 |
| `@/lib/mahngebuehr` | `berechneMahngebuehrCents({ dueDate, stichtag, tagessatzEuro })` | F-07 |

### 4. Seiten für E2E

Die E2E-Tests prüfen nur Abläufe, die ohne Testdaten auskommen (Gast): Katalogseite `/`, Detailseite `/titel/[titleId]` (404), Weiterleitung von `/konto/ausleihen`, `/verwaltung/titel/neu` und `/verwaltung/rueckgabe` nach `/anmelden`. Pfade wie in schnittstellen.md, Abschnitt „Seiten“.

## Grenzen der Tests (bewusst)

- **PGlite hat nur eine Verbindung.** Parallele Anfragen (NFR06, F-04 AK-01.3) laufen im Test nacheinander. Die Tests prüfen das Ergebnis (genau ein Ausleihvorgang, eindeutige Nummern) und zusätzlich den eindeutigen Index direkt. Echte Gleichzeitigkeit gegen einen PostgreSQL-Server prüft Review & Security beim Deploy.
- **Anzeige-Details** (z. B. Hinweistexte, deaktivierte Schaltflächen) prüfen die Tests über die Daten, die die Seite bekommt. Was nur die Oberfläche betrifft, steht im Testplan des Features als „manuell an Gate 3“.
- **Querverweise:** Einige Tests rufen Funktionen anderer Features auf (z. B. F-03 prüft den Katalog aus F-01). Sie werden erst grün, wenn beide Features umgesetzt sind. Der Testplan nennt sie.
