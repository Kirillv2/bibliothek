# Progress Report Einrichtungswoche (16.10. bis 23.10.2026) – Team 1 (agentisch)

Stand: abgeschlossen. Diese Woche wird laut Evaluations-Repo nicht gemessen (reine Einrichtung). Sie ist die Ausgangslage (Baseline) für die Wochen 1 bis 3.

## 1. Ziel der Woche

- Projekt-Repo mit agentischer Struktur aufsetzen: fünf Agentenrollen (Orchestrator, Planning & Architecture, Development, Testing, Review & Security), drei menschliche Gates, Schutzregeln.
- Planning für Woche 1 (F-01 bis F-07) bis Gate 1, Tests aus den Akzeptanzkriterien bis Gate 2.

## 2. Ergebnis

| Was | Beleg |
|---|---|
| Projektgerüst (Next.js, Vitest, Playwright, CI, Agenten-Konfiguration, `CLAUDE.md`, CODEOWNERS) | Commits von Kirill am 21.10.2026 auf `main` |
| Spezifikation im Repo | PR [#1](https://github.com/Kirillv2/bibliothek/pull/1) |
| Planning Woche 1: Datenmodell, Rechte-Matrix, Security-Architektur, ADR 001 bis 009, Specs F-01 bis F-07 (Gate 1) | PR [#9](https://github.com/Kirillv2/bibliothek/pull/9) |
| Jegor55 als zweiter Code Owner | PR [#11](https://github.com/Kirillv2/bibliothek/pull/11) |
| Datenbank-Pakete (config-request [#10](https://github.com/Kirillv2/bibliothek/issues/10)) | PR [#12](https://github.com/Kirillv2/bibliothek/pull/12) |
| Tests aus den Akzeptanzkriterien F-01 bis F-07 (rot, für Gate 2) | Commits vom 22.10.2026 in den PRs [#13](https://github.com/Kirillv2/bibliothek/pull/13) bis [#19](https://github.com/Kirillv2/bibliothek/pull/19) |
| Feature-Issues F-01 bis F-07 | Issues [#2](https://github.com/Kirillv2/bibliothek/issues/2) bis [#8](https://github.com/Kirillv2/bibliothek/issues/8) |

## 3. Beiträge je Person

| Person | Rolle | Was |
|---|---|---|
| Kirill | Konfigurationsrolle, steuert die Agenten | Projektgerüst und Agenten-Konfiguration angelegt, CODEOWNERS, Merges von #1 und #11 |
| Jegor | Reviewer, Code Owner | Merges von #9 (Planning, Gate 1) und #12 |
| Tom, Mohammad | Team | zu dieser Woche keine Einträge in der Zeiterfassung |
| Claude (Agenten) | Planning, Testing | Specs, ADRs, Rechte-Matrix, Tests aus Akzeptanzkriterien |

**Stunden** (berechnet aus [`zeiterfassung.csv` @ 4c64e37](https://github.com/DenisA1103/evaluation/blob/4c64e37cf5e397ced4d084669180b2f0bfbf4a1c/data/team-1/zeiterfassung.csv), Einträge vor dem 23.10.2026): Claude 4,0 h. Für die Menschen gibt es in dieser Woche keine Einträge.

**Commits auf `main`** (nach Commit-Datum bis 23.10.2026 12:00, ohne Merges): Claude 19, Kirill 5 (Git-Namen „Kirill“ und „Kirillv2“). Merges: Jegor55 2, Kirillv2 2.

```bash
git shortlog -sn --no-merges --until="2026-10-23T12:00:00+02:00" origin/main
git shortlog -sn --merges    --until="2026-10-23T12:00:00+02:00" origin/main
```

## 4. Messung

Keine (Einrichtungswoche). CI und CodeQL laufen ab dem Projektgerüst bei jedem PR: [GitHub Actions](https://github.com/Kirillv2/bibliothek/actions).

## 5. Entscheidungen und Probleme

- Lücken der Spezifikation entscheiden die Agenten selbst nach der Spezifikation und markieren sie als Annahme: [ADR 009](../adr/009-entscheidungen-zu-luecken-der-spezifikation.md).
- Konfigurationswerte kommen nur aus `config/system.defaults.json`: [ADR 006](../adr/006-konfigurationswerte.md).
- Datenbank PGlite lokal, PostgreSQL gehostet: [ADR 002](../adr/002-persistenz-datenbank.md).

## 6. Ausblick

Woche 1: Gate 2 für F-01 bis F-07, Umsetzung, Gate 3.
