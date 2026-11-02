// F-02 · E01-US02 · Detailseite eines Titels mit Exemplarstatus und Aktionen
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatiereDatum } from "@/lib/datum";
import { ladeTitelDetail } from "@/server/katalog/detail";
import { erstelleKontext } from "@/server/anfrage";
import { statusText } from "../../exemplarstatus-text";
import { AusleihenKnopf } from "./ausleihen-knopf";
import { VormerkenKnopf } from "./vormerken-knopf";

export const instant = false;

export default async function TitelSeite({ params }: PageProps<"/titel/[titleId]">) {
  const { titleId } = await params;
  const k = await erstelleKontext();
  const ergebnis = await ladeTitelDetail(k, titleId);
  // AK-01.8, AK-01.9: unbekannt oder archiviert → 404
  if (!ergebnis.ok) notFound();
  const titel = ergebnis.daten;

  return (
    <>
      <p>
        <Link href="/">Zurück zum Katalog</Link>
      </p>
      <h1>{titel.title}</h1>
      <dl className="metadaten">
        <dt>Autor</dt>
        <dd>{titel.author}</dd>
        <dt>Kategorie</dt>
        <dd>{titel.category}</dd>
        {titel.isbn && (
          <>
            <dt>ISBN</dt>
            <dd>{titel.isbn}</dd>
          </>
        )}
        {titel.publicationYear !== null && (
          <>
            <dt>Erscheinungsjahr</dt>
            <dd>{titel.publicationYear}</dd>
          </>
        )}
        {titel.description && (
          <>
            <dt>Beschreibung</dt>
            <dd>{titel.description}</dd>
          </>
        )}
      </dl>

      {titel.meineVormerkung && (
        // F-10 AK-01.5, AK-03.3: eigener Stand statt der Aktion „Vormerken“
        <p className="meldung" role="status">
          {titel.meineVormerkung.status === "WARTEND"
            ? `Du hast diesen Titel vorgemerkt: Platz ${titel.meineVormerkung.position} in der Warteschlange.`
            : `Ein Exemplar liegt für dich bereit. Abholen (ausleihen) bis einschließlich ${formatiereDatum(titel.meineVormerkung.pickupDeadline)}.`}
        </p>
      )}

      <div className="aktionen">
        {k.sitzung?.role === "MITGLIED" && (
          <AusleihenKnopf titleId={titel.titleId} angeboten={titel.aktionen.ausleihen} />
        )}
        {k.sitzung === null && titel.exemplare.some((e) => e.status === "VERFUEGBAR") && (
          // AK-05.1: ausleihen nur nach Anmeldung; der Gast bekommt den Weg dorthin
          <p className="hinweis">
            Zum Ausleihen bitte{" "}
            <Link href={`/anmelden?weiter=${encodeURIComponent(`/titel/${titel.titleId}`)}`}>anmelden</Link>.
          </p>
        )}
        {titel.aktionen.vormerken &&
          (k.sitzung === null ? (
            // AK-03.3, OF-R2: ein Gast wird zur Anmeldung geleitet
            <Link className="knopf" href={`/anmelden?weiter=${encodeURIComponent(`/titel/${titel.titleId}`)}`}>
              Vormerken (Anmeldung nötig)
            </Link>
          ) : (
            // F-10 AK-01.5: aktive Aktion für Mitglieder
            <VormerkenKnopf titleId={titel.titleId} />
          ))}
      </div>

      <h2>Exemplare</h2>
      {titel.exemplare.length === 0 ? (
        <p>Zu diesem Titel gibt es noch keine Exemplare.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Inventarnummer</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {titel.exemplare.map((exemplar) => (
              <tr key={exemplar.inventoryNumber}>
                <td>{exemplar.inventoryNumber}</td>
                <td>{statusText(exemplar)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
