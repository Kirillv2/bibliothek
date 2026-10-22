# ADR 004: Schichten und Ordnerstruktur

- Status: Vorgeschlagen (Gate 1)
- Bezug: alle Features; Evaluation (Mutation Testing unter `src/lib/`)

## Kontext

Mehrere Agenten arbeiten parallel an Features. Die Fachregeln (Fälligkeit, Gebühr, Verfügbarkeit, Warteschlange) sollen ohne Datenbank und ohne Next.js testbar sein. Die Evaluation führt Mutation Testing unter `src/lib/` aus.

## Entscheidung (Vorschlag)

Next.js App Router mit drei Schichten:

| Schicht | Ordner | Inhalt | Darf benutzen |
|---|---|---|---|
| Oberfläche | `src/app/` | Seiten (Server Components), Formulare, Route Handlers | `src/server/` |
| Anwendung | `src/server/` | Server Actions / Use Cases, Auth (`auth/`), Datenzugriff (`db/`, `repositories/`), Konfiguration (`settings/`), Jobs (`jobs/`) | `src/lib/`, Datenbank |
| Fachlogik | `src/lib/` | reine Funktionen ohne I/O: Fälligkeit berechnen, Ausleihbarkeit prüfen, Exemplarstatus ableiten, Gebühr berechnen, Warteschlange ordnen | nichts außer TypeScript |

Regeln:

- **Server Actions** für Formulare (Ausleihen, Verlängern, Rückgabe, Titel/Exemplare pflegen). **Route Handlers** nur für den CSV-Export (F-13) und die System-Jobs (F-08, F-10).
- Jede Server Action prüft zuerst Anmeldung und Rolle (ADR 003), dann Eingaben, dann ruft sie die Anwendungsschicht.
- Ergebnis einer Action: `{ ok: true, daten } | { ok: false, fehler: Fehlercode }`. Fehlercodes stehen in `docs/architektur/schnittstellen.md`.
- **Uhr injizierbar:** Funktionen, die „heute“ brauchen, bekommen ein `Clock`-Objekt (`heute(): Datum`). Tests nutzen eine feste Uhr.
- **Konfigurationswerte** liest nur `src/server/settings/` (ADR 006). Fachfunktionen bekommen die Werte als Parameter.
- Unit-Tests liegen neben dem Code (`*.test.ts`), Integrationstests als `*.int.test.ts`, Rechte-Tests unter `tests/security/`, E2E unter `e2e/` (siehe `CLAUDE.md`).

## Begründung

- Fachregeln als reine Funktionen sind schnell und vollständig testbar, auch per Mutation Testing.
- Eine klare Grenze zwischen Oberfläche und Anwendung macht die serverseitige Rechteprüfung an einer Stelle prüfbar.

## Alternativen

- **Eigene REST-API für alles:** mehr Code, doppelte Validierung, für eine Next.js-App ohne fremde Clients nicht nötig.
- **Logik direkt in Seiten/Actions:** schwer testbar, schlecht für Mutation Testing.

## Folgen

- Der Hinweis in `AGENTS.md` gilt: Development liest vor dem Programmieren die Next.js-Doku in `node_modules/next/dist/docs/`, weil sich APIs geändert haben können.
