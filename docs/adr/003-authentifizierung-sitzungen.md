# ADR 003: Authentifizierung mit eigener Sitzung, Seed-Nutzer in Woche 1

- Status: Entschieden (Agenten im Auftrag von KiKo); Freigabe an Gate 1
- Bezug: E06-US01-FR01, E06-US01-FR02, NFR03, F-05 … F-07 (Woche 1), F-11 (Woche 3)

## Kontext

Ausleihen (E03) und Vormerken (E05) setzen eine aktive Anmeldung voraus (E06-US01-FR02). Registrierung und Anmeldung sind aber erst in Woche 3 dran (F-11). Woche 1 braucht trotzdem angemeldete Mitglieder und Bibliothekare.

Die Spezifikation verlangt: Anmeldung über E-Mail und Passwort, Passwörter nur als Hash (E06-US01-FR01, NFR03).

## Entscheidung

1. **Eine Auth-Schnittstelle ab Woche 1** unter `src/server/auth/`:
   - `getSession()` liefert den angemeldeten Nutzer (`id`, `role`) oder `null`.
   - `requireRole(...roles)` bricht mit `NICHT_ANGEMELDET` bzw. `KEINE_BERECHTIGUNG` ab.
   - Jede geschützte Seite, Server Action und Route prüft das **auf dem Server**.
2. **Anmeldung mit E-Mail und Passwort ab Woche 1**, aber nur für Seed-Nutzer (je ein Konto pro Rolle, nur in Entwicklung und Tests). Die Registrierung (neues Konto anlegen) folgt in F-11.
3. **Passwort-Hash** mit `scrypt` aus `node:crypto` (eingebaut, keine Abhängigkeit), zufälliges Salt je Passwort, Vergleich mit `timingSafeEqual`.
4. **Sitzung** als Datensatz in `sessions`:
   - Zufälliges Token (32 Byte), im Cookie nur das Token, in der Datenbank nur dessen SHA-256-Hash.
   - Cookie: `HttpOnly`, `Secure` (außer lokal), `SameSite=Lax`, `Path=/`.
   - Abmelden löscht den Datensatz. Die Laufzeit einer Sitzung ist ein technischer Wert der Konfigurationsrolle.
5. **Seed-Nutzer** werden nur von einem Seed-Skript für Entwicklung und Tests angelegt. In der gehosteten Instanz gibt es sie nicht. Ihre Passwörter stehen nicht im Repo, sondern werden beim Seeding erzeugt oder kommen aus der Umgebung.

## Begründung

- Woche 1 kann echte geschützte Abläufe bauen und testen. F-11 ergänzt nur die Registrierung, die Schnittstelle bleibt gleich.
- Keine fremde Auth-Bibliothek nötig, damit keine `config-request` für Auth.
- Token nur gehasht gespeichert: Ein Datenbank-Leak gibt keine gültigen Sitzungen preis.

## Alternativen

| Alternative | Warum nicht |
|---|---|
| Auth.js / NextAuth | viel Funktion, die wir nicht brauchen (OAuth); E-Mail+Passwort ist dort umständlich; neue Abhängigkeit |
| JWT im Cookie ohne DB | Abmelden und Sperren schwer umsetzbar |
| In Woche 1 ganz ohne Login (Nutzer per Parameter) | Rechte-Tests wären wertlos, Umbau in Woche 3 nötig |
| bcrypt / argon2 | gute Verfahren, aber neue native Abhängigkeit; `scrypt` ist gleichwertig für unsere Zwecke |

## Folgen

- Security-Tests (`tests/security/`) können ab Woche 1 alle Rollen prüfen.
- Kostenparameter von `scrypt` und Sitzungsdauer sind technische Konfiguration (Konfigurationsrolle).
- Details: `docs/security/security-architektur.md`.
