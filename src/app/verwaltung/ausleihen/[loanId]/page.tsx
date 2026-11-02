// F-13 · E07-US01-FR02 · Seite eines Ausleihvorgangs in der Verwaltung (AK-02.4, OF-F13-3; nur Bibliothekar)
import Link from "next/link";
import { formatiereDatum } from "@/lib/datum";
import { formatiereCent } from "@/lib/geld";
import { erstelleKontext } from "@/server/anfrage";
import { ladeVorgang } from "@/server/dashboard";
import { Zugriffsfehler } from "../../../zugriff";

export const instant = false;

const ZEIT = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", dateStyle: "medium", timeStyle: "short" });

export default async function VorgangSeite({ params }: PageProps<"/verwaltung/ausleihen/[loanId]">) {
  const { loanId } = await params;
  const ergebnis = await ladeVorgang(await erstelleKontext(), loanId);
  if (!ergebnis.ok) return <Zugriffsfehler fehler={ergebnis.fehler} pfad={`/verwaltung/ausleihen/${loanId}`} />;
  const v = ergebnis.daten;

  return (
    <>
      <p>
        <Link href="/verwaltung/dashboard">Zurück zum Dashboard</Link>
      </p>
      <h1>Ausleihvorgang</h1>
      <dl className="metadaten">
        <dt>Titel</dt>
        <dd>{v.title}</dd>
        <dt>Inventarnummer</dt>
        <dd>{v.inventoryNumber}</dd>
        <dt>Mitglied</dt>
        <dd>{v.mitgliedEmail}</dd>
        <dt>Ausgeliehen am</dt>
        <dd>{formatiereDatum(v.startDate)}</dd>
        <dt>Fällig am</dt>
        <dd>{formatiereDatum(v.dueDate)}</dd>
        <dt>Verlängerungen</dt>
        <dd>{v.renewalCount}</dd>
        <dt>Überfällig seit</dt>
        <dd>{v.overdueSince ? formatiereDatum(v.overdueSince) : "–"}</dd>
        <dt>Zurückgegeben</dt>
        <dd>{v.returnedAt ? ZEIT.format(new Date(v.returnedAt)) : "noch offen"}</dd>
      </dl>

      <h2>Mahnung</h2>
      {v.mahnung ? (
        <dl className="metadaten">
          <dt>Erstellt am</dt>
          <dd>{formatiereDatum(v.mahnung.createdOn)}</dd>
          <dt>Gebühr</dt>
          <dd>{formatiereCent(v.mahnung.gebuehrCents)}</dd>
          <dt>Status</dt>
          <dd>
            {v.mahnung.beglichen ? "beglichen" : "offen"} · <Link href="/verwaltung/mahnungen">zu den Mahnungen</Link>
          </dd>
        </dl>
      ) : (
        <p>Zu diesem Vorgang gibt es keine Mahnung.</p>
      )}
    </>
  );
}
