"use server";
// F-11 · E06-US01-FR01 · Registrierung in einem Formular (NFR01); danach gleich angemeldet (OF-F11-4).
// Prüfungen in `registrieren()`; die Rolle kommt nie aus dem Formular (AK-01.6).
import { redirect } from "next/navigation";
import { erstelleKontext } from "@/server/anfrage";
import { registrieren } from "@/server/auth/registrierung";
import { starteSitzung } from "@/server/auth/sitzung";
import { FEHLERTEXTE } from "../meldungen";
import { sicheresZiel } from "../sicheres-ziel";

/** Stand des Formulars: Meldung, Feldfehler und die eingegebene E-Mail (nie das Passwort). */
export type RegistrierungStand = { text: string; felder?: Record<string, string>; email?: string } | null;

export async function registrierungAbsenden(_vorher: RegistrierungStand, formular: FormData): Promise<RegistrierungStand> {
  const k = await erstelleKontext();
  const ziel = sicheresZiel(formular.get("weiter"));
  // Rechte-Matrix: Registrieren nur als Gast; wer angemeldet ist, kommt zur Startseite
  if (k.sitzung) redirect("/");

  const email = formular.get("email");
  const passwort = formular.get("passwort");
  const ergebnis = await registrieren(k, {
    email: typeof email === "string" ? email : "",
    passwort: typeof passwort === "string" ? passwort : "",
  });
  if (!ergebnis.ok) {
    return {
      text: FEHLERTEXTE[ergebnis.fehler],
      ...(ergebnis.felder ? { felder: ergebnis.felder } : {}),
      email: typeof email === "string" ? email : "",
    };
  }
  // AK-01.7: gleich angemeldet; AK-02.5: zurück auf die Seite, von der die Anmeldung kam
  await starteSitzung(ergebnis.daten.userId);
  redirect(ziel);
}
