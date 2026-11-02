// F-11 · E06-US01-FR01 · Registrierung mit E-Mail und Passwort (Spec docs/specs/F-11_E06-US01.md)
// Nur Gast (Rechte-Matrix). Neue Konten sind immer Mitglied (OF-F11-1); das Passwort wird nur als Hash gespeichert (NFR03, ADR 003).
import { sql } from "drizzle-orm";
import { istEindeutigkeitsfehler, zeilen } from "../db";
import type { MitWeiterenFeldern } from "../eingabe";
import { erfolg, fehler, type Ergebnis } from "../ergebnis";
import type { Kontext } from "../kontext";
import { hashePasswort } from "./passwort";

// OF-F11-2: Grenzen der Eingabe (Annahme). 254 Zeichen ist die übliche Höchstlänge einer E-Mail-Adresse.
const EMAIL_MAX = 254;
const PASSWORT_MIN = 8;
const PASSWORT_MAX = 200;
// genau ein @, keine Leerzeichen, Domain mit Punkt
const EMAIL_FORM = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export type RegistrierungEingabe = { email: string; passwort: string } & MitWeiterenFeldern;

export const REGISTRIERUNG_FELDTEXTE = {
  email: "Bitte eine gültige E-Mail-Adresse mit höchstens 254 Zeichen eingeben.",
  passwort: `Das Passwort muss ${PASSWORT_MIN} bis ${PASSWORT_MAX} Zeichen lang sein.`,
} as const;

/** Klein geschriebene E-Mail ohne Leerzeichen am Rand oder `null`, wenn sie formal ungültig ist. */
function normaleEmail(wert: unknown): string | null {
  if (typeof wert !== "string") return null;
  const email = wert.trim().toLowerCase();
  return email.length > 0 && email.length <= EMAIL_MAX && EMAIL_FORM.test(email) ? email : null;
}

function passwortGueltig(wert: unknown): wert is string {
  return typeof wert === "string" && wert.length >= PASSWORT_MIN && wert.length <= PASSWORT_MAX;
}

export async function registrieren(k: Kontext, eingabe: RegistrierungEingabe): Promise<Ergebnis<{ userId: string }>> {
  // Rechte-Matrix: Registrieren nur als Gast; ein angemeldeter Nutzer legt kein zweites Konto an (Annahme)
  if (k.sitzung) return fehler("KEINE_BERECHTIGUNG");

  // AK-01.5: alle Feldfehler auf einmal melden; das Passwort selbst steht nie in der Antwort
  const email = normaleEmail(eingabe?.email);
  const felder: Record<string, string> = {};
  if (!email) felder.email = REGISTRIERUNG_FELDTEXTE.email;
  if (!passwortGueltig(eingabe?.passwort)) felder.passwort = REGISTRIERUNG_FELDTEXTE.passwort;
  if (!email || Object.keys(felder).length > 0) return fehler("VALIDIERUNG", felder);

  // AK-01.4: vergeben, auch in anderer Schreibweise (OF-F11-3)
  const [vorhanden] = zeilen<{ id: string }>(
    await k.db.execute(sql`SELECT id FROM users WHERE lower(email) = ${email} LIMIT 1`),
  );
  if (vorhanden) return fehler("EMAIL_VERGEBEN");

  // AK-01.2: scrypt mit Salt; AK-01.1, AK-01.6: Rolle immer MITGLIED, nie aus der Eingabe
  const hash = await hashePasswort(eingabe.passwort);
  try {
    const [neu] = zeilen<{ id: string }>(
      await k.db.execute(sql`
        INSERT INTO users (email, password_hash, role, created_at)
        VALUES (${email}, ${hash}, 'MITGLIED', ${k.uhr.jetzt()})
        RETURNING id`),
    );
    return erfolg({ userId: neu.id });
  } catch (e) {
    // gleichzeitige Registrierung derselben E-Mail: der eindeutige Index entscheidet
    if (istEindeutigkeitsfehler(e)) return fehler("EMAIL_VERGEBEN");
    throw e;
  }
}
