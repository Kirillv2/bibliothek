# Progress Report Woche 3 (Sprint p1-s3, 06.11. bis 13.11.2026) – Team 1 (agentisch)

Stand: abgeschlossen am 16.11.2026. Stichtag Freitag 13.11.2026 12:00 (Code-Freeze), gemessener Snapshot `34866d3` (Merge von #49, 13.11.2026).

## 1. Ziel der Woche

Laut [`data/features.csv`](https://github.com/DenisA1103/evaluation/blob/0df884948fab6666bce11ad14caa0c34512840cf/data/features.csv) E06 und E07 (F-11 bis F-13). Diese drei Features waren schon in Woche 2 umgesetzt und abgenommen (siehe [Woche 2](woche-2-p1-s2.md)). In Woche 3 ging es deshalb um Verbesserungen ohne neue Anforderungen und um die Vorbereitung der Abgabe.

## 2. Ergebnis

| Was | Issue | PR | gemergt |
|---|---|---|---|
| Verbesserungen: deutsche Fehlerseiten, Handy-Ansicht, Anmeldesperre, Sicherheits-Header, Katalog als Karten (NFR01, NFR03, NFR05) | [#47](https://github.com/Kirillv2/bibliothek/issues/47) | [#48](https://github.com/Kirillv2/bibliothek/pull/48) | 13.11.2026 |
| Feste Test-Passwörter für die Seed-Konten, Tabelle im README | – | [#49](https://github.com/Kirillv2/bibliothek/pull/49) | 13.11.2026 |

Ohne Code-Änderung: Frage zur Datenbank geprüft (12.11.: PGlite/PostgreSQL reicht für die Spezifikation, NFR05 und NFR06) und eine priorisierte Liste mit Verbesserungen erstellt, aus der Kirill die Punkte 1 bis 5 ausgewählt hat.

**Abnahme** durch Denis am 13.11.2026 im Snapshot `34866d3`: Regressionsprüfung der von #48/#49 berührten Features F-01, F-02 und F-11, alle Checks bestanden, Notizen in [`abnahme.csv`](https://github.com/DenisA1103/evaluation/blob/0df884948fab6666bce11ad14caa0c34512840cf/data/team-1/abnahme.csv). Die Anmeldesperre ist dort als „nicht gefordert“ vermerkt; sie verletzt keine FR (Annahme im PR #48).

Offen: config-request [#30](https://github.com/Kirillv2/bibliothek/issues/30) (gehostete Instanz, freiwillig, siehe NFR05 „gehostet oder lokal startbar“) und der manuelle Browser-Check in Firefox/Safari (NFR05).

## 3. Beiträge je Person

| Person | Rolle | Was (laut Zeiterfassung und GitHub) |
|---|---|---|
| Kirill | steuert die Agenten | Datenbank-Frage, Verbesserungen 1 bis 5 ausgewählt, feste Test-Passwörter beauftragt |
| Jegor | Reviewer, Code Owner | #48 und #49 geprüft, freigegeben und gemergt |
| Tom, Mohammad | Team | Abstimmungen mit Kirill (Stunden als Schätzung „gleiche Dauer wie Kirill“) |
| Claude (Agenten) | Review & Security, Testing, Development, Orchestrator | Verbesserungsliste, Umsetzung #48 und #49 mit Tests, Progress Report Woche 2 |

**Stunden** laut se-eval für das Sprint-Fenster (Einträge 06.11. bis 13.11.2026), Quelle [`results/team-1/p1-s3/effort.json`](https://github.com/DenisA1103/evaluation/blob/0df884948fab6666bce11ad14caa0c34512840cf/results/team-1/p1-s3/effort.json):

| Claude | Kirill | Jegor | Tom | Mohammad |
|---:|---:|---:|---:|---:|
| 1,25 h | 0,5 h | 0,25 h | 0,5 h | 0,5 h |

se-eval zählt nach Datum, deshalb ist auch Claudes Arbeit vom 13.11. nach dem Stichtag (Prüfung der Messung, Nachtrag der Zeiterfassung) enthalten; Einzelheiten in [`agentenzeit.csv`](https://github.com/DenisA1103/evaluation/blob/0df884948fab6666bce11ad14caa0c34512840cf/data/team-1/agentenzeit.csv).

**Commits auf `main`** (nach Commit-Datum im Sprint-Fenster, letzter Commit `34866d3`): ohne Merges Claude 6. Merges: Jegor55 2.

```bash
git shortlog -sn --no-merges --since="2026-11-06T12:00:00+01:00" --until="2026-11-13T12:00:00+01:00" origin/main
git shortlog -sn --merges    --since="2026-11-06T12:00:00+01:00" --until="2026-11-13T12:00:00+01:00" origin/main
```

## 4. Messung

se-eval-Messung `p1-s3` vom 13.11.2026 (mit Mutation Testing): [`results/bericht.md`](https://github.com/DenisA1103/evaluation/blob/0df884948fab6666bce11ad14caa0c34512840cf/results/bericht.md), Rohdaten unter [`results/team-1/p1-s3/`](https://github.com/DenisA1103/evaluation/tree/0df884948fab6666bce11ad14caa0c34512840cf/results/team-1/p1-s3). Der Bericht stellt alle drei Sprints nebeneinander.

## 5. Entscheidungen und Probleme

- Keine neuen Anforderungen: Alle Verbesserungen zahlen auf NFR01, NFR03 und NFR05 ein; Annahmen (z. B. Dauer der Anmeldesperre) stehen im PR #48.
- Feste Test-Passwörter gibt es nur im Entwicklungsmodus (`npm run dev`), nicht in einer echten Installation; als Annahme im PR #49 markiert.
- Die Zeiterfassung von Team 1 fehlte vom 02.11. bis 13.11. und wurde am 13.11. nachgetragen ([evaluation#6](https://github.com/DenisA1103/evaluation/pull/6)).

## 6. Ausblick

Projekt 1 ist mit dem Code-Freeze abgeschlossen. Als Nächstes laut Evaluations-Repo: UX-Tests nach dem Code-Freeze, Team-Evaluationsbericht, individuelle Abschlussberichte. In Projekt 2 (ab 20.11.) folgt laut Kursbeschreibung der Rollentausch der Arbeitsweisen.
