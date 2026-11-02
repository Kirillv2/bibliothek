import Link from "next/link";
import { getSession } from "@/server/auth/sitzung";
import { zaehleUngeleseneBenachrichtigungen } from "@/server/benachrichtigungen";
import { holeDatenbank } from "@/server/db/verbindung";
import { systemUhr } from "@/server/kontext";
import { abmelden } from "./aktionen/anmeldung";
import { NavLink } from "./nav-link";

/** Menü je Rolle (Rechte-Matrix). Das Ausblenden ist nur Bedienhilfe; geprüft wird auf dem Server. */
export async function Navigation() {
  const sitzung = await getSession();
  const ungelesen = sitzung
    ? await zaehleUngeleseneBenachrichtigungen({ db: await holeDatenbank(), uhr: systemUhr, sitzung })
    : 0;
  return (
    <>
      <nav aria-label="Hauptmenü">
        <NavLink href="/">Katalog</NavLink>
        {sitzung?.role === "MITGLIED" && (
          <>
            <NavLink href="/konto/ausleihen">Meine Ausleihen</NavLink>
            <NavLink href="/konto/vormerkungen">Meine Vormerkungen</NavLink>
          </>
        )}
        {sitzung?.role === "BIBLIOTHEKAR" && (
          <>
            <NavLink href="/verwaltung/dashboard">Dashboard</NavLink>
            <NavLink href="/verwaltung/titel">Titel verwalten</NavLink>
            <NavLink href="/verwaltung/rueckgabe">Rückgabe erfassen</NavLink>
            <NavLink href="/verwaltung/mahnungen">Mahnungen</NavLink>
          </>
        )}
        {sitzung?.role === "ADMINISTRATOR" && (
          <>
            <NavLink href="/admin/nutzer">Nutzer und Rollen</NavLink>
            <NavLink href="/admin/parameter">Systemparameter</NavLink>
          </>
        )}
        {sitzung && (
          <NavLink href="/konto/benachrichtigungen">
            Benachrichtigungen
            {ungelesen > 0 && (
              <span className="zaehler">
                {ungelesen}
                <span className="nur-vorleser"> ungelesen</span>
              </span>
            )}
          </NavLink>
        )}
      </nav>
      {sitzung ? (
        <form action={abmelden}>
          <button type="submit" className="leise">
            Abmelden
          </button>
        </form>
      ) : (
        <Link href="/anmelden" className="knopf leise">
          Anmelden
        </Link>
      )}
    </>
  );
}
