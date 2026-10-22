# Schnittstellen (API-Verträge) – Woche 1

- Status: Vorgeschlagen (Gate 1)
- Bezug: F-01 … F-07, [ADR 003](../adr/003-authentifizierung-sitzungen.md), [ADR 004](../adr/004-schichten-und-ordnerstruktur.md)

Die Verträge legen Namen, Eingaben, Ergebnisse und Fehlercodes fest, damit Testing (vor Gate 2) und Development dieselbe Grundlage haben. Seitenpfade sind ein Vorschlag; maßgeblich sind die Funktionen.

## Gemeinsame Regeln

- Server Actions liefern `Ergebnis<T> = { ok: true; daten: T } | { ok: false; fehler: Fehlercode; felder?: Record<string, string> }`.
- Rolle und Mitglieds-ID kommen **immer** aus der Sitzung, nie aus der Eingabe.
- Datumswerte: `Datum` = `"JJJJ-MM-TT"` (ADR 008); Anzeige `TT.MM.JJJJ`.

### Fehlercodes

| Code | Bedeutung | Verwendet in |
|---|---|---|
| `NICHT_ANGEMELDET` | keine gültige Sitzung (Seite: Weiterleitung zur Anmeldung) | alle geschützten Actions |
| `KEINE_BERECHTIGUNG` | angemeldet, aber Rolle nicht erlaubt | alle geschützten Actions |
| `NICHT_GEFUNDEN` | Datensatz existiert nicht **oder** gehört einem anderen Mitglied | F-02 … F-07 |
| `VALIDIERUNG` | Eingabe ungültig, Details in `felder` | F-01, F-03, F-04, F-07 |
| `KEIN_EXEMPLAR_VERFUEGBAR` | kein Exemplar des Titels verfügbar | F-05 |
| `AUSLEIHLIMIT_ERREICHT` | offene Ausleihen ≥ `ausleihlimitProMitglied` | F-05 |
| `OFFENE_MAHNUNG` | Mitglied hat eine offene Mahnung | F-05 |
| `TITEL_ARCHIVIERT` | Titel ist archiviert (siehe OF-D4) | F-04, F-05 |
| `VORMERKUNG_VORHANDEN` | Verlängerung nicht möglich, weil vorgemerkt | F-06 |
| `MAX_VERLAENGERUNGEN_ERREICHT` | `renewalCount` ≥ `maxVerlaengerungen` | F-06 |
| `AUSLEIHVORGANG_ABGESCHLOSSEN` | Rückgabe/Verlängerung eines bereits abgeschlossenen Vorgangs | F-06, F-07 |
| `TITEL_NICHT_ARCHIVIERBAR` | ein Exemplar ist noch ausgeliehen oder vorgemerkt | F-03 |

## Lese-Schnittstellen (Server, ohne Wirkung)

### `sucheKatalog(anfrage)` – F-01 · Rolle: alle (auch Gast)

Eingabe:

| Feld | Typ | Pflicht | Bezug |
|---|---|---|---|
| `q` | Text | nein | Freitext über Titel, Autor, ISBN, Inventarnummer (E01-US01-FR01) |
| `kategorie` | Text | nein | Filter (E01-US01-FR02) |
| `nurVerfuegbar` | Boolean | nein | Filter Verfügbarkeit (E01-US01-FR02) |
| `jahrVon`, `jahrBis` | Ganzzahl | nein | Filter Erscheinungsjahr (E01-US01-FR02, OF-D1) |
| `sortierung` | `KATEGORIE` \| `VERFUEGBARKEIT` \| `JAHR` (+ `richtung`: `AUF` \| `AB`) | nein | E01-US01-FR02 |

Ergebnis je Treffer: `{ titleId, title, author, category, publicationYear?, verfuegbareExemplare }` (E01-US01-FR03). **Keine** Personendaten.

### `ladeTitelDetail(titleId)` – F-02 · Rolle: alle

Ergebnis: alle Metadaten des Titels + `exemplare: { inventoryNumber, status: VERFUEGBAR | AUSGELIEHEN | VORGEMERKT | GESPERRT, faelligAm?: Datum }[]` + `aktionen: { ausleihen: boolean, vormerken: boolean }` (E01-US02-FR01 … FR03). **Keine** Personendaten.

