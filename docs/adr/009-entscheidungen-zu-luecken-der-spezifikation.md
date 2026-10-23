# ADR 009: Entscheidungen zu Lücken und Unklarheiten der Spezifikation (Woche 0 und Woche 1)

- Status: Entschieden von den Agenten im Auftrag von KiKo (22.10.2026); Freigabe an Gate 1
- Bezug: alle offenen Fragen (OF-…) aus Datenmodell, Rechte-Matrix, Schnittstellen, ADR 007/008 und den Specs F-01 … F-07

## Kontext

Beim Zerlegen der Spezifikation (v1.0) sind Stellen aufgefallen, an denen der Text schweigt oder mehrdeutig ist. KiKo hat entschieden, dass die Agenten diese Fragen selbst entscheiden, und zwar so, dass das Ergebnis möglichst genau dem entspricht, was die Spezifikation von Prof. Petersen verlangt.

## Regeln für die Entscheidung

1. **Aus dem Text ableiten**, wo möglich: wörtliches Zitat oder FR-ID als Grundlage.
2. Wo die Spezifikation wirklich schweigt: die **konservativste übliche Lösung**, die keine FR verletzt und nichts Neues hinzufügt, was die Spezifikation nicht verlangt.
3. Jede Entscheidung ist markiert:
   - **Abgeleitet** – folgt aus dem Text der Spezifikation (Grundlage genannt).
   - **Annahme** – die Spezifikation sagt dazu nichts. Diese Punkte sollten im Zweifel bei Prof. Petersen nachgefragt werden. Die Liste am Ende fasst sie zusammen.
4. Die Akzeptanzkriterien in den Specs sind an diese Entscheidungen angepasst. Ändert sich eine Entscheidung, ändern sich die betroffenen Kriterien über einen neuen Gate-1-Durchlauf.

## Entscheidungen

### Datenmodell

| ID | Frage | Entscheidung | Grundlage | Art |
|---|---|---|---|---|
| OF-D1 | Erscheinungsjahr fehlt in E02-US01-FR01, ist aber Filter/Sortierung in E01-US01-FR02 | Der Titel bekommt ein **optionales** Feld Erscheinungsjahr. Ohne dieses Feld wäre E01-US01-FR02 nicht erfüllbar. Es ist kein Pflichtfeld, weil E02-US01-FR01 die Pflichtfelder abschließend nennt. | E01-US01-FR02 „nach … Erscheinungsjahr filter- und sortierbar“; E02-US01-FR01 „Pflichtfeldern Titel, Autor, Kategorie“ | Abgeleitet (dass es optional ist: Annahme) |
| OF-D2 | Was heißt „gesperrt“? | **Gesperrt = Zustand „verloren“.** „Beschädigt“ bleibt ausleihbar. Eine eigene, manuelle Sperre gibt es nicht. | E02-US02-FR02 nennt nur „verloren“ als nicht ausleihbar | Annahme |
| OF-D3 | Welche Zustände gibt es? | Genau die drei genannten: **gut, beschädigt, verloren**. Neues Exemplar startet mit „gut“, sofern der Bibliothekar nichts anderes wählt. | E02-US02-FR02 „(z. B. gut, beschädigt, verloren)“ | Annahme (Liste ist nur ein Beispiel) |
| OF-D4 | Was bedeutet „archiviert“? | „Deaktiviert“: Der Titel erscheint **nicht** im öffentlichen Katalog, seine Detailseite ist für Gast und Mitglied nicht erreichbar, er ist nicht ausleihbar und nicht vormerkbar, und es können keine Exemplare mehr angelegt werden. Bibliothekare sehen ihn weiter in der Verwaltung. Wieder aktivieren ist nicht vorgesehen. | E02-US01-FR03 „archiviert (deaktiviert)“ | Abgeleitet (Sichtbarkeit für Bibliothekare: Annahme) |
| OF-D5 | Kategorie: Freitext oder feste Liste? | **Freitext** (Pflichtfeld). Der Filter bietet die vorhandenen Kategorien der aktiven Titel an. Keine eigene Kategorienverwaltung. | E02-US01-FR01 nennt „Kategorie“ als Feld, eine Verwaltung von Kategorien fordert die Spezifikation nicht | Annahme |
| OF-D6 | Format der Inventarnummer | **Fortlaufend vom System vergeben**, Format `INV-` + sechsstellige Zahl (z. B. `INV-000042`). Nicht änderbar. | E02-US02-FR01 „wird … eine eindeutige Inventarnummer zugewiesen“ | Annahme (Format) |
| OF-D7 | Eine oder mehrere Rollen je Nutzer? | **Genau eine Rolle** je Konto: Mitglied, Bibliothekar oder Administrator. Rechte gibt es nur laut Rechte-Matrix, keine Vererbung. | E06-US02-FR01 „Rollen zuweisen (Mitglied, Bibliothekar, Administrator)“; Rollenbeschreibungen in 1.3 | Annahme |
| OF-D8 | Kanal der Benachrichtigungen | **In der App** (Liste „Benachrichtigungen“ des Nutzers). Kein E-Mail-Versand. | E04-US01-FR02, E05-US01-FR03 sagen nur „Benachrichtigung“ | Annahme |

