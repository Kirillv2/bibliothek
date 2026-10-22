# ADR 002: Persistenz mit PostgreSQL und Drizzle ORM

- Status: Entschieden (Agenten im Auftrag von KiKo); Freigabe an Gate 1
- Bezug: NFR05 (gehostet oder lokal startbar), NFR06 (Datenintegrität), NFR04 (Idempotenz), `CLAUDE.md` „`npm ci` ohne `.env`“

## Kontext

Die App braucht eine Datenbank für Titel, Exemplare, Ausleihvorgänge, Mahnungen, Vormerkungen, Nutzer und Einstellungen. Anforderungen an die Wahl:

1. **NFR06:** Ein Exemplar darf nie in zwei offenen Ausleihvorgängen stehen. Das soll die Datenbank selbst garantieren (Constraint), nicht nur der App-Code.
2. **NFR05:** gehostete Instanz **und** lokal startbar.
3. Tests (Unit, Integration, Security) müssen in CI und lokal ohne extra Server und ohne `.env` laufen.
4. Zeitgesteuerte Jobs (Woche 2) müssen idempotent sein (NFR04), am einfachsten über eindeutige Schlüssel.

Im Moment enthält `package.json` noch keine Datenbank-Abhängigkeit.

## Entscheidung

- **Datenbank:** PostgreSQL.
- **Zugriff:** Drizzle ORM (typsicheres Schema in TypeScript, SQL-nahe Abfragen, Migrationen mit `drizzle-kit`).
- **Lokal und in Tests:** PGlite (PostgreSQL als WebAssembly im Node-Prozess). Kein Docker, kein DB-Server, keine `.env` nötig. Jede Testdatei bekommt eine frische In-Memory-Datenbank.
- **Gehostet:** ein verwalteter PostgreSQL-Dienst. Die Verbindung kommt nur aus einer Umgebungsvariable (`DATABASE_URL`), die die Konfigurationsrolle als Secret pflegt. Ist sie nicht gesetzt, startet die App lokal mit PGlite (Datei unter `.data/`).
- **NFR06** wird über einen partiellen eindeutigen Index umgesetzt:
  `CREATE UNIQUE INDEX loans_one_open_per_copy ON loans (copy_id) WHERE returned_at IS NULL;`
  Dazu läuft jede Ausleihe in einer Transaktion (siehe ADR 005).

## Begründung

- Partielle eindeutige Indizes gibt es in PostgreSQL (und PGlite) direkt. NFR06 hält damit auch bei gleichzeitigen Anfragen.
- Gleiche Datenbank-Engine in Tests und Betrieb, also keine Überraschungen durch SQL-Dialekte.
- Drizzle braucht keinen eigenen Code-Generator-Schritt mit Binärdateien und passt zu `npm ci` ohne `.env`.

## Alternativen

| Alternative | Warum nicht |
|---|---|
| SQLite (z. B. `better-sqlite3`) | lokal sehr einfach, aber viele Hoster haben kein dauerhaftes Dateisystem; zweiter Dialekt für den Betrieb nötig |
| Prisma | verbreitet, aber Client-Generierung und Engine-Binärdateien erschweren `npm ci` ohne `.env` und das Arbeiten mit PGlite |
| PostgreSQL per Docker in CI | braucht Änderungen an `.github/workflows` und Docker lokal; PGlite reicht für Tests |
| Nur In-Memory-Daten | erfüllt NFR06 und den Betrieb nicht |

## Folgen

- **Konfigurationsrolle:** Die Abhängigkeiten (`drizzle-orm`, `drizzle-kit`, `@electric-sql/pglite`, ein PostgreSQL-Treiber für den Betrieb) müssen in `package.json` aufgenommen werden. Das beantragt Planning als Issue mit Label `config-request`. Agenten ändern `package.json` nicht selbst.
- Schema und Migrationen liegen im Code (`src/server/db/`), das fachliche Modell beschreibt `docs/architektur/datenmodell.md`.
- Der gehostete Dienst (Anbieter) wird erst zum ersten Deploy gebraucht und ist Sache der Konfigurationsrolle; für Entwicklung und Tests reicht PGlite.
