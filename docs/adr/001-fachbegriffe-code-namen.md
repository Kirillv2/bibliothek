# ADR 001: Fachbegriffe → Code-Namen

- Status: Vorgeschlagen (Gate 1)
- Bezug: Spezifikation 1.4 (Glossar), `CLAUDE.md` „Fachbegriffe“, alle Features F-01 … F-13

## Kontext

Die Spezifikation verwendet deutsche Fachbegriffe (Glossar 1.4). Code, Datenbank und Tests brauchen eine einheitliche Übersetzung, sonst entstehen Synonyme (z. B. `Book`, `Item`, `Medium`, `Rental`) und die Rückverfolgbarkeit leidet.

## Entscheidung

Im Code (TypeScript-Typen, Tabellen, Funktionen) gelten diese Namen. In der Oberfläche und in Dokumenten bleiben die deutschen Begriffe.

| Fachbegriff (Glossar) | Code-Name | Tabelle | Hinweis |
|---|---|---|---|
| Titel / Medium | `Title` | `titles` | katalogisiertes Werk, unabhängig von der Anzahl |
| Exemplar | `Copy` | `copies` | physisches Stück mit `inventoryNumber` |
| Inventarnummer | `inventoryNumber` | Spalte `inventory_number` | eindeutig (E02-US02-FR01) |
| Zustand (eines Exemplars) | `condition` | Spalte `condition` | E02-US02-FR02 |
| Ausleihvorgang | `Loan` | `loans` | Zuordnung Exemplar ↔ Mitglied |
| Frist / Fälligkeit | `dueDate` | Spalte `due_date` | Datum ohne Uhrzeit |
| Rückgabedatum | `returnedAt` | Spalte `returned_at` | E03-US03-FR01 |
| Verlängerung | `renewal`, Zähler `renewalCount` | Spalte `renewal_count` | E03-US02-FR02 |
| Mahnung | `Dunning` | `dunnings` | E04-US02 |
| Mahngebühr | `fee` (in Cent: `feeCents`) | Spalte `fee_cents` | E04-US02-FR02 |
| Vormerkung / Reservierung | `Reservation` | `reservations` | Warteschlange je Titel (E05-US01-FR02) |
| Abholfrist | `pickupDeadline` | Spalte `pickup_deadline` | E05-US01-FR03 |
| Benachrichtigung | `Notification` | `notifications` | Erinnerung, Mahnung, Abholung |
| Nutzer / Konto | `User` | `users` | Rolle siehe unten |
| Rolle | `Role` | Spalte `role` | `MITGLIED`, `BIBLIOTHEKAR`, `ADMINISTRATOR` |
| Gast | – | – | nicht angemeldet, kein Datensatz |
| System (Automatik) | `SystemJob` | `job_runs` | zeitgesteuerte Prozesse |
| Systemparameter | `SystemSetting` | `system_settings` | E06-US02-FR02 |
| Kategorie | `category` | Spalte `category` | siehe offene Frage im Datenmodell |
| Erscheinungsjahr | `publicationYear` | Spalte `publication_year` | siehe offene Frage im Datenmodell |

Werte von Aufzählungen (Rollen, Zustände, Status) werden in Großbuchstaben auf Deutsch geschrieben (`VERLOREN`, `WARTEND`), damit sie in Tests und Oberfläche direkt erkennbar sind.

Namen der Konfigurationswerte werden **nicht** neu erfunden, sondern 1:1 aus `config/system.defaults.json` übernommen (z. B. `leihfristTage`, `ausleihlimitProMitglied`).

## Begründung

- Englische Code-Namen passen zu Next.js/TypeScript und Bibliotheken.
- Eine feste Tabelle verhindert Synonyme zwischen Agenten und Menschen.
- Rollen- und Statuswerte auf Deutsch halten die Brücke zur Spezifikation sichtbar.

## Alternativen

- **Alles Deutsch im Code** (`Exemplar`, `Ausleihvorgang`): nah an der Spezifikation, aber gemischt mit englischen Framework-Namen schwer lesbar.
- **`Reminder` statt `Dunning`** für Mahnung: verworfen, weil „Reminder“ mit der Erinnerung vor Fälligkeit (E04-US01-FR02) verwechselt würde. Die Erinnerung ist eine `Notification` vom Typ `ERINNERUNG`.

## Folgen

- Development, Testing und Review & Security prüfen gegen diese Tabelle.
- Neue Begriffe kommen nur über eine Änderung dieses ADR hinzu.