### Rollen und Rechte

| ID | Frage | Entscheidung | Grundlage | Art |
|---|---|---|---|---|
| OF-R1 | Dürfen Bibliothekar und Administrator selbst ausleihen, verlängern, vormerken? | **Nein, nur die Rolle Mitglied.** | 1.3 „Mitglied: … die Objekte ausleihen und zurückgeben kann“; E01-US02-FR02 „einem angemeldeten Mitglied“; Stories E03-US01, E03-US02, E05-US01 „Als Mitglied“ | Abgeleitet |
| OF-R2 | Sieht ein Gast die Aktion „Vormerken“? | **Ja.** Ein Klick führt zur Anmeldung, ohne dass eine Vormerkung entsteht. „Ausleihen“ sieht ein Gast dagegen nicht. | E01-US02-FR03 bietet „Vormerken“ ohne Einschränkung an; E01-US02-FR02 nennt beim Ausleihen ausdrücklich „angemeldetes Mitglied“; E06-US01-FR02 Vormerkung nur mit Anmeldung | Abgeleitet |
| OF-R3 | Hat der Administrator die Rechte des Bibliothekars? | **Nein.** Der Administrator verwaltet Konten, Rollen und Systemparameter; Bestand, Rückgaben, Mahnungen und Dashboard sind Sache des Bibliothekars. | 1.3 trennt beide Rollen | Abgeleitet (aus 1.3), aber nachfragen |
| OF-R4 | Sieht ein Mitglied eigene Mahnungen? | In Woche 1 sagt die Ausleihe bei Sperre, dass eine offene Mahnung besteht (`OFFENE_MAHNUNG`). Eine eigene Ansicht der Mahnungen wird in der Spec F-09 entschieden. | E04-US02-FR03 Sperre durch offene Mahnung | Annahme |
| – | 1.3 sagt, ein Mitglied kann „zurückgeben“. Darf es die Rückgabe selbst buchen? | **Nein.** Das Mitglied bringt das Exemplar zurück, **erfasst** wird die Rückgabe vom Bibliothekar. | E03-US03 „Als Bibliothekar möchte ich die Rückgabe … erfassen“ | Abgeleitet |

### Datum, Schnittstellen, Jobs

| ID | Frage | Entscheidung | Grundlage | Art |
|---|---|---|---|---|
| OF-Z1 | Zählen Wochenenden und Feiertage? | **Ja, reine Kalendertage** für Leihfrist, Vorlauf, überschrittene Tage und Abholfrist. | Spezifikation rechnet nur in „Tagen“ | Annahme |
| OF-Z2 | Ab wann ist ein Vorgang überfällig? | **Ab dem Tag nach der Fälligkeit.** Am Fälligkeitstag selbst ist die Rückgabe noch fristgerecht. | Glossar 1.4: Fälligkeit = „Datum, bis zu dem ein Exemplar zurückgegeben werden muss“ | Abgeleitet |
| OF-S1 | Welcher Fehler, wenn mehrere Gründe zutreffen? | Feste Prüfreihenfolge: Anmeldung → Rolle → Titel existiert und ist aktiv → offene Mahnung → Ausleihlimit → verfügbares Exemplar. | – | Annahme (reine Technik) |
| OF-J1 | Scheduler der System-Jobs | **Geplanter GitHub-Actions-Workflow**, der täglich den geschützten Endpunkt aufruft. Unabhängig vom Hoster, Läufe sind in GitHub nachvollziehbar. Umsetzung in Woche 2 per `config-request` (`.github/` gehört der Konfigurationsrolle). | E04-US01-FR01 „zeitgesteuerter Prozess prüft täglich“ | Annahme (Technik) |
| OF-J2 | Uhrzeit des Laufs | **Einmal täglich nachts** (Vorschlag 02:00 Europe/Berlin). Wegen Stichtag und Idempotenz (ADR 007) ist eine Verspätung des Schedulers unkritisch. | E04-US01-FR01 „täglich“ | Annahme (Technik) |

