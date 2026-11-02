# Bibliothek – Bibliotheks- und Inventarverwaltung

Webbasierte Bibliotheks- und Inventarverwaltung nach der Anforderungsspezifikation von Prof. Petersen (HS Flensburg), Epics E01 bis E07. Gebaut mit Next.js und TypeScript. Die Spezifikation liegt unter [`docs/spezifikation.pdf`](docs/spezifikation.pdf), die Projektregeln stehen in [`CLAUDE.md`](CLAUDE.md).

## Schnellstart

### 1. Was du installiert haben musst

| Programm | Wofür | Download |
|---|---|---|
| **Node.js 22 LTS** (mindestens 20.9) | führt die App aus, bringt `npm` mit | <https://nodejs.org> |
| **Git** | Repository herunterladen | <https://git-scm.com> |
| VS Code (optional) | Code ansehen und Terminal öffnen | <https://code.visualstudio.com> |

Prüfen, ob alles da ist (im Terminal, z. B. PowerShell oder das Terminal in VS Code):

```bash
node -v   # sollte v22.x anzeigen
git --version
```

Eine eigene Datenbank musst du **nicht** installieren.

### 2. Projekt holen und starten

```bash
git clone https://github.com/Kirillv2/bibliothek.git
cd bibliothek
npm ci          # installiert die Pakete genau nach package-lock.json
npm run dev     # startet die App im Entwicklungsmodus
```

Danach im Browser öffnen: **<http://localhost:3000>**

Beim ersten Aufruf dauert es ein paar Sekunden, weil die Datenbank angelegt wird. Beenden mit `Strg + C` im Terminal.

### 3. Datenbank und Beispieldaten

- Ohne weitere Einstellung legt die App beim ersten Start automatisch eine lokale Datenbank im Ordner **`.data/`** an (PGlite, läuft direkt in Node.js).
- Im Entwicklungsmodus (`npm run dev`) kommen dabei Beispieldaten hinein: drei Test-Konten und ein paar Bücher mit Exemplaren.
- Der Ordner `.data/` wird nicht mit Git hochgeladen.

### 4. Zugangsdaten (Test-Konten)

| Rolle | E-Mail |
|---|---|
| Mitglied | `mitglied@bibliothek.test` |
| Bibliothekar | `bibliothekar@bibliothek.test` |
| Administrator | `admin@bibliothek.test` |

**Passwort:** Es wird beim ersten Start **zufällig erzeugt** und gilt für alle drei Konten. Du findest es in der Datei:

```
.data/seed-zugaenge.txt
```

Wer lieber ein eigenes Passwort möchte, setzt vor dem **ersten** Start die Umgebungsvariable `SEED_PASSWORT`. Dann gilt dieses Passwort und die Datei wird nicht angelegt.

```powershell
# Windows PowerShell
$env:SEED_PASSWORT = "MeinTestPasswort"; npm run dev
```

```bash
# macOS / Linux
SEED_PASSWORT=MeinTestPasswort npm run dev
```

Neue Mitglieder können sich außerdem selbst unter <http://localhost:3000/registrieren> anmelden.

### 5. Alles zurücksetzen

App beenden, den Ordner **`.data/`** löschen und `npm run dev` neu starten. Datenbank, Beispieldaten und ein neues Passwort werden dann frisch angelegt.

### 6. Tägliche Jobs (Fristen, Mahnungen, Abholfristen)

Die App hat einen **eingebauten Zeitgeber**. Er läuft automatisch mit, sobald die App gestartet ist, und prüft regelmäßig, ob die täglichen Jobs (Fristprüfung mit Mahnungen, abgelaufene Abholfristen bei Vormerkungen) für heute schon gelaufen sind. Du musst dafür nichts tun.

Die Job-Endpunkte unter `/api/system/jobs/…` lassen sich zusätzlich von außen aufrufen, aber nur mit dem Job-Secret (Umgebungsvariable `JOB_SECRET`). Ohne gesetztes Secret sind sie gesperrt.

## Tests

| Befehl | Was er prüft |
|---|---|
| `npm test` | Unit-Tests (Vitest) |
| `npm run test:int` | Integrationstests (Vitest) |
| `npm run test:security` | Security-Tests (Vitest) |
| `npm run test:e2e` | Browser-Tests (Playwright) |
| `npm run test:coverage` | Testabdeckung |
| `npm run lint` | Code-Stil (ESLint) |
| `npm run typecheck` | Typprüfung (TypeScript) |
| `npm run fr-abdeckung` | welche FR-IDs durch Tests abgedeckt sind |

Für die Browser-Tests einmalig den Browser installieren: `npx playwright install chromium`. Die E2E-Tests bauen die App selbst und starten sie auf Port 3000. Ein laufendes `npm run dev` vorher beenden, sonst wird dieser Server mitbenutzt.

## Optional: eigene PostgreSQL-Datenbank

Statt der lokalen Datenbank in `.data/` kann die App auch eine echte PostgreSQL-Datenbank nutzen. Dazu die Umgebungsvariable `DATABASE_URL` setzen, z. B. in einer Datei `.env.local`:

```
DATABASE_URL=postgres://benutzer:passwort@localhost:5432/bibliothek
```

Die Tabellen werden beim Start automatisch angelegt. Test-Konten und Beispieldaten gibt es in diesem Fall **nicht**, die gibt es nur mit der lokalen Datenbank im Entwicklungsmodus.

## Umgebungsvariablen im Überblick

Alle sind optional.

| Variable | Wirkung |
|---|---|
| `SEED_PASSWORT` | festes Passwort für die Test-Konten (nur beim ersten Start) |
| `DATABASE_URL` | PostgreSQL statt lokaler Datenbank in `.data/` |
| `JOB_SECRET` | schaltet die Job-Endpunkte für Aufrufe von außen frei |

Konfigurationswerte wie Leihfrist, Ausleihlimit oder Mahn-Tagessatz stehen in [`config/system.defaults.json`](config/system.defaults.json) und lassen sich als Administrator in der App ändern.
