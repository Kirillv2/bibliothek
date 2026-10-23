import Link from "next/link";
import { getSession } from "@/server/auth/sitzung";
import { abmelden } from "./aktionen/anmeldung";

/** Menü je Rolle (Rechte-Matrix). Das Ausblenden ist nur Bedienhilfe; geprüft wird auf dem Server. */
export async function Navigation() {
  const sitzung = await getSession();
  return (
    <>
      <nav aria-label="Hauptmenü">
        <Link href="/">Katalog</Link>
        {sitzung?.role === "MITGLIED" && <Link href="/konto/ausleihen">Meine Ausleihen</Link>}
        {sitzung?.role === "BIBLIOTHEKAR" && (
          <>
            <Link href="/verwaltung/titel">Titel verwalten</Link>
            <Link href="/verwaltung/rueckgabe">Rückgabe erfassen</Link>
          </>
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