### F-01 Katalog durchsuchen

| ID | Frage | Entscheidung | Grundlage | Art |
|---|---|---|---|---|
| OF-F01-1 | Teilwortsuche, Groß-/Kleinschreibung? | **Teilwortsuche ohne Beachtung von Groß-/Kleinschreibung.** Bei ISBN und Inventarnummer werden Bindestriche und Leerzeichen ignoriert. | „Freitextsuche“ (E01-US01-FR01), übliche Bedeutung | Annahme |
| OF-F01-2 | Was zeigt die Liste ohne Suchbegriff? | **Alle aktiven Titel** (mit den gewählten Filtern). | – | Annahme |
| OF-F01-3 | Standardsortierung | **Alphabetisch nach Titel, aufsteigend.** Bei Gleichstand immer nach Titel als zweitem Kriterium. | – | Annahme |
| OF-F01-4 | Größe des „Testbestands“ (NFR02) | Der Testbestand sind die **Seed-Daten der Testumgebung**, mindestens 1 000 Titel mit Exemplaren. Gemessen wird die Suchfunktion auf dem Server. Testing hält Größe und Messung in `docs/testing/F-01.md` fest. | NFR02 „bei Testbestand in unter 1 Sekunde“ | Annahme (Größe nachfragen) |
| OF-F01-5 | Archivierte Titel im Katalog? | **Nein** (siehe OF-D4). | E02-US01-FR03 „deaktiviert“ | Abgeleitet |
| OF-F01-6 | Seitenweise Anzeige? | **Ja, 20 Treffer je Seite** mit Gesamtzahl der Treffer. Damit bleibt die Antwort auch bei großem Bestand schnell (NFR02). | NFR02 | Annahme |

### F-02 Detailseite

| ID | Frage | Entscheidung | Grundlage | Art |
|---|---|---|---|---|
| OF-F02-1 | „Vormerken“ in Woche 1, obwohl die Funktion erst mit F-10 kommt | Die Aktion wird ab Woche 1 nach FR03 **angezeigt**. Bis F-10 fertig ist, ist sie deaktiviert mit dem Hinweis, dass Vormerken noch nicht möglich ist. F-10 schaltet sie frei. | E01-US02-FR03 verlangt das Anbieten; die Funktion selbst ist E05-US01 | Annahme (Planung) |
| OF-F02-2 | Anzeige eines gesperrten (verlorenen) Exemplars | Status **„nicht verfügbar“**. Das Exemplar bleibt in der Liste, damit die Liste alle Exemplare zeigt. | E01-US02-FR01 „Liste der Exemplare mit Status“ nennt drei Status, „gesperrt“ kommt aus E02-US02-FR03 | Annahme |
| OF-F02-3 | Detailseite eines archivierten Titels | Für Gast und Mitglied **„nicht gefunden“ (404)**; Bibliothekare sehen ihn in der Verwaltung. | E02-US01-FR03 „deaktiviert“ | Abgeleitet |
| OF-F02-4 | Eigene Ausleihen/Vormerkungen auf der Detailseite anzeigen? | **Nein**, wird nicht gefordert. Eigene Ausleihen zeigt F-06. | – | Annahme |

### F-03 Titel pflegen

