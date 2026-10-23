// F-06 · E03-US02 · Meine Ausleihen: offene Vorgänge mit Fälligkeit und Verlängern (nur eigene Daten)
import { formatiereDatum } from "@/lib/datum";
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

  return (
    <>
      <h1>Meine Ausleihen</h1>
      {ergebnis.daten.length === 0 ? (
        // AK-01.5: Hinweis statt leerer Tabelle
        <p className="meldung" role="status">
          Du hast gerade nichts ausgeliehen.
        </p>
      ) : (
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
                <td>{ausleihe.title}</td>
                <td>{ausleihe.inventoryNumber}</td>
                <td>
                  {formatiereDatum(ausleihe.dueDate)}
                  {ausleihe.dueDate < heute && <span className="feldfehler"> (überfällig)</span>}
                </td>
                <td>
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
      )}
    </>
  );
}
