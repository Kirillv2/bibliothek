# Wöchentliche Progress Reports – Team 1 (agentisch)

Die Kursbeschreibung verlangt je Team „wöchentliche Progress Reports als laufende Datengrundlage“. Der individuelle Abschlussbericht belegt den eigenen Beitrag mit „Git-Authorship und Progress-Report-Daten“. Diese Reports sind diese Datengrundlage für Team 1.

| Woche | Zeitraum (Stichtag Freitag 12:00) | Sprint | Report |
|---|---|---|---|
| Einrichtung | 16.10. bis 23.10.2026 | – (wird nicht gemessen) | [woche-0-einrichtung.md](woche-0-einrichtung.md) |
| 1 | 23.10. bis 30.10.2026 | `p1-s1` | [woche-1-p1-s1.md](woche-1-p1-s1.md) |
| 2 | 30.10. bis 06.11.2026 | `p1-s2` | [woche-2-p1-s2.md](woche-2-p1-s2.md) |
| 3 | 06.11. bis 13.11.2026 (Code-Freeze) | `p1-s3` | folgt nach dem Stichtag |

## Aufbau jedes Reports

1. Ziel der Woche (Features laut `data/features.csv` im Evaluations-Repo)
2. Ergebnis: gemergte PRs, geschlossene Issues, Abnahme
3. Beiträge je Person: Rolle, Tätigkeiten, Stunden, Commits
4. Messung (se-eval) und CI
5. Entscheidungen, Probleme, Annahmen
6. Ausblick

## Quellen

Zahlen stehen hier nie aus dem Gedächtnis. Jede Zahl ist aus einer dieser Quellen berechnet und mit Stand verlinkt:

| Was | Quelle |
|---|---|
| Stunden je Person | [`data/team-1/zeiterfassung.csv`](https://github.com/DenisA1103/evaluation/blob/main/data/team-1/zeiterfassung.csv) im Evaluations-Repo, Einzelheiten zu Claude in `agentenzeit.csv` |
| Commits je Person | `git shortlog` auf `main` dieses Repos (Befehl im Report) |
| Features, Gates | Issues und PRs in diesem Repo |
| Abnahme | [`data/team-1/abnahme.csv`](https://github.com/DenisA1103/evaluation/blob/main/data/team-1/abnahme.csv) (Denis) |
| Messung | [`results/bericht.md`](https://github.com/DenisA1103/evaluation/blob/main/results/bericht.md) und `results/team-1/<sprint>/` (se-eval) |

Stunden von Tom und Mohammad sind in der Zeiterfassung als „Schätzung, gleiche Dauer wie Kirill“ markiert. Die Agentenzeit (Person `Claude`) ist aus Nachrichten- und Commit-Zeitstempeln geschätzt.

## Fortschreiben

Nach jedem Stichtag (Freitag 12:00) und nach der Messung von Denis: neuen Report anlegen, Stunden und Commits für das Sprint-Fenster neu berechnen, Links auf den Stand der Messung setzen. Ein Report mit „Zwischenstand“ im Titel wird nach dem Stichtag abgeschlossen.
