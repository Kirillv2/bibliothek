# Rechte-Matrix der fünf Rollen

- Status: Vorgeschlagen (Gate 1)
- Bezug: Spezifikation 1.3 (Akteure), E01–E07, E06-US01-FR02, NFR03
- Wird geprüft von: `tests/security/` (Testing schreibt, Review & Security führt aus)

Legende: ✅ erlaubt · 👤 erlaubt, aber nur für **eigene** Daten · ❌ verboten · ❓ offen (Spezifikation sagt nichts, Entscheidung an Gate 1)

Grundsatz: **Alles, was nicht erlaubt ist, ist verboten.** Geprüft wird immer auf dem Server, nie nur in der Oberfläche.

## Matrix

| Aktion | Quelle | Feature | Gast | Mitglied | Bibliothekar | Administrator | System |
|---|---|---|---|---|---|---|---|
| Katalog durchsuchen, filtern, sortieren | E01-US01 | F-01 | ✅ | ✅ | ✅ | ✅ | ❌ |
| Detailseite eines Titels mit Exemplarstatus sehen | E01-US02-FR01 | F-02 | ✅ | ✅ | ✅ | ✅ | ❌ |
| Aktion „Ausleihen“ angeboten bekommen | E01-US02-FR02 | F-02 | ❌ | ✅ | ❓ OF-R1 | ❓ OF-R1 | ❌ |
| Aktion „Vormerken“ angeboten bekommen | E01-US02-FR03 | F-02 | ❓ OF-R2 | ✅ | ❓ OF-R1 | ❓ OF-R1 | ❌ |
| Titel anlegen, bearbeiten, archivieren | E02-US01 | F-03 | ❌ | ❌ | ✅ | ❓ OF-R3 | ❌ |
| Exemplare anlegen, Zustand ändern | E02-US02 | F-04 | ❌ | ❌ | ✅ | ❓ OF-R3 | ❌ |
| Ausleihen | E03-US01 | F-05 | ❌ → Anmeldung | ✅ | ❓ OF-R1 | ❓ OF-R1 | ❌ |
| Eigene offene Ausleihen sehen | E03-US02-FR01 | F-06 | ❌ → Anmeldung | 👤 | ❓ OF-R1 | ❓ OF-R1 | ❌ |
| Eigene Ausleihe verlängern | E03-US02-FR02 | F-06 | ❌ → Anmeldung | 👤 | ❓ OF-R1 | ❓ OF-R1 | ❌ |
| Ausleihen **anderer** Mitglieder sehen | – | – | ❌ | ❌ | ✅ für Rückgabe und Dashboard (E03-US03, E07-US01-FR02) | ❓ OF-R3 | ❌ |
| Rückgabe erfassen | E03-US03 | F-07 | ❌ | ❌ | ✅ | ❓ OF-R3 | ❌ |
| Fristprüfung, Erinnerung, „überfällig“ markieren | E04-US01 | F-08 | ❌ | ❌ | ❌ | ❌ | ✅ (nur mit Job-Secret) |
| Mahnung erzeugen | E04-US02-FR01 | F-09 | ❌ | ❌ | ❌ | ❌ | ✅ (nur mit Job-Secret) |
| Mahnungen ansehen und als beglichen markieren | E04-US02-FR03 | F-09 | ❌ | ❓ OF-R4 (eigene ansehen) | ✅ | ❓ OF-R3 | ❌ |
| Titel vormerken | E05-US01 | F-10 | ❌ → Anmeldung | ✅ | ❓ OF-R1 | ❓ OF-R1 | ❌ |
| Abholfrist ablaufen lassen, nächste Person nachrücken | E05-US01-FR03 | F-10 | ❌ | ❌ | ❌ | ❌ | ✅ (nur mit Job-Secret) |
| Eigene Benachrichtigungen sehen | E04-US01-FR02, E05-US01-FR03 | F-08, F-10 | ❌ | 👤 | 👤 | 👤 | ❌ |
| Registrieren | E06-US01-FR01 | F-11 | ✅ | – | – | – | ❌ |
| Anmelden / Abmelden | E06-US01-FR01 | F-11 (Woche 1: Seed-Nutzer) | ✅ Anmelden | ✅ Abmelden | ✅ Abmelden | ✅ Abmelden | ❌ |
| Rollen zuweisen | E06-US02-FR01 | F-12 | ❌ | ❌ | ❌ | ✅ | ❌ |
| Systemparameter ändern (innerhalb der Grenzen aus `config/`) | E06-US02-FR02 | F-12 | ❌ | ❌ | ❌ | ✅ | ❌ |
| Dashboard mit Kennzahlen, Liste überfälliger Ausleihen | E07-US01-FR01, FR02 | F-13 | ❌ | ❌ | ✅ | ❓ OF-R3 | ❌ |
| Bestand als CSV exportieren | E07-US01-FR03 | F-13 | ❌ | ❌ | ✅ | ❓ OF-R3 | ❌ |

