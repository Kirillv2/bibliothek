// F-13 · E07-US01 · Dashboard: Kennzahlen, überfällige Ausleihen (sortierbar), Bestandsexport (nur Bibliothekar)
import Link from "next/link";
import { formatiereDatum } from "@/lib/datum";
import { erstelleKontext } from "@/server/anfrage";
import { ladeDashboard, type Richtung, type Sortierung } from "@/server/dashboard";
import { Zugriffsfehler } from "../../zugriff";

export const instant = false;

function sortierLink(spalte: Sortierung, aktiv: Sortierung, richtung: Richtung, text: string) {
  const istAktiv = spalte === aktiv;
  const naechste: Richtung = istAktiv && richtung === "AUF" ? "AB" : "AUF";
  const pfeil = istAktiv ? (richtung === "AUF" ? " ▲" : " ▼") : "";
  return (
    <Link
      href={`/verwaltung/dashboard?sortierung=${spalte}&richtung=${naechste}`}
      aria-label={`${text} ${naechste === "AUF" ? "aufsteigend" : "absteigend"} sortieren`}
    >
      {text}
      {pfeil}
    </Link>
  );
}

export default async function DashboardSeite({ searchParams }: PageProps<"/verwaltung/dashboard">) {
  const { sortierung, richtung } = await searchParams;
  // AK-02.6: unbekannte Angaben → Standard (Fälligkeit aufsteigend)
  const sort: Sortierung = sortierung === "MITGLIED" ? "MITGLIED" : "FAELLIGKEIT";
  const richt: Richtung = sortierung === sort && richtung === "AB" ? "AB" : "AUF";
  const ergebnis = await ladeDashboard(await erstelleKontext(), { sortierung: sort, richtung: richt });
  if (!ergebnis.ok) return <Zugriffsfehler fehler={ergebnis.fehler} pfad="/verwaltung/dashboard" />;
  const { kennzahlen, ueberfaellige } = ergebnis.daten;

  return (
    <>
      <h1>Dashboard</h1>
      <ul className="kennzahlen" aria-label="Kennzahlen">
        <li>
          <span className="kennzahl-wert">{kennzahlen.offeneAusleihen}</span>
          <span className="kennzahl-text">offene Ausleihen</span>
        </li>
        <li className={kennzahlen.ueberfaellig > 0 ? "warnung" : undefined}>
          <span className="kennzahl-wert">{kennzahlen.ueberfaellig}</span>
          <span className="kennzahl-text">überfällige Vorgänge</span>
        </li>
        <li>
          <span className="kennzahl-wert">{kennzahlen.aktiveVormerkungen}</span>
          <span className="kennzahl-text">aktive Vormerkungen</span>
        </li>
      </ul>

      <p className="aktionen">
        {/* AK-03.7: Export mit einem Klick */}
        <a className="knopf" href="/verwaltung/bestand.csv" download>
          Bestand als CSV herunterladen
        </a>
      </p>

      <h2>Überfällige Ausleihen</h2>
      {ueberfaellige.length === 0 ? (
        <p className="meldung" role="status">
          Zurzeit ist keine Ausleihe überfällig.
        </p>
      ) : (
        <div className="tabelle-rahmen">
          <table>
            <thead>
              <tr>
                <th aria-sort={sort === "MITGLIED" ? (richt === "AUF" ? "ascending" : "descending") : undefined}>
                  {sortierLink("MITGLIED", sort, richt, "Mitglied")}
                </th>
                <th>Titel</th>
                <th>Inventarnummer</th>
                <th aria-sort={sort === "FAELLIGKEIT" ? (richt === "AUF" ? "ascending" : "descending") : undefined}>
                  {sortierLink("FAELLIGKEIT", sort, richt, "Fällig am")}
                </th>
                <th>Tage über der Frist</th>
              </tr>
            </thead>
            <tbody>
              {ueberfaellige.map((v) => (
                <tr key={v.loanId}>
                  <td>{v.mitgliedEmail}</td>
                  <td>{v.title}</td>
                  <td>
                    {/* AK-02.4: Link auf den Vorgang */}
                    <Link href={`/verwaltung/ausleihen/${v.loanId}`}>{v.inventoryNumber}</Link>
                  </td>
                  <td>{formatiereDatum(v.dueDate)}</td>
                  <td>{v.ueberschritteneTage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
