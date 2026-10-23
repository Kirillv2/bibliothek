// F-03 · E02-US01 · Übersicht der Titelverwaltung; archivierte Titel bleiben sichtbar (AK-03.7)
import Link from "next/link";
import { erstelleKontext } from "@/server/anfrage";
import { ladeVerwaltungsliste } from "@/server/titel";
import { Zugriffsfehler } from "../../zugriff";

export const instant = false;

export default async function TitelVerwaltung() {
  const ergebnis = await ladeVerwaltungsliste(await erstelleKontext());
  if (!ergebnis.ok) return <Zugriffsfehler fehler={ergebnis.fehler} pfad="/verwaltung/titel" />;
  const liste = ergebnis.daten;

  return (
    <>
      <h1>Titel verwalten</h1>
      <p>
        <Link className="knopf" href="/verwaltung/titel/neu">
          Neuen Titel anlegen
        </Link>
      </p>
      {liste.length === 0 ? (
        <p>Es gibt noch keine Titel.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Titel</th>
              <th>Autor</th>
              <th>Kategorie</th>
              <th>Exemplare</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {liste.map((titel) => (
              <tr key={titel.titleId}>
                <td>
                  <Link href={`/verwaltung/titel/${titel.titleId}`}>{titel.title}</Link>
                </td>
                <td>{titel.author}</td>
                <td>{titel.category}</td>
                <td>{titel.anzahlExemplare}</td>
                <td>{titel.archiviert ? "archiviert" : "aktiv"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
