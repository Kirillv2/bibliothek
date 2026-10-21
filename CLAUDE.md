# CLAUDE.md – Bibliotheks- und Inventarverwaltung (agentisch)

> Gehört der Konfigurationsrolle. Agenten lesen diese Datei, ändern sie aber nie.
> Änderungen nur über einen `config/…`-Branch mit Approval laut CODEOWNERS.

## Projekt

Webbasierte Bibliotheks- und Inventarverwaltung nach der Anforderungsspezifikation (HS Flensburg, Kai Petersen, v1.0), Epics E01–E07, NFR01–NFR06. Die Spezifikation liegt unter `docs/spezifikation.pdf` und ist die einzige Quelle für Anforderungen. Kein Agent erfindet, streicht oder ändert Anforderungen.

| Woche | Epics | Features |
|---|---|---|
| 1 | E01 Katalog & Suche, E02 Bestand & Exemplare, E03 Ausleihe & Rückgabe | F-01 … F-07 |
| 2 | E04 Fristen & Mahnwesen, E05 Vormerkungen | F-08 … F-10 |
| 3 | E06 Benutzer & Rechte, E07 Berichte & Dashboard | F-11 … F-13 |

Ein Feature F-xx entspricht genau einer User Story Enn-USnn. Zuordnung: `docs/features.md`.

## Stack und Befehle

- Next.js mit TypeScript (strict), `package-lock.json` im Repo, `npm ci` ohne `.env`
- Vitest für Unit- und Integrationstests, Playwright für E2E
- `npm run lint` · `npx tsc --noEmit` · `npm test` · `npm run test:int` · `npm run test:e2e` · `npm run test:security`

## Fachbegriffe (Glossar 1.4 der Spezifikation)

Immer diese Begriffe verwenden, keine Synonyme. Die Code-Namen legt ADR 001 fest.

| Begriff | Bedeutung | Code-Name (Vorschlag, ADR 001) |
|---|---|---|
| Titel | katalogisiertes Werk (z. B. Buch mit ISBN) | `Title` |
| Exemplar | physisches Stück eines Titels mit eindeutiger Inventarnummer | `Copy` |
| Ausleihvorgang | befristete Zuordnung Exemplar ↔ Mitglied | `Loan` |
| Fälligkeit / Frist | Datum, bis zu dem zurückgegeben werden muss | `dueDate` |
| Mahnung | Benachrichtigung bei Fristüberschreitung, ggf. mit Gebühr | `Dunning` |
| Vormerkung | Anspruch auf ein ausgeliehenes Exemplar, Warteschlange je Titel | `Reservation` |

## Rollen der App (Spezifikation 1.3)

Gast, Mitglied, Bibliothekar, Administrator, System (Automatik). Rechte-Matrix: `docs/security/rechte-matrix.md`. Mitglieder sehen nur ihre eigenen Daten. Das System (zeitgesteuerte Jobs) ist nur mit Job-Secret aufrufbar und muss idempotent laufen (NFR04).

## Pipeline je Feature

1. Planning & Architecture → Spec → **Gate 1** (Mensch)
2. Testing schreibt Tests aus den Akzeptanzkriterien (rot) → **Gate 2** (Mensch)
3. Development setzt um, PR
4. Testing führt die komplette Suite aus; korrigiert bei Bedarf und prüft danach komplett neu. Höchstens 2 Fehlversuche, dann Mensch.
5. Review & Security prüft Code und führt Security-Checks aus
6. **Gate 3** (Mensch): Approval, Merge, Deploy

Kein Agent überspringt ein Gate, merged oder deployt. Gate-Freigaben gibt nur ein Mensch über die Labels `gate-1-ok`, `gate-2-ok`, `gate-3-ok` am Issue.

## Rückverfolgbarkeit (Spezifikation 1.5)

- Spec: `docs/specs/F-xx_Enn-USnn.md`, Akzeptanzkriterien je FR-ID
- Tests: FR-ID im Namen, z. B. `describe("E03-US01-FR03 Ausleihlimit", …)`
- Branch: `feature/F-xx-Enn-USnn-kurzname`
- Commit: `F-xx Enn-USnn-FRnn: was geändert wurde`, Agenten-Commits mit `Co-Authored-By`-Zeile
- PR-Text: „Deckt ab: …“ mit allen FR-IDs; Link auf das Issue (`Closes #…`)

## Git

- `main` ist geschützt. Nur PRs, CI grün, Approval eines Menschen, der den PR nicht selbst geöffnet hat.
- Merge-Commit, kein Squash, kein Force-Push.

## Wo Informationen hingehören (Memory)

| Was | Wo | Schreibt |
|---|---|---|
| Projektregeln | `CLAUDE.md` | nur Mensch |
| Anforderungen je Feature | `docs/specs/` | Planning |
| Architekturentscheidungen | `docs/adr/` | Planning |
| Security-Architektur, Rechte-Matrix | `docs/security/` | Planning, Review & Security |
| Testplan, Randfälle, Testdaten | `docs/testing/` | Testing |
| Status, Übergaben, Fehlversuche | Kommentare und Labels am GitHub-Issue | Orchestrator |
| Protokoll eines Agentenlaufs | Kommentar im PR | jeweiliger Agent |

Jeder Agent schreibt nur in seine eigenen Ablagen und nennt immer die Feature-ID.

## Zahlen

Keine Zahlen von Hand oder aus dem Gedächtnis in Dokumente schreiben (Testanzahl, Coverage, Befunde, Features). Immer auf die Quelle verlinken: GitHub-Actions-Lauf, PR, Issue, Code Scanning.

## Verboten für alle Agenten

- `config/`, `.github/`, `.claude/`, `CLAUDE.md`, `package.json`, `package-lock.json` ändern. Braucht ihr eine Änderung, legt ein Issue mit Label `config-request` an.
- Konfigurationswerte (Leihfrist, Ausleihlimit, Verlängerungen, Tagessatz, Vorläufe) festlegen oder hart kodieren. Sie kommen aus `config/system.defaults.json` bzw. der Admin-Einstellung.
- Secrets lesen, ausgeben oder committen.
- Tests abschwächen, überspringen (`.skip`, `.only`) oder löschen, um grün zu werden.
