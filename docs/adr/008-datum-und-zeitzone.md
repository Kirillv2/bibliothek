# ADR 008: Fälligkeit als Kalenderdatum in Europe/Berlin

- Status: Vorgeschlagen (Gate 1)
- Bezug: E01-US02-FR01 (Anzeige TT.MM.JJJJ), E03-US01-FR01, E03-US02-FR03, E04-US01-FR01 … FR03, E04-US02-FR02

## Kontext

Die Spezifikation rechnet in Tagen (Leihfrist, Vorlauf, überschrittene Tage) und zeigt die Fälligkeit als TT.MM.JJJJ. Mit Uhrzeiten und UTC-Zeitstempeln entstehen Fehler um Mitternacht und bei der Zeitumstellung.

## Entscheidung (Vorschlag)

1. `startDate`, `dueDate` und Stichtage sind **Kalenderdaten ohne Uhrzeit** (`DATE` in der DB, eigener Typ `Datum` im Code, Format `JJJJ-MM-TT`).
2. „Heute“ ist das Datum in der Zeitzone `Europe/Berlin` und kommt immer aus der injizierten Uhr (`Clock`, ADR 004).
3. Zeitpunkte (z. B. `returnedAt`, `createdAt`, Zeitpunkt einer Vormerkung für die Warteschlange) sind Zeitstempel mit Zeitzone (`timestamptz`).
4. Ein Ausleihvorgang ist **überfällig**, wenn er offen ist und `heute > dueDate`. Am Tag der Fälligkeit ist er noch nicht überfällig.
5. Anzeige in der Oberfläche als `TT.MM.JJJJ`.

## Begründung

- Tagesrechnung ohne Uhrzeit ist eindeutig und mit fester Uhr leicht testbar.

## Alternativen

- **Alles als UTC-Zeitstempel:** ein Ausleihvorgang um 23:30 hätte je nach Zeitzone eine andere Fälligkeit.

## Offene Fragen

- OF-Z1: Zählen Wochenenden und Feiertage normal mit? Die Spezifikation sagt nichts dazu. Vorschlag: ja, reine Kalendertage. Entscheidung an Gate 1.
- OF-Z2: Regel 4 (überfällig erst ab dem Tag nach der Fälligkeit) ist eine Auslegung von „Frist überschritten“. Bestätigung an Gate 1.
