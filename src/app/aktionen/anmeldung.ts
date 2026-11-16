"use server";
// Anmelden und Abmelden (ADR 003, E06-US01-FR01). Registrierung: aktionen/registrierung.ts (F-11).
import { redirect } from "next/navigation";
import { meldeAn } from "@/server/auth/anmeldung";
import { beendeAktuelleSitzung, starteSitzung } from "@/server/auth/sitzung";
import { holeDatenbank } from "@/server/db/verbindung";
import { sicheresZiel } from "../sicheres-ziel";

export async function anmelden(formular: FormData): Promise<void> {
  const email = formular.get("email");
  const passwort = formular.get("passwort");
  const ziel = sicheresZiel(formular.get("weiter"));
  const ergebnis =
    typeof email === "string" && typeof passwort === "string" && email.trim() !== "" && passwort !== ""
      ? await meldeAn(await holeDatenbank(), email, passwort, new Date())
      : null;
  if (!ergebnis?.ok) {
    // gleiche Meldung für unbekannte E-Mail und falsches Passwort (security-architektur.md 3);
    // nach zu vielen Fehlversuchen eigene Meldung (NFR03, Issue #47), ebenfalls gleich für beide Fälle
    const fehler = ergebnis?.grund === "GESPERRT" ? "gesperrt" : "1";
    redirect(`/anmelden?fehler=${fehler}&weiter=${encodeURIComponent(ziel)}`);
  }
  await starteSitzung(ergebnis.sitzung.userId);
  redirect(ziel);
}

export async function abmelden(): Promise<void> {
  await beendeAktuelleSitzung();
  redirect("/");
}
