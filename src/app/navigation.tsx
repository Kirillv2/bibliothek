import Link from "next/link";
import { getSession } from "@/server/auth/sitzung";
import { zaehleUngeleseneBenachrichtigungen } from "@/server/benachrichtigungen";
import { holeDatenbank } from "@/server/db/verbindung";
import { systemUhr } from "@/server/kontext";
import { abmelden } from "./aktionen/anmeldung";

/** Menü je Rolle (Rechte-Matrix). Das Ausblenden ist nur Bedienhilfe; geprüft wird auf dem Server. */
export async function Navigation() {
  const sitzung = await getSession();
  const ungelesen = sitzung
    ? await zaehleUngeleseneBenachrichtigungen({ db: await holeDatenbank(), uhr: systemUhr, sitzung })
    : 0;
  return (
    <>
      <nav aria-label="Hauptmenü">
        <Link href="/">Katalog</Link>
        {sitzung?.role === "MITGLIED" && (
          <>
            <Link href="/konto/ausleihen">Meine Ausleihen</Link>
            <Link href="/konto/vormerkungen">Meine Vormerkungen</Link>
          </>
        )}
        {sitzung?.role === "BIBLIOTHEKAR" && (
          <>
            <Link href="/verwaltung/titel">Titel verwalten</Link>
            <Link href="/verwaltung/rueckgabe">Rückgabe erfassen</Link>
            <Link href="/verwaltung/mahnungen">Mahnungen</Link>
          </>
        )}
        {sitzung?.role === "ADMINISTRATOR" && (
          <>
            <Link href="/admin/nutzer">Nutzer und Rollen</Link>
            <Link href="/admin/parameter">Systemparameter</Link>
          </>
        )}
        {sitzung && (
          <Link href="/konto/benachrichtigungen">
            Benachrichtigungen{ungelesen > 0 && <span className="zaehler"> ({ungelesen})</span>}
          </Link>
        )}
      </nav>
      {sitzung ? (
        <form action={abmelden}>
          <button type="submit" className="leise">
            Abmelden
          </button>
        </form>
      ) : (
        <Link href="/anmelden">Anmelden</Link>
      )}
    </>
  );
}
