// F-12 · E06-US02-FR01 · Rollen zuweisen (nur Administrator)
import { erstelleKontext } from "@/server/anfrage";
import { ladeNutzer } from "@/server/administration";
import { Zugriffsfehler } from "../../zugriff";
import { ROLLENTEXT } from "../rollen-text";
import { RolleFormular } from "./rolle-formular";

export const instant = false;

export default async function NutzerSeite() {
  const k = await erstelleKontext();
  const ergebnis = await ladeNutzer(k);
  if (!ergebnis.ok) return <Zugriffsfehler fehler={ergebnis.fehler} pfad="/admin/nutzer" />;

  return (
    <>
      <h1>Nutzer und Rollen</h1>
      <p className="hinweis">Eine neue Rolle gilt sofort, auch wenn die Person gerade angemeldet ist.</p>
      <div className="tabelle-rahmen">
        <table>
          <thead>
            <tr>
              <th>E-Mail</th>
              <th>Rolle</th>
            </tr>
          </thead>
          <tbody>
            {ergebnis.daten.map((n) => (
              <tr key={n.userId}>
                <td>{n.email}</td>
                <td>
                  {n.userId === k.sitzung?.userId ? (
                    // OF-F12-1: die eigene Rolle ändert ein anderer Administrator
                    <span>
                      {ROLLENTEXT[n.role]} <span className="hinweis">(du selbst)</span>
                    </span>
                  ) : (
                    <RolleFormular userId={n.userId} email={n.email} role={n.role} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