| ID | Frage | Entscheidung | Grundlage | Art |
|---|---|---|---|---|
| OF-F03-1 | Blockiert eine wartende Vormerkung das Archivieren? | **Ja.** Jede aktive Vormerkung des Titels (wartend oder abholbereit) blockiert. | E02-US01-FR03 „kein Exemplar mehr … vorgemerkt“; Vormerkungen gelten je Titel (E05-US01-FR02) | Abgeleitet |
| OF-F03-2 | ISBN prüfen? | Nur eine **Formprüfung**: nach Entfernen von Bindestrichen und Leerzeichen 10 Zeichen (Ziffern, letztes Zeichen auch `X`) oder 13 Ziffern. Keine Prüfziffer, keine Eindeutigkeit. | E02-US01-FR01 „optional ISBN“ | Annahme |
| OF-F03-3 | Archivierten Titel wieder aktivieren oder bearbeiten? | **Nein**, nicht gefordert. | E02-US01 nennt nur anlegen, bearbeiten, archivieren | Annahme |
| OF-F03-5 | Zeigt „Meine Ausleihen“ nach einer Titeländerung den alten Namen? | **Nein**, angezeigt wird der aktuelle Titel. Unverändert bleiben die Daten des Ausleihvorgangs (Exemplar, Mitglied, Start, Fälligkeit, Verlängerungen). | E02-US01-FR02 „wirkt sich nicht auf laufende Ausleihvorgänge … aus“ | Abgeleitet |

### F-04 Exemplare

| ID | Frage | Entscheidung | Grundlage | Art |
|---|---|---|---|---|
| OF-F04-1 | Ausgeliehenes Exemplar auf „verloren“ setzen? | **Erlaubt.** Der Ausleihvorgang bleibt offen, bis eine Rückgabe erfasst wird. Weitere Folgen (z. B. Gebühr für Verlust) fordert die Spezifikation nicht. | E02-US02-FR02 | Annahme |
| OF-F04-2 | Exemplare zu archivierten Titeln anlegen? | **Nein** (`TITEL_ARCHIVIERT`). | E02-US01-FR03 „deaktiviert“ | Abgeleitet |
| OF-F04-3 | Exemplare löschen? | **Nein**, nicht gefordert; ein verlorenes Exemplar bleibt mit Zustand „verloren“ erhalten. | E02-US02 nennt nur Anlegen und Zustand | Annahme |

### F-05 Ausleihen

| ID | Frage | Entscheidung | Grundlage | Art |
|---|---|---|---|---|
| OF-F05-1 | Welches verfügbare Exemplar wählt das System? | **Das verfügbare Exemplar mit der kleinsten Inventarnummer.** Keine weitere Bevorzugung (z. B. nach Zustand), weil die Spezifikation keine verlangt. | E03-US01-FR01 „wählt das System automatisch ein verfügbares Exemplar“ | Annahme (Regel nur für eindeutige Tests) |
| OF-F05-2 | Gilt eine geänderte Leihfrist für bestehende Ausleihen? | **Nein.** Die Fälligkeit wird beim Ausleihen berechnet und gespeichert. | E03-US01-FR01 „erzeugt einen Ausleihvorgang mit … berechneter Fälligkeit“ | Abgeleitet |
| OF-F05-3 | Reihenfolge der Fehler | siehe OF-S1 | – | Annahme |
| OF-F05-4 | Sperrt ein überfälliger Vorgang ohne Mahnung? | **Nein.** Es sperren nur das Limit und eine offene Mahnung. | E03-US01-FR03 nennt genau diese zwei Bedingungen | Abgeleitet |
| OF-F05-5 | Denselben Titel mehrfach gleichzeitig ausleihen? | **Erlaubt**, nur das Limit zählt. | E03-US01-FR03 verbietet es nicht | Abgeleitet (wörtlich), nachfragen |
| OF-F05-6 | Ausleihe am Tresen durch den Bibliothekar? | **Nein**, nur Selbstbedienung durch das Mitglied. | Story E03-US01 „Als Mitglied …“ | Abgeleitet |

### F-06 Verlängern

