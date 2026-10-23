// F-03 · E02-US01-FR02, FR03 · Titel bearbeiten und archivieren
import Link from "next/link";
import { erstelleKontext } from "@/server/anfrage";
import { ladeTitelZurBearbeitung } from "@/server/titel";
import { Zugriffsfehler } from "../../../zugriff";
import { TitelFormular } from "../titel-formular";
import { ArchivierenKnopf } from "./archivieren-knopf";

export const instant = false;

export default async function TitelBearbeiten({ params, searchParams }: PageProps<"/verwaltung/titel/[titleId]">) {
  const [{ titleId }, { gespeichert, archiviert }] = await Promise.all([params, searchParams]);
  const ergebnis = await ladeTitelZurBearbeitung(await erstelleKontext(), titleId);
  if (!ergebnis.ok) return <Zugriffsfehler fehler={ergebnis.fehler} pfad={`/verwaltung/titel/${titleId}`} />;
  const titel = ergebnis.daten;

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
          <h2>Archivieren</h2>
          <p className="hinweis">Nur möglich, wenn kein Exemplar ausgeliehen oder vorgemerkt ist.</p>
          <ArchivierenKnopf titleId={titel.titleId} />
        </>
      )}
    </>
  );
}
