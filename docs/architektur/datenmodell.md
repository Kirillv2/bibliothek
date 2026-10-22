# Datenmodell (alle Epics E01–E07)

- Status: Entschieden (Agenten im Auftrag von KiKo, Entscheidungen in [ADR 009](../adr/009-entscheidungen-zu-luecken-der-spezifikation.md)); Freigabe an Gate 1
- Bezug: Spezifikation 1.4 (Glossar), E01–E07, NFR03, NFR04, NFR06
- Code-Namen: [ADR 001](../adr/001-fachbegriffe-code-namen.md) · Datenbank: [ADR 002](../adr/002-persistenz-datenbank.md) · Status-Ableitung: [ADR 005](../adr/005-exemplarstatus-und-datenintegritaet.md) · Datum: [ADR 008](../adr/008-datum-und-zeitzone.md)

Das Modell deckt alle Epics ab, damit Woche 2 und 3 keine Umbauten brauchen. In Woche 1 (F-01 … F-07) werden nur die markierten Teile benutzt; die übrigen Tabellen dürfen trotzdem schon angelegt werden.

## Überblick

```mermaid
erDiagram
    USER ||--o{ SESSION : "hat"
    USER ||--o{ LOAN : "leiht (als Mitglied)"
    USER ||--o{ RESERVATION : "merkt vor"
    USER ||--o{ NOTIFICATION : "erhält"
    TITLE ||--o{ COPY : "hat Exemplare"
    TITLE ||--o{ RESERVATION : "Warteschlange"
    COPY ||--o{ LOAN : "wird ausgeliehen"
    COPY |o--o{ RESERVATION : "zugeordnet (abholbereit)"
    LOAN ||--o| DUNNING : "Mahnung"
    LOAN ||--o{ NOTIFICATION : "Erinnerung / Mahnung"
```

## Entitäten

Legende Spalte „Woche“: in welcher Woche die Entität zum ersten Mal fachlich gebraucht wird.

### `User` – Nutzer (Woche 1, Seed; Registrierung Woche 3)

| Feld | Typ | Pflicht | Regel / Quelle |
|---|---|---|---|
| `id` | UUID | ja | |
| `email` | Text | ja | eindeutig, klein geschrieben gespeichert (E06-US01-FR01) |
| `passwordHash` | Text | ja | nur Hash, nie Klartext (E06-US01-FR01, NFR03; Verfahren ADR 003) |
| `role` | `MITGLIED` \| `BIBLIOTHEKAR` \| `ADMINISTRATOR` | ja | E06-US02-FR01; genau eine Rolle je Konto (OF-D7) |
| `createdAt` | Zeitstempel | ja | |

Der **Gast** hat keinen Datensatz. Das **System** ist kein Nutzer, sondern ein Job mit Secret (ADR 007).

### `Session` – Anmeldesitzung (Woche 1)

| Feld | Typ | Pflicht | Regel |
|---|---|---|---|
| `id` | UUID | ja | |
| `userId` | → User | ja | |
| `tokenHash` | Text | ja | eindeutig; SHA-256 des Cookie-Tokens (ADR 003) |
| `expiresAt` | Zeitstempel | ja | Dauer: technische Konfiguration |
| `createdAt` | Zeitstempel | ja | |

### `Title` – Titel (Woche 1)

| Feld | Typ | Pflicht | Regel / Quelle |
|---|---|---|---|
| `id` | UUID | ja | |
| `title` | Text | ja | E02-US01-FR01 |
| `author` | Text | ja | E02-US01-FR01 |
| `category` | Text | ja | E02-US01-FR01; Freitext (OF-D5) |
| `isbn` | Text | nein | E02-US01-FR01 |
| `description` | Text | nein | E02-US01-FR01 |
| `publicationYear` | Ganzzahl | nein | optional; nötig für Filter/Sortierung in E01-US01-FR02, in E02-US01-FR01 nicht genannt (OF-D1) |
| `archivedAt` | Zeitstempel | nein | gesetzt = archiviert/deaktiviert (E02-US01-FR03); Folgen siehe OF-D4 |
| `createdAt`, `updatedAt` | Zeitstempel | ja | |

### `Copy` – Exemplar (Woche 1)

