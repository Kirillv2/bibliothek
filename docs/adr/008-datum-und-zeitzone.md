# ADR 008: Fälligkeit als Kalenderdatum in Europe/Berlin

- Status: Entschieden (Agenten im Auftrag von KiKo); Freigabe an Gate 1
- Bezug: E01-US02-FR01 (Anzeige TT.MM.JJJJ), E03-US01-FR01, E03-US02-FR03, E04-US01-FR01 … FR03, E04-US02-FR02

## Kontext

Die Spezifikation rechnet in Tagen (Leihfrist, Vorlauf, überschrittene Tage) und zeigt die Fälligkeit als TT.MM.JJJJ. Mit Uhrzeiten und UTC-Zeitstempeln entstehen Fehler um Mitternacht und bei der Zeitumstellung.

## Entscheidung

1. `startDate`, `dueDate` und Stichtage sind **Kalenderdaten ohne Uhrzeit** (`DATE` in der DB, eigener Typ `Datum` im Code, Format `JJJJ-MM-TT`).
2. „Heute“ ist das Datum in der Zeitzone `Europe/Berlin` und kommt immer aus der injizierten Uhr (`Clock`, ADR 004).
3. Zeitpunkte (z. B. `returnedAt`, `createdAt`, Zeitpunkt einer Vormerkung für die Warteschlange) sind Zeitstempel mit Zeitzone (`timestamptz`).
4. Ein Ausleihvorgang ist **überfällig**, wenn er offen ist und `heute > dueDate`. Am Tag der Fälligkeit ist er noch nicht überfällig.
5. Anzeige in der Oberfläche als `TT.MM.JJJJ`.

## Begründung

- Tagesrechnung ohne Uhrzeit ist eindeutig und mit fester Uhr leicht testbar.

## Alternativen

- **Alles als UTC-Zeitstempel:** ein Ausleihvorgang um 23:30 hätte je nach Zeitzone eine andere Fälligkeit.

## Entscheidungen (ADR 009)

- OF-Z1: Reine Kalendertage, Wochenenden und Feiertage zählen normal mit. Annahme (die Spezifikation rechnet nur in „Tagen“).
- OF-Z2: Überfällig ab dem Tag nach der Fälligkeit (Regel 4). Abgeleitet aus Glossar 1.4: Fälligkeit ist das „Datum, bis zu dem ein Exemplar zurückgegeben werden muss“.
