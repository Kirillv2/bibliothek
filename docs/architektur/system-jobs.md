# Konzept: Zeitgesteuerte System-Jobs

- Status: Entschieden (Agenten im Auftrag von KiKo); Freigabe an Gate 1, umgesetzt ab Woche 2 (F-08, F-09, F-10)
- Bezug: Rolle „System“ (1.3), E04-US01-FR01 … FR03, E04-US02-FR01, E05-US01-FR03, NFR04
- Entscheidung: [ADR 007](../adr/007-system-jobs.md)

Dieses Dokument beschreibt nur den Rahmen. Die fachlichen Akzeptanzkriterien stehen später in den Specs F-08, F-09 und F-10.

## Jobs

| Job | Endpunkt | Takt | Was er tut | Quelle |
|---|---|---|---|---|
| Fristprüfung | `POST /api/system/jobs/fristpruefung` | täglich | prüft alle offenen Ausleihvorgänge gegen den Stichtag; Erinnerung bei nahender Fälligkeit (Vorlauf `erinnerungVorlaufTage`); setzt „überfällig“; erzeugt je überfälligem Vorgang eine Mahnung | E04-US01-FR01 … FR03, E04-US02-FR01 |
| Abholfristen | `POST /api/system/jobs/abholfristen` | täglich | beendet abgelaufene Abholoptionen (`abholfristVormerkungTage`); die nächste Person der Warteschlange rückt nach | E05-US01-FR03 |

## Ablauf eines Laufs

1. Secret prüfen (sonst `401`).
2. Stichtag bestimmen (Uhr, `Europe/Berlin`, ADR 008).
3. `job_runs`-Eintrag mit `startedAt` anlegen.
4. Arbeit in kleinen Transaktionen; jede Wirkung über einen eindeutigen Schlüssel (`ON CONFLICT DO NOTHING`).
5. `finishedAt` und Ergebnis (Anzahlen aus der DB) speichern; Antwort `200` mit dem Ergebnis.

## Idempotenz (NFR04)

| Wirkung | Eindeutiger Schlüssel |
|---|---|
| Erinnerung | `notifications(type = ERINNERUNG, loan_id, due_date)` |
| „Überfällig“ | `loans.overdue_since` wird nur gesetzt, wenn leer |
| Mahnung | `dunnings(loan_id)` |
| Benachrichtigung Mahnung | `notifications(type = MAHNUNG, loan_id)` |
| Ablauf Abholoption | Statuswechsel `ABHOLBEREIT → ABGELAUFEN` nur aus `ABHOLBEREIT` |

Pflichttest: Lauf zweimal mit demselben Stichtag → Datenbank nach dem zweiten Lauf unverändert.

## Lokal und im Test

- Lokal: `curl -X POST -H "Authorization: Bearer $JOB_SECRET" http://localhost:3000/api/system/jobs/fristpruefung`
- Tests rufen die Job-Funktion direkt mit fester Uhr auf; Security-Tests rufen den Endpunkt ohne/mit falschem Secret auf.

## Entscheidungen

- OF-J1, OF-J2: geplanter GitHub-Actions-Workflow, einmal täglich nachts (ADR 007, ADR 009); `config-request` vor Woche 2.
- Benachrichtigungen nur in der App (OF-D8).
- Fachliche Detailfragen (z. B. wiederholte Mahnungen): Specs F-08 bis F-10.
