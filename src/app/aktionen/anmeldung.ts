"use server";
// Anmelden und Abmelden (ADR 003, E06-US01-FR01). Registrierung: aktionen/registrierung.ts (F-11).
import { redirect } from "next/navigation";
import { pruefeZugangsdaten } from "@/server/auth/anmeldung";
import { beendeAktuelleSitzung, starteSitzung } from "@/server/auth/sitzung";
import { holeDatenbank } from "@/server/db/verbindung";
import { sicheresZiel } from "../sicheres-ziel";

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