### `ladeMeineAusleihen()` – F-06 · Rolle: Mitglied

Ergebnis: offene Ausleihvorgänge des angemeldeten Mitglieds: `{ loanId, title, inventoryNumber, dueDate, renewalCount, verlaengerbar: boolean, grund?: Fehlercode }[]` (E03-US02-FR01).

## Server Actions (mit Wirkung)

| Action | Feature | Rolle | Eingabe | Ergebnis bei Erfolg | Mögliche Fehler |
|---|---|---|---|---|---|
| `anmelden` | (Woche 1 Seed) | Gast | `email`, `passwort` | Sitzung gesetzt | `VALIDIERUNG` (gleiche Meldung für falsche E-Mail und falsches Passwort) |
| `abmelden` | – | angemeldet | – | Sitzung gelöscht | – |
| `titelAnlegen` | F-03 | Bibliothekar | `title`, `author`, `category`, `isbn?`, `description?`, `publicationYear?` | `{ titleId }` | `NICHT_ANGEMELDET`, `KEINE_BERECHTIGUNG`, `VALIDIERUNG` |
| `titelBearbeiten` | F-03 | Bibliothekar | `titleId` + Felder wie oben | `{ titleId }` | + `NICHT_GEFUNDEN` |
| `titelArchivieren` | F-03 | Bibliothekar | `titleId` | `{ titleId, archivedAt }` | + `TITEL_NICHT_ARCHIVIERBAR` |
| `exemplarAnlegen` | F-04 | Bibliothekar | `titleId`, `condition` | `{ copyId, inventoryNumber }` | `NICHT_GEFUNDEN`, `VALIDIERUNG`, `TITEL_ARCHIVIERT` |
| `exemplarZustandAendern` | F-04 | Bibliothekar | `copyId`, `condition` | `{ copyId, condition }` | `NICHT_GEFUNDEN`, `VALIDIERUNG` |
| `ausleihen` | F-05 | Mitglied | `titleId` | `{ loanId, inventoryNumber, startDate, dueDate }` | `KEIN_EXEMPLAR_VERFUEGBAR`, `AUSLEIHLIMIT_ERREICHT`, `OFFENE_MAHNUNG`, `TITEL_ARCHIVIERT`, `NICHT_GEFUNDEN` |
| `verlaengern` | F-06 | Mitglied | `loanId` | `{ loanId, dueDate, renewalCount }` | `NICHT_GEFUNDEN`, `VORMERKUNG_VORHANDEN`, `MAX_VERLAENGERUNGEN_ERREICHT`, `AUSLEIHVORGANG_ABGESCHLOSSEN` |
| `rueckgabeErfassen` | F-07 | Bibliothekar | `inventoryNumber` | `{ loanId, returnedAt, mahngebuehrCents?, zugeordneteVormerkungId? }` | `NICHT_GEFUNDEN` (kein offener Vorgang zu dieser Nummer), `VALIDIERUNG` |

Bei mehreren gleichzeitigen Fehlern bei `ausleihen` gilt die Reihenfolge der Prüfung: Anmeldung → Rolle → Titel existiert/aktiv → offene Mahnung → Ausleihlimit → verfügbares Exemplar. Die Reihenfolge ist ein Vorschlag (OF-S1).

## Seiten (Vorschlag)

| Pfad | Inhalt | Rolle |
|---|---|---|
| `/` bzw. `/katalog` | Suche und Trefferliste | alle |
| `/titel/[titleId]` | Detailseite | alle |
| `/anmelden` | Anmeldung | Gast |
| `/konto/ausleihen` | eigene Ausleihen, Verlängern | Mitglied |
| `/verwaltung/titel` (+ `/neu`, `/[titleId]`) | Titel und Exemplare pflegen | Bibliothekar |
| `/verwaltung/rueckgabe` | Rückgabe per Inventarnummer | Bibliothekar |

## Offene Fragen

- OF-S1: Reihenfolge der Prüfungen beim Ausleihen (welcher Fehler wird gemeldet, wenn mehrere zutreffen)? Die Spezifikation legt keine fest.
