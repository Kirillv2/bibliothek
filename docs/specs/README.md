# Specs je Feature

Ein Feature F-xx entspricht genau einer User Story Enn-USnn (`CLAUDE.md`). Die Zuordnung kommt aus `features.csv` des Teams; Status und Termine stehen in den GitHub-Issues (Label `F-xx`, Milestone der Woche), nicht hier.

| Feature | User Story | Spec | Woche |
|---|---|---|---|
| F-01 | E01-US01 Katalog durchsuchen, filtern und sortieren | [F-01_E01-US01.md](F-01_E01-US01.md) | 1 |
| F-02 | E01-US02 Detailseite eines Titels mit Exemplarstatus | [F-02_E01-US02.md](F-02_E01-US02.md) | 1 |
| F-03 | E02-US01 Titel anlegen, bearbeiten und archivieren | [F-03_E02-US01.md](F-03_E02-US01.md) | 1 |
| F-04 | E02-US02 Exemplare mit Inventarnummer und Zustand verwalten | [F-04_E02-US02.md](F-04_E02-US02.md) | 1 |
| F-05 | E03-US01 Verfügbares Exemplar ausleihen | [F-05_E03-US01.md](F-05_E03-US01.md) | 1 |
| F-06 | E03-US02 Eigene Ausleihen einsehen und verlängern | [F-06_E03-US02.md](F-06_E03-US02.md) | 1 |
| F-07 | E03-US03 Rückgabe erfassen | [F-07_E03-US03.md](F-07_E03-US03.md) | 1 |
| F-08 | E04-US01 Fällige und überfällige Ausleihen automatisch erkennen | folgt vor Woche 2 | 2 |
| F-09 | E04-US02 Mahnungen und Gebühren verwalten | folgt vor Woche 2 | 2 |
| F-10 | E05-US01 Titel vormerken (Warteschlange) | folgt vor Woche 2 | 2 |
| F-11 | E06-US01 Registrierung und Anmeldung | folgt vor Woche 3 | 3 |
| F-12 | E06-US02 Rollen und Systemparameter konfigurieren | folgt vor Woche 3 | 3 |
| F-13 | E07-US01 Dashboard mit Kennzahlen und Bestandsexport | folgt vor Woche 3 | 3 |

## Grundlagen für alle Features (Woche 0)

| Dokument | Inhalt |
|---|---|
| [Datenmodell](../architektur/datenmodell.md) | Entitäten aller Epics, abgeleitete Werte, Entscheidungen OF-D* |
| [Schnittstellen Woche 1](../architektur/schnittstellen.md) | Lese-Funktionen, Server Actions, Fehlercodes |
| [System-Jobs](../architektur/system-jobs.md) | Konzept für die Rolle „System“ (ab Woche 2) |
| [Rechte-Matrix](../security/rechte-matrix.md) | was jede der fünf Rollen darf, Pflicht-Rechte-Tests, Entscheidungen OF-R* |
| [Security-Architektur](../security/security-architektur.md) | Auth, Autorisierung, Jobs, Bedrohungen |
| [ADR 001](../adr/001-fachbegriffe-code-namen.md) … [ADR 008](../adr/008-datum-und-zeitzone.md) | Architekturentscheidungen |
| [ADR 009](../adr/009-entscheidungen-zu-luecken-der-spezifikation.md) | Entscheidungen zu allen Lücken der Spezifikation, mit Zitat und Kennzeichnung „Abgeleitet“ / „Annahme“ |

## Was an Gate 1 geprüft werden soll

1. **Vollständigkeit:** Jede FR-ID der User Story hat einen Abschnitt mit Akzeptanzkriterien, keine FR fehlt, keine Anforderung ist hinzugekommen.
2. **Querverweise:** Verweise der Spezifikation (z. B. E03-US03-FR03 → E05-US01) sind als eigene Akzeptanzkriterien drin.
3. **Entscheidungen (ADR 009):** Alle Lücken der Spezifikation sind entschieden. „Abgeleitet“ heißt: folgt aus dem zitierten Text. „Annahme“ heißt: die Spezifikation schweigt; diese Punkte im Zweifel beim Prof nachfragen (Liste am Ende von ADR 009). Wer anders entscheiden will, schreibt einen Kommentar ins Issue bzw. in den PR.
4. **ADRs 001–009:** prüfen. Für ADR 002 gibt es einen `config-request` für die neuen Abhängigkeiten.
5. **Rechte-Matrix:** stimmt die Zuordnung für alle fünf Rollen?

Nach der Freigabe setzt ein Mensch am Issue das Label `gate-1-ok`. Erst dann schreibt der Testing-Agent die Tests (Gate 2).
