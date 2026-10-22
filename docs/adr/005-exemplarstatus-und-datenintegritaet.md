# ADR 005: Exemplarstatus wird abgeleitet, Ausleihe in einer Transaktion

- Status: Vorgeschlagen (Gate 1)
- Bezug: E01-US01-FR03, E01-US02-FR01, E02-US02-FR02, E02-US02-FR03, E03-US01-FR01, E03-US01-FR04, E03-US03-FR03, NFR06

## Kontext

Die Spezifikation verlangt:

- „Die Anzahl verfügbarer Exemplare … ergibt sich automatisch aus den Exemplaren, die weder ausgeliehen, vorgemerkt noch gesperrt sind.“ (E02-US02-FR03)
- Statusanzeige je Exemplar: verfügbar / ausgeliehen bis TT.MM.JJJJ / vorgemerkt (E01-US02-FR01).
- Nach einer Ausleihe sinkt die Zahl verfügbarer Exemplare um eins (E03-US01-FR04).
- Ein Exemplar ist nie in zwei offenen Ausleihvorgängen (NFR06).

Wird der Status zusätzlich als Spalte gespeichert, kann er von den Ausleihvorgängen abweichen.

## Entscheidung (Vorschlag)

1. **Kein gespeicherter Status.** Der Status eines Exemplars wird aus den Daten abgeleitet, in dieser Reihenfolge:
   1. `AUSGELIEHEN` – es gibt einen Ausleihvorgang mit `returnedAt = null` (Anzeige mit dessen `dueDate`)
   2. `VORGEMERKT` – eine Vormerkung im Status `ABHOLBEREIT` ist diesem Exemplar zugeordnet (E03-US03-FR03, ab F-10)
   3. `GESPERRT` – der Zustand macht das Exemplar nicht ausleihbar (mindestens `VERLOREN`, E02-US02-FR02; weitere siehe offene Frage OF-D2 im Datenmodell)
   4. `VERFUEGBAR` – sonst
2. Die Ableitung ist eine reine Funktion in `src/lib/` (`leiteExemplarstatusAb`), die Anzahl verfügbarer Exemplare zählt `VERFUEGBAR`. Für die Katalogsuche (NFR02) wird dieselbe Regel als SQL-Abfrage umgesetzt; ein Integrationstest prüft, dass beide gleich zählen.
3. **Ausleihe in einer Transaktion:** Exemplar auswählen, Limit und Mahnung prüfen, Ausleihvorgang anlegen. Der partielle eindeutige Index aus ADR 002 verhindert doppelte offene Ausleihvorgänge auch bei gleichzeitigen Anfragen. Schlägt das Einfügen wegen des Index fehl, wird das nächste verfügbare Exemplar versucht; gibt es keins mehr, lautet das Ergebnis `KEIN_EXEMPLAR_VERFUEGBAR`.
4. Rückgabe und Zuordnung an eine Vormerkung (E03-US03-FR03) laufen ebenfalls in einer Transaktion.

## Begründung

- Eine Quelle der Wahrheit: Der Status kann nicht „vergessen“ werden.
- NFR06 hängt nicht an der Sorgfalt des App-Codes, sondern am Index.

## Alternativen

- **Statusspalte am Exemplar, per Code gepflegt:** schnelle Abfragen, aber Gefahr von Abweichungen; nur sinnvoll, falls NFR02 sonst nicht erreichbar ist (dann als Cache, nie als Quelle).
- **Zähler „verfügbar“ am Titel:** gleiche Probleme, zusätzlich Wettlauf bei gleichzeitigen Ausleihen.

## Folgen

- Testing prüft NFR06 mit parallelen Ausleihanfragen auf das letzte verfügbare Exemplar (Integrationstest).
- Archivierte Titel: siehe offene Frage OF-D4 im Datenmodell.
