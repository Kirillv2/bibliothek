// F-03 · E02-US01-FR01 · Titel anlegen
import Link from "next/link";
import { erstelleKontext } from "@/server/anfrage";
import { pruefeRolle } from "@/server/auth/rechte";
import { Zugriffsfehler } from "../../../zugriff";
import { TitelFormular } from "../titel-formular";

export const instant = false;

export default async function NeuerTitel() {
  const k = await erstelleKontext();
  const abgelehnt = pruefeRolle(k.sitzung, "BIBLIOTHEKAR");
  if (abgelehnt) return <Zugriffsfehler fehler={abgelehnt.fehler} pfad="/verwaltung/titel/neu" />;

  return (
    <>
      <p>
        <Link href="/verwaltung/titel">Zurück zur Übersicht</Link>
      </p>
      <h1>Neuen Titel anlegen</h1>
      <TitelFormular werte={{ title: "", author: "", category: "", isbn: "", description: "", publicationYear: "" }} />
    </>
  );
}
