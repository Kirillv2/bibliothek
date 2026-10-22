# Schnittstellen (API-Verträge) – Woche 1

- Status: Entschieden (Agenten im Auftrag von KiKo, siehe [ADR 009](../adr/009-entscheidungen-zu-luecken-der-spezifikation.md)); Freigabe an Gate 1
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
| `NICHT_GEFUNDEN` | Datensatz existiert nicht, gehört einem anderen Mitglied **oder** der Titel ist für Gast/Mitglied archiviert | F-02 … F-07 |
| `VALIDIERUNG` | Eingabe ungültig, Details in `felder` | F-01, F-03, F-04, F-07 |
| `KEIN_EXEMPLAR_VERFUEGBAR` | kein Exemplar des Titels verfügbar | F-05 |
| `AUSLEIHLIMIT_ERREICHT` | offene Ausleihen ≥ `ausleihlimitProMitglied` | F-05 |
| `OFFENE_MAHNUNG` | Mitglied hat eine offene Mahnung | F-05 |
| `TITEL_ARCHIVIERT` | Exemplar zu einem archivierten Titel anlegen (OF-D4, OF-F04-2) | F-04 |
| `VORMERKUNG_VORHANDEN` | Verlängerung nicht möglich, weil vorgemerkt | F-06 |
| `MAX_VERLAENGERUNGEN_ERREICHT` | `renewalCount` ≥ `maxVerlaengerungen` | F-06 |
| `AUSLEIHVORGANG_ABGESCHLOSSEN` | Rückgabe/Verlängerung eines bereits abgeschlossenen Vorgangs | F-06, F-07 |
| `TITEL_NICHT_ARCHIVIERBAR` | ein Exemplar ist noch ausgeliehen oder vorgemerkt | F-03 |

## Lese-Schnittstellen (Server, ohne Wirkung)

### `sucheKatalog(anfrage)` – F-01 · Rolle: alle (auch Gast)

Eingabe:

| Feld | Typ | Pflicht | Bezug |
|---|---|---|---|
| `q` | Text | nein | Freitext über Titel, Autor, ISBN, Inventarnummer (E01-US01-FR01); Teilwort, ohne Groß-/Kleinschreibung; bei ISBN/Inventarnummer ohne Bindestriche und Leerzeichen (OF-F01-1) |
| `kategorie` | Text | nein | Filter (E01-US01-FR02) |
| `nurVerfuegbar` | Boolean | nein | Filter Verfügbarkeit (E01-US01-FR02) |
| `jahrVon`, `jahrBis` | Ganzzahl | nein | Filter Erscheinungsjahr (E01-US01-FR02, OF-D1) |
| `sortierung` | `KATEGORIE` \| `VERFUEGBARKEIT` \| `JAHR` (+ `richtung`: `AUF` \| `AB`) | nein | E01-US01-FR02; ohne Angabe alphabetisch nach Titel, Titel ist immer zweites Kriterium (OF-F01-3); ohne Jahr am Ende (OF-D1) |
| `seite` | Ganzzahl ≥ 1 | nein | 20 Treffer je Seite (OF-F01-6) |

Ergebnis: `{ treffer, gesamt, seite }`; je Treffer `{ titleId, title, author, category, publicationYear?, verfuegbareExemplare }` (E01-US01-FR03). Nur aktive Titel (OF-D4). Ohne `q`: alle aktiven Titel (OF-F01-2). **Keine** Personendaten.

### `ladeTitelDetail(titleId)` – F-02 · Rolle: alle

Ergebnis: alle Metadaten des Titels + `exemplare: { inventoryNumber, status: VERFUEGBAR | AUSGELIEHEN | VORGEMERKT | GESPERRT, faelligAm?: Datum }[]` (sortiert nach Inventarnummer; `GESPERRT` wird als „nicht verfügbar“ angezeigt, OF-F02-2) + `aktionen: { ausleihen: boolean, vormerken: boolean }` (E01-US02-FR01 … FR03). Archivierter Titel für Gast/Mitglied: `NICHT_GEFUNDEN` (OF-F02-3). **Keine** Personendaten.

### `ladeMeineAusleihen()` – F-06 · Rolle: Mitglied