„❌ → Anmeldung“: Ein Gast, der die Aktion aufruft, wird zur Anmeldung geschickt (E06-US01-FR02), es passiert nichts.

## Daten, die eine Rolle sehen darf

| Daten | Gast | Mitglied | Bibliothekar | Administrator |
|---|---|---|---|---|
| Titel-Metadaten, Exemplare, Inventarnummern, Status, Fälligkeitsdatum ausgeliehener Exemplare | ✅ | ✅ | ✅ | ✅ |
| **Wer** ein Exemplar ausgeliehen oder vorgemerkt hat | ❌ | ❌ (nur bei eigenen) | ✅ | ❓ OF-R3 |
| E-Mail-Adressen anderer Nutzer | ❌ | ❌ | ✅ (Dashboard, Rückgabe) | ✅ (Rollenverwaltung) |
| Passwort-Hashes, Sitzungs-Tokens | ❌ | ❌ | ❌ | ❌ |

## Pflicht-Rechte-Tests je Rolle (für Testing, `tests/security/`)

| Rolle | Muss gelten |
|---|---|
| Gast | Jede geschützte Aktion (Ausleihen, Verlängern, Vormerken, Verwaltung) ohne Anmeldung → keine Wirkung, Weiterleitung zur Anmeldung bzw. `NICHT_ANGEMELDET`. Katalog- und Detailantworten enthalten keine Personendaten. |
| Mitglied | Mitglied A kann Ausleihen, Mahnungen, Vormerkungen von Mitglied B weder sehen noch ändern (`KEINE_BERECHTIGUNG` oder `NICHT_GEFUNDEN`). Kein Zugriff auf Titel-/Exemplarpflege und Rückgabe. Die Mitglieds-ID kommt immer aus der Sitzung, nie aus der Anfrage. |
| Bibliothekar | Kein Zugriff auf Rollenzuweisung und Systemparameter. |
| Administrator | Nur Administrator erreicht Rollen- und Parameterverwaltung; Werte außerhalb der Grenzen aus `config/` werden abgelehnt. |
| System | Job-Endpunkte ohne oder mit falschem Secret → `401`; mit Nutzer-Sitzung (auch Administrator) → `401`. Zweiter Lauf am selben Stichtag erzeugt nichts Neues (NFR04). |

## Offene Fragen (Gate 1)

| ID | Frage | Vorschlag |
|---|---|---|
| OF-R1 | Dürfen Bibliothekar und Administrator selbst ausleihen, verlängern und vormerken? Die Spezifikation nennt dafür nur das Mitglied. | Nein, nur Rolle `MITGLIED` (hängt an OF-D7) |
| OF-R2 | Wird einem Gast „Vormerken“ angezeigt (mit Weiterleitung zur Anmeldung) oder gar nicht? E01-US02-FR02 nennt beim Ausleihen ausdrücklich das angemeldete Mitglied, FR03 beim Vormerken nicht. | Anzeigen, Klick führt zur Anmeldung |
| OF-R3 | Hat der Administrator auch alle Rechte des Bibliothekars? | Nein, getrennte Rollen; ein Konto bekommt die Rolle, die es braucht |
| OF-R4 | Sieht ein Mitglied seine eigenen Mahnungen und Gebühren? Die Spezifikation fordert es nicht ausdrücklich, aber eine offene Mahnung sperrt die Ausleihe (E04-US02-FR03). | Ja, nur eigene, nur lesen |
