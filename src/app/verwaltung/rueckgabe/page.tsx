// F-07 · E03-US03 · Rückgabe erfassen (nur Bibliothekar)
import { erstelleKontext } from "@/server/anfrage";
import { pruefeRolle } from "@/server/auth/rechte";
import { Zugriffsfehler } from "../../zugriff";
import { RueckgabeFormular } from "./rueckgabe-formular";

export const instant = false;

export default async function Rueckgabe() {
  const abgelehnt = pruefeRolle((await erstelleKontext()).sitzung, "BIBLIOTHEKAR");
  if (abgelehnt) return <Zugriffsfehler fehler={abgelehnt.fehler} pfad="/verwaltung/rueckgabe" />;

  return (
    <>
      <h1>Rückgabe erfassen</h1>
      <p className="hinweis">Inventarnummer eingeben oder scannen. Bindestriche und Leerzeichen sind egal.</p>
      <RueckgabeFormular />
    </>
  );
}
