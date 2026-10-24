// F-03 · E02-US01-FR02, FR03 · Titel bearbeiten und archivieren
import Link from "next/link";
import { erstelleKontext } from "@/server/anfrage";
import { ladeExemplareDesTitels, type ExemplarInDerVerwaltung } from "@/server/exemplare";
import { ladeTitelZurBearbeitung } from "@/server/titel";
import { statusText, ZUSTAND_TEXT } from "../../../exemplarstatus-text";
import { Zugriffsfehler } from "../../../zugriff";
import { TitelFormular } from "../titel-formular";
import { ArchivierenKnopf } from "./archivieren-knopf";
import { ExemplarAnlegen, ZustandAendern } from "./exemplar-formulare";

export const instant = false;

export default async function TitelBearbeiten({ params, searchParams }: PageProps<"/verwaltung/titel/[titleId]">) {
  const [{ titleId }, { gespeichert, archiviert }] = await Promise.all([params, searchParams]);
  const k = await erstelleKontext();
  const [ergebnis, exemplarErgebnis] = await Promise.all([
    ladeTitelZurBearbeitung(k, titleId),
    ladeExemplareDesTitels(k, titleId),
  ]);
  if (!ergebnis.ok) return <Zugriffsfehler fehler={ergebnis.fehler} pfad={`/verwaltung/titel/${titleId}`} />;
  const titel = ergebnis.daten;
  const exemplare = exemplarErgebnis.ok ? exemplarErgebnis.daten : [];

  return (
    <>
      <p>
        <Link href="/verwaltung/titel">Zurück zur Übersicht</Link>
      </p>
      <h1>{titel.title}</h1>
      {gespeichert && (
        <p className="meldung erfolg" role="status">
          Gespeichert.
        </p>
      )}
      {archiviert && (
        <p className="meldung erfolg" role="status">
          Der Titel ist archiviert und erscheint nicht mehr im Katalog.
        </p>
      )}

      {titel.archiviert ? (
        // AK-03.8, OF-F03-3: archivierte Titel werden nicht bearbeitet oder reaktiviert
        <>
          <p className="hinweis">Dieser Titel ist archiviert. Er kann nicht mehr bearbeitet werden.</p>
          <dl className="metadaten">
            <dt>Autor</dt>
            <dd>{titel.author}</dd>
            <dt>Kategorie</dt>
            <dd>{titel.category}</dd>
          </dl>
          <h2>Exemplare</h2>
          <Exemplarliste titleId={titel.titleId} exemplare={exemplare} bearbeitbar={false} />
        </>
      ) : (
        <>
          <p>
            <Link href={`/titel/${titel.titleId}`}>Im Katalog ansehen</Link>
          </p>
          <TitelFormular
            titleId={titel.titleId}
            werte={{
              title: titel.title,
              author: titel.author,
              category: titel.category,
              isbn: titel.isbn ?? "",
              description: titel.description ?? "",
              publicationYear: titel.publicationYear === null ? "" : String(titel.publicationYear),
            }}
          />
          <h2>Exemplare</h2>
          <ExemplarAnlegen titleId={titel.titleId} />
          <Exemplarliste titleId={titel.titleId} exemplare={exemplare} bearbeitbar />
          <h2>Archivieren</h2>
          <p className="hinweis">Nur möglich, wenn kein Exemplar ausgeliehen oder vorgemerkt ist.</p>
          <ArchivierenKnopf titleId={titel.titleId} />
        </>
      )}
    </>
  );
}

/** E02-US02: Inventarnummer, Zustand und abgeleiteter Status; Exemplare werden nie gelöscht (OF-F04-3). */
function Exemplarliste({
  titleId,
  exemplare,
  bearbeitbar,
}: {
  titleId: string;
  exemplare: ExemplarInDerVerwaltung[];
  bearbeitbar: boolean;
}) {
  if (exemplare.length === 0) return <p>Zu diesem Titel gibt es noch keine Exemplare.</p>;
  return (
    <table>
      <thead>
        <tr>
          <th>Inventarnummer</th>
          <th>Status</th>
          <th>Zustand</th>
        </tr>
      </thead>
      <tbody>
        {exemplare.map((exemplar) => (
          <tr key={exemplar.copyId}>
            <td>{exemplar.inventoryNumber}</td>
            <td>{statusText(exemplar)}</td>
            <td>
              {bearbeitbar ? (
                <ZustandAendern
                  titleId={titleId}
                  copyId={exemplar.copyId}
                  inventoryNumber={exemplar.inventoryNumber}
                  condition={exemplar.condition}
                />
              ) : (
                ZUSTAND_TEXT[exemplar.condition]
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
