# Rechte-Matrix der fünf Rollen

- Status: Entschieden (Agenten im Auftrag von KiKo, siehe [ADR 009](../adr/009-entscheidungen-zu-luecken-der-spezifikation.md)); Freigabe an Gate 1
- Bezug: Spezifikation 1.3 (Akteure), E01–E07, E06-US01-FR02, NFR03
- Wird geprüft von: `tests/security/` (Testing schreibt, Review & Security führt aus)

Legende: ✅ erlaubt · 👤 erlaubt, aber nur für **eigene** Daten · ❌ verboten · Verweise wie (OF-R1) zeigen auf die Entscheidung in ADR 009

Grundsatz: **Alles, was nicht erlaubt ist, ist verboten.** Geprüft wird immer auf dem Server, nie nur in der Oberfläche.

## Matrix

| Aktion | Quelle | Feature | Gast | Mitglied | Bibliothekar | Administrator | System |
|---|---|---|---|---|---|---|---|
| Katalog durchsuchen, filtern, sortieren | E01-US01 | F-01 | ✅ | ✅ | ✅ | ✅ | ❌ |
| Detailseite eines Titels mit Exemplarstatus sehen | E01-US02-FR01 | F-02 | ✅ | ✅ | ✅ | ✅ | ❌ |
| Aktion „Ausleihen“ angeboten bekommen | E01-US02-FR02 | F-02 | ❌ | ✅ | ❌ (OF-R1) | ❌ (OF-R1) | ❌ |
| Aktion „Vormerken“ angeboten bekommen | E01-US02-FR03 | F-02 | ✅ Klick → Anmeldung (OF-R2) | ✅ | ❌ (OF-R1) | ❌ (OF-R1) | ❌ |
| Titel anlegen, bearbeiten, archivieren | E02-US01 | F-03 | ❌ | ❌ | ✅ | ❌ (OF-R3) | ❌ |
| Exemplare anlegen, Zustand ändern | E02-US02 | F-04 | ❌ | ❌ | ✅ | ❌ (OF-R3) | ❌ |
| Ausleihen | E03-US01 | F-05 | ❌ → Anmeldung | ✅ | ❌ (OF-R1) | ❌ (OF-R1) | ❌ |
| Eigene offene Ausleihen sehen | E03-US02-FR01 | F-06 | ❌ → Anmeldung | 👤 | ❌ (OF-R1) | ❌ (OF-R1) | ❌ |
| Eigene Ausleihe verlängern | E03-US02-FR02 | F-06 | ❌ → Anmeldung | 👤 | ❌ (OF-R1) | ❌ (OF-R1) | ❌ |
| Ausleihen **anderer** Mitglieder sehen | – | – | ❌ | ❌ | ✅ für Rückgabe und Dashboard (E03-US03, E07-US01-FR02) | ❌ (OF-R3) | ❌ |
| Rückgabe erfassen | E03-US03 | F-07 | ❌ | ❌ | ✅ | ❌ (OF-R3) | ❌ |
| Fristprüfung, Erinnerung, „überfällig“ markieren | E04-US01 | F-08 | ❌ | ❌ | ❌ | ❌ | ✅ (nur mit Job-Secret) |
| Mahnung erzeugen | E04-US02-FR01 | F-09 | ❌ | ❌ | ❌ | ❌ | ✅ (nur mit Job-Secret) |
| Mahnungen ansehen und als beglichen markieren | E04-US02-FR03 | F-09 | ❌ | ❌ in Woche 1, eigene Ansicht entscheidet Spec F-09 (OF-R4) | ✅ | ❌ (OF-R3) | ❌ |
| Titel vormerken | E05-US01 | F-10 | ❌ → Anmeldung | ✅ | ❌ (OF-R1) | ❌ (OF-R1) | ❌ |
| Abholfrist ablaufen lassen, nächste Person nachrücken | E05-US01-FR03 | F-10 | ❌ | ❌ | ❌ | ❌ | ✅ (nur mit Job-Secret) |
| Eigene Benachrichtigungen sehen | E04-US01-FR02, E05-US01-FR03 | F-08, F-10 | ❌ | 👤 | 👤 | 👤 | ❌ |
| Registrieren | E06-US01-FR01 | F-11 | ✅ | – | – | – | ❌ |
| Anmelden / Abmelden | E06-US01-FR01 | F-11 (Woche 1: Seed-Nutzer) | ✅ Anmelden | ✅ Abmelden | ✅ Abmelden | ✅ Abmelden | ❌ |
| Rollen zuweisen | E06-US02-FR01 | F-12 | ❌ | ❌ | ❌ | ✅ | ❌ |
| Systemparameter ändern (innerhalb der Grenzen aus `config/`) | E06-US02-FR02 | F-12 | ❌ | ❌ | ❌ | ✅ | ❌ |
| Dashboard mit Kennzahlen, Liste überfälliger Ausleihen | E07-US01-FR01, FR02 | F-13 | ❌ | ❌ | ✅ | ❌ (OF-R3) | ❌ |
| Bestand als CSV exportieren | E07-US01-FR03 | F-13 | ❌ | ❌ | ✅ | ❌ (OF-R3) | ❌ |

„❌ → Anmeldung“: Ein Gast, der die Aktion aufruft, wird zur Anmeldung geschickt (E06-US01-FR02), es passiert nichts.

## Daten, die eine Rolle sehen darf

| Daten | Gast | Mitglied | Bibliothekar | Administrator |
|---|---|---|---|---|
| Titel-Metadaten, Exemplare, Inventarnummern, Status, Fälligkeitsdatum ausgeliehener Exemplare | ✅ | ✅ | ✅ | ✅ |
| **Wer** ein Exemplar ausgeliehen oder vorgemerkt hat | ❌ | ❌ (nur bei eigenen) | ✅ | ❌ (OF-R3) |
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

## Entscheidungen

Begründung und Zitate: [ADR 009](../adr/009-entscheidungen-zu-luecken-der-spezifikation.md).

| ID | Entscheidung | Art |
|---|---|---|
| OF-R1 | Ausleihen, Verlängern, Vormerken nur mit Rolle `MITGLIED`; Bibliothekar/Administrator bekommen `KEINE_BERECHTIGUNG`, die Aktionen werden ihnen nicht angezeigt | Abgeleitet (1.3, E01-US02-FR02) |
| OF-R2 | Gast sieht „Vormerken“, Klick führt zur Anmeldung; „Ausleihen“ sieht ein Gast nicht | Abgeleitet (E01-US02-FR02/FR03, E06-US01-FR02) |
| OF-R3 | Administrator hat keine Bibliothekarsrechte (getrennte Rollen laut 1.3) | Abgeleitet, nachfragen |
| OF-R4 | Eigene Mahnungen: in Woche 1 nur Hinweis `OFFENE_MAHNUNG` beim Ausleihen; eigene Ansicht entscheidet Spec F-09 | Annahme |
| – | 1.3 „Mitglied … ausleihen und zurückgeben“: Das Mitglied bringt zurück, **erfassen** darf nur der Bibliothekar (E03-US03) | Abgeleitet |