| Feld | Typ | Pflicht | Regel / Quelle |
|---|---|---|---|
| `id` | UUID | ja | |
| `titleId` | → Title | ja | |
| `inventoryNumber` | Text | ja | eindeutig, vom System beim Anlegen fortlaufend vergeben, Format `INV-000042` (E02-US02-FR01, OF-D6) |
| `condition` | `GUT` \| `BESCHAEDIGT` \| `VERLOREN` | ja | E02-US02-FR02 (OF-D3); Standard beim Anlegen `GUT`; nur `VERLOREN` ist nicht ausleihbar (OF-D2) |
| `createdAt` | Zeitstempel | ja | |

Der **Status** (verfügbar / ausgeliehen / vorgemerkt / gesperrt) wird **nicht gespeichert**, sondern abgeleitet (ADR 005).

### `Loan` – Ausleihvorgang (Woche 1)

| Feld | Typ | Pflicht | Regel / Quelle |
|---|---|---|---|
| `id` | UUID | ja | |
| `copyId` | → Copy | ja | |
| `memberId` | → User | ja | |
| `startDate` | Datum | ja | E03-US01-FR01 |
| `dueDate` | Datum | ja | berechnet mit `leihfristTage` (E03-US01-FR01, FR02) |
| `renewalCount` | Ganzzahl ≥ 0 | ja | Start 0, höchstens `maxVerlaengerungen` (E03-US02-FR02) |
| `returnedAt` | Zeitstempel | nein | gesetzt = abgeschlossen (E03-US03-FR01) |
| `overdueSince` | Datum | nein | gesetzt vom System-Job (E04-US01-FR03, Woche 2) |
| `createdAt` | Zeitstempel | ja | |

Constraint **NFR06:** `UNIQUE (copyId) WHERE returnedAt IS NULL` (ADR 002).
„Offen“ heißt: `returnedAt IS NULL`.

### `Dunning` – Mahnung (Woche 2; in Woche 1 gelesen von F-05, geschrieben von F-07)

| Feld | Typ | Pflicht | Regel / Quelle |
|---|---|---|---|
| `id` | UUID | ja | |
| `loanId` | → Loan | ja | eindeutig: eine Mahnung je Ausleihvorgang (E04-US02-FR01, NFR04) |
| `createdOn` | Datum | ja | Datum der Mahnung (E04-US02-FR01) |
| `feeCents` | Ganzzahl | nein | Mahngebühr; endgültig festgehalten bei Rückgabe (E03-US03-FR02, E04-US02-FR02) |
| `settledAt` | Zeitstempel | nein | gesetzt = beglichen (E04-US02-FR03) |
| `settledById` | → User | nein | Bibliothekar, der beglichen markiert |

„Offene Mahnung“ heißt: `settledAt IS NULL`. Das betroffene Exemplar ergibt sich über `loanId`.
Verlängerung und Mahnung: Eine Verlängerung am oder vor der Fälligkeit verhindert die Mahnung; eine Verlängerung danach lässt sie offen (E03-US02-FR03, OF-F06-3/-4).

### `Reservation` – Vormerkung (Woche 2; in Woche 1 gelesen von F-02, F-03, F-06, F-07)

| Feld | Typ | Pflicht | Regel / Quelle |
|---|---|---|---|
| `id` | UUID | ja | |
| `titleId` | → Title | ja | Warteschlange je Titel (E05-US01-FR02) |
| `memberId` | → User | ja | |
| `createdAt` | Zeitstempel | ja | Reihenfolge der Warteschlange (E05-US01-FR02) |
| `status` | `WARTEND` \| `ABHOLBEREIT` \| `ABGEHOLT` \| `ABGELAUFEN` | ja | E05-US01-FR03 |
| `copyId` | → Copy | nein | gesetzt, sobald ein zurückgegebenes Exemplar zugeordnet ist (E03-US03-FR03) |
| `pickupDeadline` | Datum | nein | Ende der Abholfrist, `abholfristVormerkungTage` (E05-US01-FR03) |

„Aktive Vormerkung“ heißt: Status `WARTEND` oder `ABHOLBEREIT`. Ob eine Person ihre Vormerkung selbst zurückziehen kann (Status `STORNIERT`), sagt die Spezifikation nicht; das klärt die Spec F-10.

### `Notification` – Benachrichtigung (Woche 2)

