// F-12 · E06-US02-FR02 · Systemparameter konfigurieren (nur Administrator). Grenzen aus config/system.defaults.json (ADR 006).
import { erstelleKontext } from "@/server/anfrage";
import { ladeSystemparameter } from "@/server/administration";
import type { EinstellungName } from "@/server/settings";
import { Zugriffsfehler } from "../../zugriff";
import { ParameterFormular } from "./parameter-formular";

export const instant = false;

const BEZEICHNUNG: Record<EinstellungName, { text: string; einheit: string }> = {
  leihfristTage: { text: "Standard-Leihfrist", einheit: "Tage" },
  ausleihlimitProMitglied: { text: "Ausleihlimit pro Mitglied", einheit: "Ausleihen" },
  maxVerlaengerungen: { text: "Maximale Verlängerungen", einheit: "je Ausleihe" },
  mahnTagessatzEuro: { text: "Mahn-Tagessatz", einheit: "Euro pro Tag" },
  erinnerungVorlaufTage: { text: "Erinnerung vor Fälligkeit", einheit: "Tage" },
  abholfristVormerkungTage: { text: "Abholfrist für Vormerkungen", einheit: "Tage" },
  sitzungDauerStunden: { text: "Dauer einer Anmeldung", einheit: "Stunden" },
};

const zahl = (wert: number) => String(wert).replace(".", ",");

export default async function ParameterSeite() {
  const ergebnis = await ladeSystemparameter(await erstelleKontext());
  if (!ergebnis.ok) return <Zugriffsfehler fehler={ergebnis.fehler} pfad="/admin/parameter" />;

  return (
    <>
      <h1>Systemparameter</h1>
      <p className="hinweis">Ein neuer Wert gilt ab sofort für neue Vorgänge. Bestehende Fälligkeiten ändern sich nicht.</p>
      <div className="tabelle-rahmen">
        <table>
          <thead>
            <tr>
              <th>Parameter</th>
              <th>Aktuell</th>
              <th>Standard</th>
              <th>Erlaubt</th>
              <th>Ändern</th>
            </tr>
          </thead>
          <tbody>
            {ergebnis.daten.map((p) => {
              const b = BEZEICHNUNG[p.name] ?? { text: p.name, einheit: "" };
              return (
                <tr key={p.name}>
                  <td>
                    {b.text}
                    <br />
                    <span className="hinweis">{p.quelle}</span>
                  </td>
                  <td>
                    {zahl(p.wert)} {b.einheit}
                  </td>
                  <td>{zahl(p.standard)}</td>
                  <td>
                    {zahl(p.min)} bis {zahl(p.max)}
                  </td>
                  <td>
                    <ParameterFormular
                      name={p.name}
                      bezeichnung={b.text}
                      wert={p.wert}
                      min={p.min}
                      max={p.max}
                      schritt={p.name === "mahnTagessatzEuro" ? "0,01" : "1"}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
