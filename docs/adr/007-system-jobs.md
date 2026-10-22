# ADR 007: Zeitgesteuerte System-Jobs über geschützte Endpunkte

- Status: Vorgeschlagen (Gate 1), umgesetzt ab Woche 2
- Bezug: E04-US01-FR01 … FR03, E04-US02-FR01, E05-US01-FR03, NFR04, Rolle „System“ (Spezifikation 1.3)

## Kontext

Die Rolle „System“ führt zeitgesteuerte Prozesse aus: tägliche Fristprüfung mit Erinnerung, Markierung „überfällig“ und Mahnungserzeugung; Ablauf der Abholfrist bei Vormerkungen. NFR04 verlangt, dass die Fristprüfung reproduzierbar und idempotent läuft. `CLAUDE.md`: Jobs nur mit Job-Secret aufrufbar.

## Entscheidung (Vorschlag)

1. **Jobs als Route Handler:** `POST /api/system/jobs/fristpruefung` und `POST /api/system/jobs/abholfristen`.
2. **Schutz:** Header `Authorization: Bearer <JOB_SECRET>`. Vergleich mit `timingSafeEqual`. Ohne gültiges Secret: `401`, kein Hinweis, ob der Job existiert. Nutzer-Sitzungen (auch Administrator) reichen **nicht**.
3. **Stichtag:** Der Job arbeitet mit einem Stichtag (Standard: heutiges Datum in `Europe/Berlin`, siehe ADR 008). Im Test wird der Stichtag über die feste Uhr gesetzt.
4. **Idempotenz über eindeutige Schlüssel**, nicht über „Job lief heute schon“:
   - Mahnung: höchstens eine je Ausleihvorgang (`UNIQUE dunnings(loan_id)`), Anlage per `INSERT … ON CONFLICT DO NOTHING`.
   - Erinnerung: höchstens eine je Ausleihvorgang und Fälligkeit (`UNIQUE notifications(type, loan_id, due_date)`), damit nach einer Verlängerung wieder erinnert werden kann.
   - „Überfällig“-Markierung: setzt `overdueSince` nur, wenn es noch leer ist.
   - Damit kann ein abgebrochener Lauf einfach wiederholt werden.
5. **Protokoll:** Jeder Lauf schreibt einen Datensatz in `job_runs` (Job, Stichtag, Start, Ende, Anzahl erzeugter Erinnerungen/Mahnungen/Abläufe, Fehler). Die Anzahl kommt aus der Datenbank, nicht aus einem Agenten.
6. **Auslöser:** täglich durch einen Scheduler des Hosters (z. B. Vercel Cron) oder einen geplanten GitHub-Actions-Workflow. Die Wahl ist offen (OF-J1) und gehört der Konfigurationsrolle, weil sie `.github/` bzw. Hosting-Konfiguration betrifft.

## Begründung

- Eindeutige Schlüssel machen den zweiten Lauf am selben Tag wirkungslos (NFR04), auch bei gleichzeitigen Läufen.
- Ein Endpunkt mit Secret ist unabhängig vom Hoster und lokal per `curl` testbar.

## Alternativen

- **Prozess mit `setInterval` in der App:** läuft auf Serverless-Hostern nicht zuverlässig.
- **Datenbank-Cron (pg_cron):** nicht in PGlite und nicht bei jedem Anbieter verfügbar.
- **„Schon gelaufen?“-Sperre je Tag:** ein abgebrochener Lauf könnte nicht wiederholt werden.

## Offene Fragen

- OF-J1: Welcher Scheduler (Hoster-Cron oder GitHub Actions)? Entscheidung Konfigurationsrolle.
- OF-J2: Uhrzeit des täglichen Laufs. Entscheidung Konfigurationsrolle.
- Fachliche Fragen zu Erinnerung, Mahnung und Abholfrist klärt Planning in den Specs F-08 bis F-10.

Details: `docs/architektur/system-jobs.md`.
