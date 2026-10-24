# ADR 006: Konfigurationswerte aus `config/` und Admin-Einstellung

- Status: Entschieden (Agenten im Auftrag von KiKo); Freigabe an Gate 1
- Bezug: E03-US01-FR02, E03-US01-FR03, E03-US02-FR02, E04-US01-FR02, E04-US02-FR02, E05-US01-FR03, E06-US02-FR02, `CLAUDE.md` „Verboten für alle Agenten“

## Kontext

Leihfrist, Ausleihlimit, maximale Verlängerungen, Mahn-Tagessatz, Erinnerungsvorlauf und Abholfrist sind konfigurierbar. Kein Agent darf Werte festlegen oder hart kodieren. Die Defaults und Grenzen stehen in `config/system.defaults.json` (gehört der Konfigurationsrolle). Ab Woche 3 kann der Administrator die Werte in der App ändern (E06-US02-FR02, F-12).

## Entscheidung

1. Ein Modul `src/server/settings/` ist die **einzige** Stelle, die Konfigurationswerte liest:
   - `getSetting(name)` liefert den gültigen Wert.
   - Reihenfolge: Wert aus Tabelle `system_settings` (vom Administrator gesetzt, ab F-12), sonst `standard` aus `config/system.defaults.json`.
   - Ein gespeicherter Wert außerhalb von `min`/`max` wird ignoriert und der Standard genommen (und geloggt).
2. Die **Namen** sind die Schlüssel aus `config/system.defaults.json` (`leihfristTage`, `ausleihlimitProMitglied`, `maxVerlaengerungen`, `mahnTagessatzEuro`, `erinnerungVorlaufTage`, `abholfristVormerkungTage`).
3. Fachfunktionen in `src/lib/` bekommen Werte als Parameter, nie per Import aus `config/`.
4. Tests setzen Werte über eine Test-Hilfe (z. B. Eintrag in `system_settings` der Test-DB). Erwartungen werden aus dem gesetzten Wert berechnet, nicht als feste Zahl geschrieben, damit eine Änderung der Defaults keine Tests bricht.
5. Geldbeträge werden intern in Cent als ganze Zahl gerechnet.
6. **Technische Werte** stehen in derselben Datei und werden genauso über `getSetting` gelesen: `sitzungDauerStunden` (Laufzeit einer Anmeldung, [ADR 003](003-authentifizierung-sitzungen.md), eingeführt mit PR #22 zu #20; Annahme OF-S2 in [ADR 009](009-entscheidungen-zu-luecken-der-spezifikation.md)).

## Begründung

- Eine Stelle für alle Werte macht die Regel „nicht hart kodieren“ prüfbar (Review & Security sucht nach Zahlen in Fachlogik).
- Woche 1 funktioniert ohne Admin-Oberfläche; F-12 ergänzt nur die Tabelle und die Oberfläche.

## Alternativen

- **Werte nur aus Umgebungsvariablen:** Administrator könnte sie nicht in der App ändern (E06-US02-FR02).
- **Werte nur in der DB:** Defaults und Grenzen wären nicht mehr unter Kontrolle der Konfigurationsrolle.

## Folgen

- Fehlt ein Name in `config/system.defaults.json`, beantragt Planning ihn per `config-request`.
