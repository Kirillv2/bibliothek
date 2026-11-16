// F-06 · E03-US02 · Meine Ausleihen: offene Vorgänge mit Fälligkeit und Verlängern (nur eigene Daten)
import { formatiereDatum } from "@/lib/datum";
import { formatiereCent } from "@/lib/geld";
import { ladeMeineMahnungen } from "@/server/mahnungen";
import { erstelleKontext } from "@/server/anfrage";
import { ladeMeineAusleihen } from "@/server/verlaengerung";
import { FEHLERTEXTE } from "../../meldungen";
import { Zugriffsfehler } from "../../zugriff";
import { VerlaengernKnopf } from "./verlaengern-knopf";

export const instant = false;

export default async function MeineAusleihen() {
  const k = await erstelleKontext();
  const ergebnis = await ladeMeineAusleihen(k);
  if (!ergebnis.ok) return <Zugriffsfehler fehler={ergebnis.fehler} pfad="/konto/ausleihen" />;
  const heute = k.uhr.heute();
  // F-09 AK-02.6, OF-R4: eigene Mahnungen
  const mahnungen = await ladeMeineMahnungen(k);

  return (
    <>
      <h1>Meine Ausleihen</h1>
      {ergebnis.daten.length === 0 ? (
        // AK-01.5: Hinweis statt leerer Tabelle
        <p className="meldung" role="status">
          Du hast gerade nichts ausgeliehen.
        </p>
      ) : (
        <div className="tabelle-rahmen stapel">
          <table>
            <thead>
              <tr>
                <th>Titel</th>
                <th>Inventarnummer</th>
                <th>Fällig am</th>
                <th>Verlängern</th>
              </tr>
            </thead>
            <tbody>
              {ergebnis.daten.map((ausleihe) => (
                <tr key={ausleihe.loanId}>
                  <td data-label="Titel">{ausleihe.title}</td>
                  <td data-label="Inventarnummer">{ausleihe.inventoryNumber}</td>
                  <td data-label="Fällig am">
                    {formatiereDatum(ausleihe.dueDate)}
                    {ausleihe.dueDate < heute && <span className="feldfehler"> (überfällig)</span>}
                  </td>
                  <td data-label="Verlängern">
                    {ausleihe.verlaengerbar ? (
                      <VerlaengernKnopf loanId={ausleihe.loanId} titel={ausleihe.title} />
                    ) : (
                      // AK-02.8: warum Verlängern nicht möglich ist
                      <span className="hinweis">{ausleihe.grund ? FEHLERTEXTE[ausleihe.grund] : "Nicht möglich."}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {mahnungen.ok && mahnungen.daten.length > 0 && (
        <>
          <h2>Meine Mahnungen</h2>
          <div className="tabelle-rahmen stapel">
            <table>
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Titel</th>
                  <th>Inventarnummer</th>
                  <th>Gebühr</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {mahnungen.daten.map((m) => (
                  <tr key={m.dunningId}>
                    <td data-label="Datum">{formatiereDatum(m.createdOn)}</td>
                    <td data-label="Titel">{m.title}</td>
                    <td data-label="Inventarnummer">{m.inventoryNumber}</td>
                    <td data-label="Gebühr">{formatiereCent(m.gebuehrCents)}</td>
                    <td data-label="Status">{m.beglichen ? "beglichen" : <span className="feldfehler">offen</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {mahnungen.daten.some((m) => !m.beglichen) && (
            <p className="hinweis">Solange eine Mahnung offen ist, kannst du nichts Neues ausleihen. Beglichen wird sie in der Bibliothek.</p>
          )}
        </>
      )}
    </>
  );
}
