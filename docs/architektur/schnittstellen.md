# Schnittstellen (API-Verträge) – Woche 1 bis 3

- Status: Entschieden (Agenten im Auftrag von KiKo, siehe [ADR 009](../adr/009-entscheidungen-zu-luecken-der-spezifikation.md)); Freigabe an Gate 1
- Bezug: F-01 … F-13 (Woche 2 und 3 ergänzt am 01.11.2026, Gate 1 in den Issues #24 … #29), [ADR 003](../adr/003-authentifizierung-sitzungen.md), [ADR 004](../adr/004-schichten-und-ordnerstruktur.md)

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
| `UEBERSCHREITUNG_LAEUFT` | Mahnung begleichen, während der Vorgang noch offen und überfällig ist (OF-F09-2) | F-09 |
| `MAHNUNG_BEGLICHEN` | Mahnung ist schon beglichen | F-09 |
| `EXEMPLAR_VERFUEGBAR` | Vormerken, obwohl ein Exemplar verfügbar ist (E05-US01-FR01) | F-10 |
| `BEREITS_VORGEMERKT` | Mitglied hat für den Titel schon eine aktive Vormerkung (OF-F10-2) | F-10 |
| `EMAIL_VERGEBEN` | Registrierung mit schon registrierter E-Mail (OF-F11-3) | F-11 |
| `EIGENE_ROLLE` | Administrator will die eigene Rolle ändern (OF-F12-1) | F-12 |

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

## Woche 2 und 3 (F-08 … F-13)

Gleiche Regeln wie oben. Module unter `src/server/`, alle Funktionen mit Kontext `k` als erstem Parameter.

### System-Jobs (Rolle System, ADR 007)

| Funktion / Endpunkt | Feature | Wirkung | Ergebnis |
|---|---|---|---|
| `fristpruefung(k)` aus `@/server/jobs/fristpruefung` · `POST /api/system/jobs/fristpruefung` | F-08, F-09 | Erinnerungen (Vorlauf), Markierung „überfällig“, Mahnungen mit Benachrichtigung `MAHNUNG`, Wiederöffnen nach OF-F09-3; Eintrag in `job_runs` | `{ stichtag, erinnerungen, ueberfaellig, mahnungen }` (Anzahl neu entstandener Einträge) |
| `abholfristen(k)` aus `@/server/jobs/abholfristen` · `POST /api/system/jobs/abholfristen` | F-10 | abgelaufene Abholoptionen → `ABGELAUFEN`, Exemplar an die nächste wartende Vormerkung oder frei; Eintrag in `job_runs` | `{ stichtag, abgelaufen, nachgerueckt }` |
| `fuehreTagesjobsAus(k)` aus `@/server/jobs/zeitgeber` | F-08, F-10 (OF-J3) | führt `fristpruefung` und danach `abholfristen` aus, wenn es für `k.uhr.heute()` noch keinen abgeschlossenen Lauf in `job_runs` gibt | `{ stichtag, ausgefuehrt: ("FRISTPRUEFUNG" \| "ABHOLFRISTEN")[] }` |
| `starteZeitgeber({ kontext, intervallMs, timer?, melde? })` aus `@/server/jobs/zeitgeber` | F-08, F-10 (OF-J3) | ruft `fuehreTagesjobsAus` sofort und dann alle `intervallMs` auf; nie zwei Läufe gleichzeitig; Fehler werden gemeldet, nicht geworfen | `{ pruefe(): Promise<void>, stoppen(), bereit: Promise<void> }` |

Die Funktionen prüfen keine Sitzung; sie sind nur über den Endpunkt mit `Authorization: Bearer <JOB_SECRET>` erreichbar (sonst `401`). Stichtag = `k.uhr.heute()`.

### Lese-Funktionen

| Funktion | Modul | Feature | Rolle | Ergebnis |
|---|---|---|---|---|
| `ladeMeineBenachrichtigungen(k)` | `@/server/benachrichtigungen` | F-08, F-10 | angemeldet (eigene) | `{ notificationId, type, createdAt, gelesen, title?, inventoryNumber?, dueDate?, pickupDeadline? }[]`, neueste zuerst |
| `ladeMahnungen(k, { nurOffene? })` | `@/server/mahnungen` | F-09 | Bibliothekar | `{ dunningId, loanId, createdOn, mitgliedEmail, title, inventoryNumber, dueDate, ueberschritteneTage, gebuehrCents, beglichen }[]` |
| `ladeMeineMahnungen(k)` | `@/server/mahnungen` | F-09 | Mitglied (eigene) | `{ dunningId, createdOn, title, inventoryNumber, gebuehrCents, beglichen }[]` |
| `ladeMeineVormerkungen(k)` | `@/server/vormerkung` | F-10 | Mitglied (eigene) | aktive Vormerkungen `{ reservationId, titleId, title, status, position?, inventoryNumber?, pickupDeadline? }[]` |
| `ladeNutzer(k)` | `@/server/administration` | F-12 | Administrator | `{ userId, email, role }[]` nach E-Mail |
| `ladeSystemparameter(k)` | `@/server/administration` | F-12 | Administrator | `{ name, wert, standard, min, max, quelle }[]` |
| `ladeDashboard(k, { sortierung?: "FAELLIGKEIT" \| "MITGLIED", richtung?: "AUF" \| "AB" })` | `@/server/dashboard` | F-13 | Bibliothekar | `{ kennzahlen: { offeneAusleihen, ueberfaellig, aktiveVormerkungen }, ueberfaellige: { loanId, mitgliedEmail, title, inventoryNumber, dueDate, ueberschritteneTage }[] }` |
| `ladeVorgang(k, loanId)` | `@/server/dashboard` | F-13 | Bibliothekar | `{ loanId, title, inventoryNumber, mitgliedEmail, startDate, dueDate, renewalCount, overdueSince, returnedAt, mahnung? }` |
| `exportiereBestandCsv(k)` | `@/server/dashboard` | F-13 | Bibliothekar | `{ dateiname, inhalt }` (CSV-Text) |

`ladeTitelDetail` (F-02) bekommt für ein Mitglied das Feld `meineVormerkung?: { status, position?, pickupDeadline? }` (nur eigene, F-10 AK-01.5); `aktionen.ausleihen` ist für das Mitglied mit abholbereiter Vormerkung wahr, `aktionen.vormerken` ist falsch, wenn es schon vorgemerkt hat.

### Server Actions

| Action | Modul | Feature | Rolle | Eingabe | Ergebnis bei Erfolg | Mögliche Fehler |
|---|---|---|---|---|---|---|
| `benachrichtigungenGelesen` | `@/server/benachrichtigungen` | F-08 | angemeldet | – | `{ anzahl }` | `NICHT_ANGEMELDET` |
| `mahnungBegleichen` | `@/server/mahnungen` | F-09 | Bibliothekar | `dunningId` | `{ dunningId, settledAt, gebuehrCents }` | `NICHT_GEFUNDEN`, `UEBERSCHREITUNG_LAEUFT`, `MAHNUNG_BEGLICHEN` |
| `vormerken` | `@/server/vormerkung` | F-10 | Mitglied | `titleId` | `{ reservationId, position }` | `NICHT_GEFUNDEN`, `BEREITS_VORGEMERKT`, `EXEMPLAR_VERFUEGBAR` |
| `ausleihen` (geändert) | `@/server/ausleihe` | F-10 | Mitglied | `titleId` | wie oben; mit abholbereiter Vormerkung das zugeordnete Exemplar, Vormerkung `ABGEHOLT` | wie oben |
| `registrieren` | `@/server/auth/registrierung` | F-11 | Gast | `email`, `passwort` | `{ userId }` | `VALIDIERUNG`, `EMAIL_VERGEBEN` |
| `rolleZuweisen` | `@/server/administration` | F-12 | Administrator | `userId`, `role` | `{ userId, role }` | `NICHT_GEFUNDEN`, `VALIDIERUNG`, `EIGENE_ROLLE` |
| `systemparameterAendern` | `@/server/administration` | F-12 | Administrator | `name`, `wert` | `{ name, wert }` | `VALIDIERUNG` |

Prüfreihenfolge bei `vormerken`: Anmeldung → Rolle → Titel existiert/aktiv → schon vorgemerkt → Exemplar verfügbar.

### Seiten (Vorschlag)

| Pfad | Inhalt | Rolle |
|---|---|---|
| `/konto/benachrichtigungen` | eigene Benachrichtigungen | angemeldet |
| `/konto/ausleihen` | zusätzlich eigene Mahnungen | Mitglied |
| `/konto/vormerkungen` | eigene Vormerkungen mit Platz | Mitglied |
| `/verwaltung/mahnungen` | Mahnungen, Begleichen | Bibliothekar |
| `/verwaltung/dashboard` | Kennzahlen, überfällige Ausleihen, Export | Bibliothekar |
| `/verwaltung/ausleihen/[loanId]` | ein Ausleihvorgang | Bibliothekar |
| `/verwaltung/bestand.csv` | CSV-Download | Bibliothekar |
| `/registrieren` | Registrierung | Gast |
| `/admin/nutzer`, `/admin/parameter` | Rollen, Systemparameter | Administrator |

## Entscheidungen

- OF-S1: Prüfreihenfolge wie oben festgelegt. Annahme (reine Technik), siehe [ADR 009](../adr/009-entscheidungen-zu-luecken-der-spezifikation.md).
