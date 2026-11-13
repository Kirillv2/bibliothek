// F-10 · E05-US01-FR02 · Meine Vormerkungen: Status, Platz bzw. Exemplar und letzter Abholtag (AK-02.3)
import Link from "next/link";
import { formatiereDatum } from "@/lib/datum";
import { erstelleKontext } from "@/server/anfrage";
import { ladeMeineVormerkungen } from "@/server/vormerkung";
import { Zugriffsfehler } from "../../zugriff";

export const instant = false;

export default async function MeineVormerkungen() {
  const ergebnis = await ladeMeineVormerkungen(await erstelleKontext());
  if (!ergebnis.ok) return <Zugriffsfehler fehler={ergebnis.fehler} pfad="/konto/vormerkungen" />;
  const liste = ergebnis.daten;

  return (
    <>
      <h1>Meine Vormerkungen</h1>
      {liste.length === 0 ? (
        <p className="meldung" role="status">
          Du hast keine aktiven Vormerkungen. Ist bei einem Titel kein Exemplar verfügbar, kannst du ihn auf der
          Detailseite vormerken.
        </p>
      ) : (
        <div className="tabelle-rahmen stapel">
          <table>
            <thead>
              <tr>
                <th>Titel</th>
                <th>Status</th>
                <th>Hinweis</th>
              </tr>
            </thead>
            <tbody>
              {liste.map((v) => (
                <tr key={v.reservationId}>
                  <td data-label="Titel">
                    <Link href={`/titel/${v.titleId}`}>{v.title}</Link>
                  </td>
                  <td data-label="Status">{v.status === "ABHOLBEREIT" ? "Abholbereit" : "Wartend"}</td>
                  <td data-label="Hinweis">
                    {v.status === "ABHOLBEREIT"
                      ? `Exemplar ${v.inventoryNumber ?? "–"} liegt bereit. Abholen (ausleihen) bis einschließlich ${
                          v.pickupDeadline ? formatiereDatum(v.pickupDeadline) : "–"
                        }.`
                      : `Platz ${v.position} in der Warteschlange`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
