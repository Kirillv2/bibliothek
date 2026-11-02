// F-09 · E04-US02 · Mahnungen und Gebühren verwalten (nur Bibliothekar)
import Link from "next/link";
import { formatiereDatum } from "@/lib/datum";
import { formatiereCent } from "@/lib/geld";
import { erstelleKontext } from "@/server/anfrage";
import { ladeMahnungen } from "@/server/mahnungen";
import { Zugriffsfehler } from "../../zugriff";
import { BegleichenKnopf } from "./begleichen-knopf";

export const instant = false;

export default async function Mahnungen({ searchParams }: PageProps<"/verwaltung/mahnungen">) {
  const nurOffene = (await searchParams).filter === "offen";
  const ergebnis = await ladeMahnungen(await erstelleKontext(), { nurOffene });
  if (!ergebnis.ok) return <Zugriffsfehler fehler={ergebnis.fehler} pfad="/verwaltung/mahnungen" />;
  const liste = ergebnis.daten;

  return (
    <>
      <h1>Mahnungen</h1>
      <p className="aktionen">
        {nurOffene ? <Link href="/verwaltung/mahnungen">Alle anzeigen</Link> : <Link href="/verwaltung/mahnungen?filter=offen">Nur offene anzeigen</Link>}
      </p>
      {liste.length === 0 ? (
        <p className="meldung" role="status">
          {nurOffene ? "Es gibt keine offenen Mahnungen." : "Es gibt keine Mahnungen."}
        </p>
      ) : (
        <div className="tabelle-rahmen">
          <table>
            <thead>
              <tr>
                <th>Datum</th>
                <th>Mitglied</th>
                <th>Titel</th>
                <th>Inventarnummer</th>
                <th>Fällig am</th>
                <th>Tage</th>
                <th>Gebühr</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {liste.map((m) => (
                <tr key={m.dunningId}>
                  <td>{formatiereDatum(m.createdOn)}</td>
                  <td>{m.mitgliedEmail}</td>
                  <td>{m.title}</td>
                  <td>{m.inventoryNumber}</td>
                  <td>{formatiereDatum(m.dueDate)}</td>
                  <td>{m.ueberschritteneTage}</td>
                  <td>{formatiereCent(m.gebuehrCents)}</td>
                  <td>
                    {m.beglichen ? (
                      <span className="hinweis">beglichen</span>
                    ) : m.begleichbar ? (
                      <BegleichenKnopf dunningId={m.dunningId} titel={m.title} />
                    ) : (
                      // OF-F09-2: Gebühr läuft noch
                      <span className="feldfehler">offen, Frist läuft noch</span>
                    )}
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
