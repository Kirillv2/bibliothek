# Progress Report Woche 1 (Sprint p1-s1, 23.10. bis 30.10.2026) – Team 1 (agentisch)

Stand: abgeschlossen. Stichtag Freitag 30.10.2026 12:00, gemessener Snapshot `4e152c3` (24.10.2026).

## 1. Ziel der Woche

E01 bis E03, Features F-01 bis F-07 (Liste und Größen: [`data/features.csv`](https://github.com/DenisA1103/evaluation/blob/4c64e37cf5e397ced4d084669180b2f0bfbf4a1c/data/features.csv)).

## 2. Ergebnis

| Feature | Issue | PR | gemergt |
|---|---|---|---|
| F-01 E01-US01 Katalog durchsuchen | [#2](https://github.com/Kirillv2/bibliothek/issues/2) | [#13](https://github.com/Kirillv2/bibliothek/pull/13) | 23.10.2026 |
| F-02 E01-US02 Detailseite | [#3](https://github.com/Kirillv2/bibliothek/issues/3) | [#14](https://github.com/Kirillv2/bibliothek/pull/14) | 23.10.2026 |
| F-03 E02-US01 Titel pflegen | [#4](https://github.com/Kirillv2/bibliothek/issues/4) | [#15](https://github.com/Kirillv2/bibliothek/pull/15) | 23.10.2026 |
| F-04 E02-US02 Exemplare | [#5](https://github.com/Kirillv2/bibliothek/issues/5) | [#16](https://github.com/Kirillv2/bibliothek/pull/16) | 24.10.2026 |
| F-05 E03-US01 Ausleihen | [#6](https://github.com/Kirillv2/bibliothek/issues/6) | [#17](https://github.com/Kirillv2/bibliothek/pull/17) | 24.10.2026 |
| F-06 E03-US02 Ausleihen einsehen, verlängern | [#7](https://github.com/Kirillv2/bibliothek/issues/7) | [#18](https://github.com/Kirillv2/bibliothek/pull/18) | 24.10.2026 |
| F-07 E03-US03 Rückgabe | [#8](https://github.com/Kirillv2/bibliothek/issues/8) | [#19](https://github.com/Kirillv2/bibliothek/pull/19) | 24.10.2026 |

Außerdem: Entscheidungen zu Mahngebühr und Vormerkungen vorab für F-09/F-10 ([#21](https://github.com/Kirillv2/bibliothek/pull/21)), Sitzungsdauer als Konfigurationswert ([#20](https://github.com/Kirillv2/bibliothek/issues/20), [#22](https://github.com/Kirillv2/bibliothek/pull/22)). PR [#23](https://github.com/Kirillv2/bibliothek/pull/23) (Frage an den Prof) wurde ohne Merge geschlossen, weil das Team keine Fragenliste für den Prof wollte.

**Abnahme** durch Denis am 30.10.2026 gegen die FRs: alle Checks von F-01 bis F-07 bestanden, mit Notizen je Feature in [`abnahme.csv`](https://github.com/DenisA1103/evaluation/blob/4c64e37cf5e397ced4d084669180b2f0bfbf4a1c/data/team-1/abnahme.csv).

## 3. Beiträge je Person

| Person | Rolle | Was (laut Zeiterfassung und GitHub) |
|---|---|---|
| Kirill | steuert die Agenten, setzt Gate-Labels | Gate 2 (Testreview, `gate-2-ok` an F-01 bis F-07), Gate 3 organisiert, config-request #20 beauftragt |
| Jegor | Reviewer, Code Owner | Gate 3: PRs geprüft, freigegeben und gemergt |
| Tom, Mohammad | Team | Testreview Gate 2 und Freigaben Gate 3 mit abgestimmt (Stunden als Schätzung „gleiche Dauer wie Kirill“) |
| Claude (Agenten) | Development, Testing, Review & Security | Umsetzung F-01 bis F-07, Korrekturen aus dem Review (Befunde R-01, R-07), #22 |

**Stunden** (berechnet aus [`zeiterfassung.csv` @ 4c64e37](https://github.com/DenisA1103/evaluation/blob/4c64e37cf5e397ced4d084669180b2f0bfbf4a1c/data/team-1/zeiterfassung.csv), Einträge 23.10. bis 29.10.2026):

| Claude | Kirill | Jegor | Tom | Mohammad |
|---:|---:|---:|---:|---:|
| 4,0 h | 2,0 h | 1,75 h | 2,0 h | 2,0 h |

**Commits auf `main`** (nach Commit-Datum im Sprint-Fenster): ohne Merges Claude 20. Merges: Claude 18 (Branch-Aktualisierungen), Kirillv2 9, Jegor55 7.

```bash
git shortlog -sn --no-merges --since="2026-10-23T12:00:00+02:00" --until="2026-10-30T12:00:00+01:00" origin/main
git shortlog -sn --merges    --since="2026-10-23T12:00:00+02:00" --until="2026-10-30T12:00:00+01:00" origin/main
```

## 4. Messung

se-eval-Messung `p1-s1` vom 30.10.2026: [`results/bericht.md`](https://github.com/DenisA1103/evaluation/blob/4c64e37cf5e397ced4d084669180b2f0bfbf4a1c/results/bericht.md), Rohdaten unter [`results/team-1/p1-s1/`](https://github.com/DenisA1103/evaluation/tree/4c64e37cf5e397ced4d084669180b2f0bfbf4a1c/results/team-1/p1-s1) (statische Analyse, Tests, Coverage, Mutation Testing, Git, Features, Aufwand).

## 5. Entscheidungen und Probleme

- Die Umsetzung von F-01 bis F-07 war am 24.10. fertig. Vom 25.10. bis 31.10. gab es keine Commits; die Woche-2-Arbeit begann am 01.11.
- Review & Security fand Befunde (R-01 Weiterleitung nach der Anmeldung, R-07 Mahngebühr nach verspäteter Verlängerung); beide vor dem Merge behoben.
- Sitzungsdauer war zuerst eine Umgebungsvariable, ist jetzt ein Konfigurationswert (config-request #20, nur Mensch darf `config/` ändern).

## 6. Ausblick

Woche 2: F-08 bis F-10 (E04, E05). Planning für F-08 bis F-13 in einem Durchgang.