| Feld | Typ | Pflicht | Regel / Quelle |
|---|---|---|---|
| `id` | UUID | ja | |
| `userId` | → User | ja | Empfänger |
| `type` | `ERINNERUNG` \| `MAHNUNG` \| `ABHOLBEREIT` | ja | E04-US01-FR02, E04-US02, E05-US01-FR03 |
| `loanId` | → Loan | nein | bei Erinnerung/Mahnung |
| `reservationId` | → Reservation | nein | bei Abholung |
| `dueDate` | Datum | nein | Fälligkeit, auf die sich eine Erinnerung bezieht (Idempotenz, ADR 007) |
| `createdAt` | Zeitstempel | ja | |
| `readAt` | Zeitstempel | nein | |

Kanal: nur Anzeige in der App, kein E-Mail-Versand (OF-D8).

### `SystemSetting` – Systemparameter (Woche 3; in Woche 1 nur gelesen)

| Feld | Typ | Pflicht | Regel / Quelle |
|---|---|---|---|
| `key` | Text | ja | eindeutig; nur Namen aus `config/system.defaults.json` (ADR 006) |
| `value` | Zahl | ja | innerhalb `min`/`max` aus `config/` |
| `updatedAt` | Zeitstempel | ja | |
| `updatedById` | → User | ja | Administrator (E06-US02-FR02) |

### `JobRun` – Protokoll der System-Jobs (Woche 2)

| Feld | Typ | Pflicht | Regel |
|---|---|---|---|
| `id` | UUID | ja | |
| `job` | `FRISTPRUEFUNG` \| `ABHOLFRISTEN` | ja | ADR 007 |
| `stichtag` | Datum | ja | |
| `startedAt`, `finishedAt` | Zeitstempel | ja / nein | |
| `ergebnis` | JSON | nein | Anzahl Erinnerungen, Mahnungen, Abläufe, Fehler |

## Abgeleitete Werte (nicht gespeichert)

| Wert | Regel | Quelle |
|---|---|---|
| Exemplarstatus | siehe ADR 005 | E01-US02-FR01, E02-US02-FR03 |
| Anzahl verfügbarer Exemplare eines Titels | Exemplare mit Status `VERFUEGBAR` | E01-US01-FR03, E02-US02-FR03, E03-US01-FR04 |
| Offene Ausleihen eines Mitglieds | `Loan` mit `memberId` und `returnedAt IS NULL` | E03-US01-FR03, E03-US02-FR01 |
| Überschrittene Tage | `Rückgabedatum bzw. heute − dueDate` in Kalendertagen | E04-US02-FR02, ADR 008 |
| Mahngebühr (solange offen) | überschrittene Tage × `mahnTagessatzEuro` | E04-US02-FR02 |

## Entscheidungen zum Datenmodell

Begründung, Zitat aus der Spezifikation und Einordnung (abgeleitet oder Annahme) stehen in [ADR 009](../adr/009-entscheidungen-zu-luecken-der-spezifikation.md).

| ID | Entscheidung | Art |
|---|---|---|
| OF-D1 | Erscheinungsjahr ist ein **optionales** Feld des Titels; Titel ohne Jahr stehen beim Sortieren nach Jahr am Ende und fallen bei einem Jahresfilter heraus | Abgeleitet (optional: Annahme) |
| OF-D2 | Gesperrt = Zustand `VERLOREN`; `BESCHAEDIGT` ist ausleihbar; keine manuelle Sperre | Annahme |
| OF-D3 | Zustände genau `GUT`, `BESCHAEDIGT`, `VERLOREN` | Annahme |
| OF-D4 | Archiviert = deaktiviert: nicht im öffentlichen Katalog, Detailseite für Gast/Mitglied 404, nicht ausleihbar, nicht vormerkbar, keine neuen Exemplare; Bibliothekare sehen ihn in der Verwaltung; kein Reaktivieren | Abgeleitet |
| OF-D5 | Kategorie ist Freitext; Filter bietet vorhandene Werte aktiver Titel an | Annahme |
| OF-D6 | Inventarnummer fortlaufend vom System, Format `INV-` + sechs Ziffern | Annahme |
| OF-D7 | Genau eine Rolle je Konto; Rechte nur laut Rechte-Matrix | Annahme |
| OF-D8 | Benachrichtigung nur in der App | Annahme |
