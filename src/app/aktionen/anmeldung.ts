"use server";
// Anmelden und Abmelden (ADR 003). Woche 1: nur Seed-Nutzer, Registrierung folgt mit F-11.
import { redirect } from "next/navigation";
import { pruefeZugangsdaten } from "@/server/auth/anmeldung";
import { beendeAktuelleSitzung, starteSitzung } from "@/server/auth/sitzung";
import { holeDatenbank } from "@/server/db/verbindung";

const INTERN = "http://intern.invalid";

/**
 * Nur Pfade innerhalb der App als Ziel nach der Anmeldung (kein offener Redirect).
 * Aufgelöst wie im Browser: `/\host`, Tabulatoren oder `/.//host` dürfen nicht auf eine fremde Herkunft führen.
 */
function sicheresZiel(wert: FormDataEntryValue | null): string {
  if (typeof wert !== "string" || !wert.startsWith("/")) return "/";
  let url: URL;
  try {
    url = new URL(wert, INTERN);
  } catch {
    return "/";
  }
  const pfad = url.pathname + url.search + url.hash;
  return url.origin === INTERN && !pfad.startsWith("//") ? pfad : "/";
}

export async function anmelden(formular: FormData): Promise<void> {
  const email = formular.get("email");
  const passwort = formular.get("passwort");
  const ziel = sicheresZiel(formular.get("weiter"));
  const sitzung =
    typeof email === "string" && typeof passwort === "string" && email.trim() !== "" && passwort !== ""
      ? await pruefeZugangsdaten(await holeDatenbank(), email, passwort)
      : null;
  if (!sitzung) {
    // gleiche Meldung für unbekannte E-Mail und falsches Passwort (security-architektur.md 3)
    redirect(`/anmelden?fehler=1&weiter=${encodeURIComponent(ziel)}`);
  }
  await starteSitzung(sitzung.userId);
  redirect(ziel);
}

export async function abmelden(): Promise<void> {
  await beendeAktuelleSitzung();
  redirect("/");
}