| ID | Frage | Entscheidung | Grundlage | Art |
|---|---|---|---|---|
| OF-F06-1 | „für das Exemplar keine Vormerkung“, Vormerkungen gelten aber je Titel | Eine **wartende Vormerkung für den Titel** des Exemplars blockiert die Verlängerung. | E03-US02-FR02; E05-US01-FR02 „Vormerkungen werden je Titel in einer Warteschlange … verwaltet“ | Abgeleitet |
| OF-F06-2 | Basis der neuen Fälligkeit | **Tag der Verlängerung + Leihfrist** (`leihfristTage`), aber nie früher als die alte Fälligkeit (sonst würde eine inzwischen kürzer konfigurierte Leihfrist die Frist durch Verlängern verkürzen). | E03-US02-FR03 „neue Fälligkeit auf Basis der konfigurierten Frist“ | Annahme (alternativ: alte Fälligkeit + Leihfrist; nachfragen) |
| OF-F06-3 | Verlängerung nach Fristüberschreitung erlaubt? | **Ja**, wenn die Bedingungen aus FR02 erfüllt sind. Sie stoppt die Mahnung aber nicht: Eine bestehende Mahnung bleibt offen; gibt es noch keine, entsteht sie bei der Verlängerung (wie bei der Rückgabe, OF-F07-1) mit der Gebühr für die bis dahin überschrittenen Tage. | E03-US02-FR02 nennt nur Vormerkung und Höchstzahl; E03-US02-FR03 „stoppt … nur, wenn sie vor Fristüberschreitung erfolgt“; E04-US02-FR01 „für jeden überfälligen Vorgang wird eine Mahnung … erzeugt“ | Abgeleitet (Gebühr bis zum Verlängerungstag: Annahme) |
| OF-F06-4 | Was heißt „stoppt eine laufende Mahnung“, wenn es vor der Fälligkeit noch keine gibt? | Eine Verlängerung **am oder vor** dem Fälligkeitstag verschiebt die Fälligkeit, der Vorgang wird nicht überfällig und es entsteht keine Mahnung. | E03-US02-FR03 | Abgeleitet |

### F-07 Rückgabe

| ID | Frage | Entscheidung | Grundlage | Art |
|---|---|---|---|---|
| OF-F07-1 | Legt eine verspätete Rückgabe die Mahnung an, wenn der Job noch nicht lief? | **Ja.** Gibt es schon eine Mahnung zum Vorgang, bekommt sie die Gebühr; sonst wird sie angelegt. | E03-US03-FR02 „berechnet … eine Mahngebühr gemäß E04-US02-FR02“; E04-US02-FR01 „für jeden überfälligen Vorgang“ | Abgeleitet |
| OF-F07-2 | Benachrichtigung „abholbereit“ in F-07 oder F-10? | F-07 **legt die Benachrichtigung an** (ein Datensatz, OF-D8). Die Anzeige der Benachrichtigungen kommt mit F-08/F-10. | E05-US01-FR03 „erhält die erste Person … eine Benachrichtigung“, ausgelöst durch die Rückgabe (E03-US03-FR03) | Abgeleitet (Aufteilung: Planung) |
| OF-F07-3 | Rückgabe per Inventarnummer oder Liste? | **Per Inventarnummer** (Eingabe oder Scanner). | NFR01 „in wenigen Schritten“ | Annahme |
| OF-F07-4 | Zustand bei der Rückgabe ändern? | **Nicht Teil von F-07.** Der Bibliothekar ändert den Zustand bei Bedarf über F-04. | nicht gefordert | Annahme |
| OF-F07-5 | Rückgabe eines als verloren markierten Exemplars | Die Rückgabe wird normal erfasst; der Zustand bleibt „verloren“, bis der Bibliothekar ihn ändert. | – | Annahme |

### Vorgriff Woche 2: F-09 Mahnungen und F-10 Vormerkungen