Ergebnis: offene Ausleihvorgänge des angemeldeten Mitglieds: `{ loanId, title, inventoryNumber, dueDate, renewalCount, verlaengerbar: boolean, grund?: Fehlercode }[]` (E03-US02-FR01).

## Server Actions (mit Wirkung)

| Action | Feature | Rolle | Eingabe | Ergebnis bei Erfolg | Mögliche Fehler |
|---|---|---|---|---|---|
| `anmelden` | (Woche 1 Seed) | Gast | `email`, `passwort` | Sitzung gesetzt | `VALIDIERUNG` (gleiche Meldung für falsche E-Mail und falsches Passwort) |
| `abmelden` | – | angemeldet | – | Sitzung gelöscht | – |
| `titelAnlegen` | F-03 | Bibliothekar | `title`, `author`, `category`, `isbn?`, `description?`, `publicationYear?` (OF-D1) | `{ titleId }` | `NICHT_ANGEMELDET`, `KEINE_BERECHTIGUNG`, `VALIDIERUNG` |
| `titelBearbeiten` | F-03 | Bibliothekar | `titleId` + Felder wie oben | `{ titleId }` | + `NICHT_GEFUNDEN` |
| `titelArchivieren` | F-03 | Bibliothekar | `titleId` | `{ titleId, archivedAt }` | + `TITEL_NICHT_ARCHIVIERBAR` |
| `exemplarAnlegen` | F-04 | Bibliothekar | `titleId`, `condition?` (Standard `GUT`) | `{ copyId, inventoryNumber }` | `NICHT_GEFUNDEN`, `VALIDIERUNG`, `TITEL_ARCHIVIERT` |
| `exemplarZustandAendern` | F-04 | Bibliothekar | `copyId`, `condition` | `{ copyId, condition }` | `NICHT_GEFUNDEN`, `VALIDIERUNG` |
| `ausleihen` | F-05 | Mitglied | `titleId` | `{ loanId, inventoryNumber, startDate, dueDate }` | `KEIN_EXEMPLAR_VERFUEGBAR`, `AUSLEIHLIMIT_ERREICHT`, `OFFENE_MAHNUNG`, `NICHT_GEFUNDEN` (auch archivierter Titel) |
| `verlaengern` | F-06 | Mitglied | `loanId` | `{ loanId, dueDate, renewalCount, mahngebuehrCents? }` | `NICHT_GEFUNDEN`, `VORMERKUNG_VORHANDEN`, `MAX_VERLAENGERUNGEN_ERREICHT`, `AUSLEIHVORGANG_ABGESCHLOSSEN` |
| `rueckgabeErfassen` | F-07 | Bibliothekar | `inventoryNumber` | `{ loanId, returnedAt, mahngebuehrCents?, zugeordneteVormerkungId? }` | `NICHT_GEFUNDEN` (kein offener Vorgang zu dieser Nummer), `VALIDIERUNG` |

Bei mehreren gleichzeitigen Fehlern bei `ausleihen` gilt die Reihenfolge der Prüfung: Anmeldung → Rolle → Titel existiert/aktiv → offene Mahnung → Ausleihlimit → verfügbares Exemplar (OF-S1).

Bei `verlaengern`: Anmeldung → Rolle → Vorgang gehört dem Mitglied → Vorgang offen → wartende Vormerkung → Höchstzahl an Verlängerungen.

## Seiten (Vorschlag)

| Pfad | Inhalt | Rolle |
|---|---|---|
| `/` bzw. `/katalog` | Suche und Trefferliste | alle |
| `/titel/[titleId]` | Detailseite | alle |
| `/anmelden` | Anmeldung | Gast |
| `/konto/ausleihen` | eigene Ausleihen, Verlängern | Mitglied |
| `/verwaltung/titel` (+ `/neu`, `/[titleId]`) | Titel und Exemplare pflegen | Bibliothekar |
| `/verwaltung/rueckgabe` | Rückgabe per Inventarnummer | Bibliothekar |

## Entscheidungen

- OF-S1: Prüfreihenfolge wie oben festgelegt. Annahme (reine Technik), siehe [ADR 009](../adr/009-entscheidungen-zu-luecken-der-spezifikation.md).
