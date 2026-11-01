// F-11 · E06-US01 · Registrierung (nur Gast). Ein angemeldeter Nutzer wird zur Startseite geleitet.
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/server/auth/sitzung";
import { RegistrierungFormular } from "./formular";

export const instant = false;

export default async function RegistrierenSeite({ searchParams }: PageProps<"/registrieren">) {
  if (await getSession()) redirect("/");
  const { weiter } = await searchParams;
  const ziel = typeof weiter === "string" ? weiter : "/";
  return (
    <>
      <h1>Registrieren</h1>
      <p>Mit einem Konto kannst du Titel ausleihen, verlängern und vormerken.</p>
      <RegistrierungFormular ziel={ziel} />
      <p className="hinweis">
        Schon registriert? <Link href={`/anmelden?weiter=${encodeURIComponent(ziel)}`}>Anmelden</Link>
      </p>
    </>
  );
}
