# Progress Report Woche 2 (Sprint p1-s2, 30.10. bis 06.11.2026) – Team 1 (agentisch) – Zwischenstand

Stand: Zwischenstand vom 02.11.2026. Stichtag Freitag 06.11.2026 12:00. Nach der Messung von Denis wird dieser Report abgeschlossen (Snapshot, Abnahme, Messung, Stunden neu berechnen).

## 1. Ziel der Woche

E04 und E05, Features F-08 bis F-10 (laut [`data/features.csv`](https://github.com/DenisA1103/evaluation/blob/4c64e37cf5e397ced4d084669180b2f0bfbf4a1c/data/features.csv)). F-11 bis F-13 (Woche 3) wurden vorgezogen.

## 2. Ergebnis

| Was | Issue | PR | gemergt |
|---|---|---|---|
| Planning F-08 bis F-13 (Specs, Schnittstellen, Rechte, ADR 009) | – | [#31](https://github.com/Kirillv2/bibliothek/pull/31) | 01.11.2026 |
| F-08 E04-US01 Fristprüfung | [#24](https://github.com/Kirillv2/bibliothek/issues/24) | [#32](https://github.com/Kirillv2/bibliothek/pull/32) | 02.11.2026 (UTC 01.11.) |
| F-09 E04-US02 Mahnungen | [#25](https://github.com/Kirillv2/bibliothek/issues/25) | [#33](https://github.com/Kirillv2/bibliothek/pull/33) | 02.11.2026 |
| F-10 E05-US01 Vormerken | [#26](https://github.com/Kirillv2/bibliothek/issues/26) | [#34](https://github.com/Kirillv2/bibliothek/pull/34) | 02.11.2026 |
| F-11 E06-US01 Registrierung, Anmeldung (vorgezogen) | [#27](https://github.com/Kirillv2/bibliothek/issues/27) | [#35](https://github.com/Kirillv2/bibliothek/pull/35) | 02.11.2026 |
| F-12 E06-US02 Rollen, Parameter (vorgezogen) | [#28](https://github.com/Kirillv2/bibliothek/issues/28) | [#36](https://github.com/Kirillv2/bibliothek/pull/36) | 02.11.2026 |
| F-13 E07-US01 Dashboard, CSV-Export (vorgezogen) | [#29](https://github.com/Kirillv2/bibliothek/issues/29) | [#37](https://github.com/Kirillv2/bibliothek/pull/37) | 02.11.2026 |
| Design-Durchgang (NFR01) | [#38](https://github.com/Kirillv2/bibliothek/issues/38) | [#39](https://github.com/Kirillv2/bibliothek/pull/39) | 02.11.2026 |
| npm-Sicherheitslücke (config-request) | [#40](https://github.com/Kirillv2/bibliothek/issues/40) | [#41](https://github.com/Kirillv2/bibliothek/pull/41) | 02.11.2026 |
| Eingebauter Zeitgeber für die täglichen Jobs (F-08) | [#42](https://github.com/Kirillv2/bibliothek/issues/42) | [#43](https://github.com/Kirillv2/bibliothek/pull/43) | 02.11.2026 |
| README mit Schnellstart | – | [#44](https://github.com/Kirillv2/bibliothek/pull/44) | 02.11.2026 |

Offen: config-request [#30](https://github.com/Kirillv2/bibliothek/issues/30) (täglicher Aufruf per GitHub Actions, braucht eine gehostete Instanz; durch den Zeitgeber aus #43 nicht mehr nötig für den lokalen Betrieb).

Abgleich mit der Spezifikation am 02.11.2026: jede FR von E01 bis E07 hat Tests (`npm run fr-abdeckung`), alle Testarten grün, [CI-Lauf auf `main`](https://github.com/Kirillv2/bibliothek/actions/runs/41449875172).

## 3. Beiträge je Person

| Person | Rolle | Was (laut Zeiterfassung und GitHub) |
|---|---|---|
| Kirill | steuert die Agenten, setzt Gate-Labels | Woche 2 gestartet, Design-Wunsch abgestimmt, Gate-Labels an #24 bis #29 und #42, Entscheidung für den eingebauten Zeitgeber |
| Jegor | Reviewer, Code Owner | Gate 3: #31 bis #37, #39, #41, #43 geprüft, freigegeben und gemergt |
| Tom, Mohammad | Team | Abstimmungen mit Kirill (Stunden als Schätzung „gleiche Dauer wie Kirill“) |
| Claude (Agenten) | alle fünf Rollen | Planning, Tests, Umsetzung F-08 bis F-13, Design, Zeitgeber, README |

**Stunden bisher** (berechnet aus [`zeiterfassung.csv` @ 4c64e37](https://github.com/DenisA1103/evaluation/blob/4c64e37cf5e397ced4d084669180b2f0bfbf4a1c/data/team-1/zeiterfassung.csv), Einträge 30.10. bis 02.11.2026):

| Claude | Kirill | Jegor | Tom | Mohammad |
|---:|---:|---:|---:|---:|
| 2,5 h | 1,25 h | 1,75 h | 1,25 h | 1,25 h |

**Commits auf `main` bisher** (nach Commit-Datum ab 30.10.2026 12:00, Stand `caff5a2`): ohne Merges Claude 23. Merges: Claude 10 (Branch-Aktualisierungen), Jegor55 9, Kirillv2 2.

```bash
git shortlog -sn --no-merges --since="2026-10-30T12:00:00+01:00" --until="2026-11-06T12:00:00+01:00" origin/main
git shortlog -sn --merges    --since="2026-10-30T12:00:00+01:00" --until="2026-11-06T12:00:00+01:00" origin/main
```

## 4. Messung

Die se-eval-Messung `p1-s2` macht Denis nach dem Stichtag 06.11.2026 12:00. Link folgt: `results/team-1/p1-s2/` im Evaluations-Repo.

## 5. Entscheidungen und Probleme

- F-11 bis F-13 und der Design-Durchgang wurden in Woche 2 vorgezogen, weil die Planning für F-08 bis F-13 in einem Durchgang lief.
- Die PRs #31 bis #39 waren gestapelt und mussten in fester Reihenfolge gemergt werden; nach jedem Merge verfallen Freigaben.
- Ohne gehostete Instanz gab es keinen täglichen Auslöser für die Fristprüfung. Lösung: eingebauter Zeitgeber ([ADR 007](../adr/007-system-jobs.md), Punkt 7).
- minimatch-Lücke in ESLint bleibt bewusst offen (nur Entwickler-Werkzeug, kein Fix verfügbar), siehe #41.
- Annahmen zu Lücken der Spezifikation: [ADR 009](../adr/009-entscheidungen-zu-luecken-der-spezifikation.md).

## 6. Ausblick

Bis zum Stichtag 06.11.: Zeiterfassung vollständig. Woche 3 (Code-Freeze 13.11.): keine Features mehr offen; Browser-Check Firefox/Safari (NFR05), UX-Tests nach dem Code-Freeze laut Evaluations-Repo.