Gemeldet von Review & Security beim Prüfen von Woche 1 (R-06 in PR #16, R-08 in PR #18). Die Specs F-09 und F-10 übernehmen diese Entscheidungen.

| ID | Frage | Entscheidung | Grundlage | Art |
|---|---|---|---|---|
| OF-F10-1 | Wird ein Exemplar, das **nicht durch eine Rückgabe** ausleihbar wird (neu angelegt, Zustand von „verloren“ zurück auf „gut“ oder „beschädigt“, Abholfrist einer Vormerkung abgelaufen), sofort frei, obwohl eine Vormerkung wartet? | **Nein.** Wartet für den Titel eine Vormerkung, wird jedes Exemplar, das ausleihbar wird, der **ersten wartenden** Vormerkung zugeordnet (Status `ABHOLBEREIT`, Abholfrist ab diesem Tag, Benachrichtigung „abholbereit“), genau wie bei der Rückgabe. Erst wenn keine Vormerkung wartet, ist es frei verfügbar. | E05 „vormerken, um es zu erhalten, sobald es frei ist“; E05-US01-FR02 Warteschlange je Titel; E05-US01-FR03 „verstreicht die Frist, rückt die nächste Person nach“; E03-US03-FR03 „statt frei verfügbar zu werden“ | Abgeleitet (Rückgabe und Fristablauf); neues Exemplar und Zustandswechsel: Annahme |
| OF-F09-1 | Wie summiert sich die Mahngebühr, wenn ein Vorgang **mehrmals** überfällig wird (verspätete Verlängerung, danach wieder überfällig)? | **Eine Mahnung je Ausleihvorgang**, ihre Gebühr ist die **Summe aller Überschreitungen**: Jede Frist zählt die Tage von ihrer Fälligkeit bis zu dem Tag, an dem sie endet (verspätete Verlängerung oder Rückgabe), × `mahnTagessatzEuro` zu diesem Tag. Endet eine Frist durch eine verspätete Verlängerung und gibt es die Mahnung schon (vom System-Job), wird die Gebühr dieser Frist **hinzugerechnet** (nicht verworfen). Solange eine Frist noch läuft, zeigt die App zusätzlich die bis heute aufgelaufenen Tage an. Kommt Gebühr zu einer bereits beglichenen Mahnung hinzu, ist die Mahnung wieder offen. | E04-US02-FR01 „für jeden überfälligen Vorgang wird eine Mahnung … erzeugt“; E04-US02-FR02 „überschrittene Tage multipliziert mit einem … Tagessatz“; E03-US02-FR03 (Verlängerung danach stoppt die Mahnung nicht) | Abgeleitet (eine Mahnung je Vorgang, Gebühr aus allen überschrittenen Tagen); Wiedereröffnen nach Begleichen: Annahme |

## Annahmen, die beim Prof nachgefragt werden sollten

Nach Wichtigkeit für Woche 1:

1. **OF-F06-2** Neue Fälligkeit bei Verlängerung: ab Verlängerungstag oder ab alter Fälligkeit?
2. **OF-F06-3** Gebühr bei Verlängerung nach Fristüberschreitung: Tage bis zur Verlängerung?
3. **OF-D2 / OF-D3** Ist „beschädigt“ ausleihbar? Gibt es weitere Zustände oder eine manuelle Sperre?
4. **OF-F05-5** Darf ein Mitglied denselben Titel mehrfach gleichzeitig ausleihen?
5. **OF-R3 / OF-D7** Eine Rolle je Konto; Administrator ohne Bibliothekarsrechte?
6. **OF-F01-4** Wie groß ist der „Testbestand“ für NFR02?
7. **OF-D1** Erscheinungsjahr als optionales Feld?
8. **OF-D8** Benachrichtigung nur in der App, ohne E-Mail?

Für Woche 2:

9. **OF-F10-1** Bekommt auch ein neu angelegtes oder wieder auffindbares Exemplar sofort die erste wartende Vormerkung?
10. **OF-F09-1** Gebühr bei mehreren Überschreitungen eines Vorgangs: Summe in einer Mahnung? Wird eine beglichene Mahnung durch neue Gebühr wieder offen?

Alle übrigen Annahmen sind technische oder Bedien-Details ohne Einfluss auf eine FR.

## Folgen

- Die Abschnitte „Offene Fragen“ in Datenmodell, Rechte-Matrix, Schnittstellen, ADR 007/008 und den Specs heißen jetzt „Entscheidungen“ und verweisen hierher.
- Neuer Fehlercode: keiner. Die Verlängerung nach Fristüberschreitung braucht keinen eigenen Code, weil sie erlaubt ist.
