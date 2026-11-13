// Schutz gegen Passwort-Raten bei der Anmeldung (NFR03, E06-US01-FR01, Issue #47).
// Nach zu vielen Fehlversuchen in kurzer Zeit wird die Anmeldung für diese E-Mail-Adresse kurz gesperrt.
// Unbekannte und bekannte Adressen werden gleich behandelt, damit die Sperre nicht verrät, ob es ein Konto gibt.
//
// Annahme (Spec schweigt, Issue #47): Grenze und Dauer sind technische Sicherheitswerte wie PASSWORT_MIN
// (auth/registrierung.ts), keine fachlichen Konfigurationswerte aus `config/system.defaults.json`.
// Sollen sie in der App einstellbar werden, beantragt Planning sie per `config-request`.
import { createHash } from "node:crypto";
import { and, eq, gt, lt, or, isNull, sql } from "drizzle-orm";
import type { Datenbank } from "../db";
import { loginAttempts } from "../db/schema";

/** So viele Fehlversuche innerhalb des Zeitfensters führen zur Sperre. */
export const MAX_FEHLVERSUCHE = 5;
/** Zeitfenster, in dem Fehlversuche zusammengezählt werden, und Dauer der Sperre. */
export const SPERRE_MINUTEN = 15;

const FENSTER_MS = SPERRE_MINUTEN * 60_000;

/** Gleiche Normalisierung wie bei der Anmeldung (`pruefeZugangsdaten`). */
function emailSchluessel(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

/** Ende der Sperre, wenn die Adresse gerade gesperrt ist, sonst `null`. */
export async function gesperrtBis(db: Datenbank, email: string, jetzt: Date): Promise<Date | null> {
  const [zeile] = await db
    .select({ lockedUntil: loginAttempts.lockedUntil })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.emailHash, emailSchluessel(email)), gt(loginAttempts.lockedUntil, jetzt)))
    .limit(1);
  return zeile?.lockedUntil ?? null;
}

/**
 * Zählt einen Fehlversuch. Liegt der erste Versuch länger als das Zeitfenster zurück, beginnt die Zählung neu.
 * Ist die Grenze erreicht, wird die Adresse gesperrt. Gibt das Ende der Sperre zurück oder `null`.
 */
export async function merkeFehlversuch(db: Datenbank, email: string, jetzt: Date): Promise<Date | null> {
  const fensterBeginn = new Date(jetzt.getTime() - FENSTER_MS);
  const schluessel = emailSchluessel(email);
  // Ein einziges Upsert, damit gleichzeitige Versuche richtig gezählt werden
  const [zeile] = await db
    .insert(loginAttempts)
    .values({ emailHash: schluessel, failedCount: 1, windowStart: jetzt, lockedUntil: null })
    .onConflictDoUpdate({
      target: loginAttempts.emailHash,
      set: {
        failedCount: sql`CASE WHEN ${loginAttempts.windowStart} <= ${fensterBeginn} THEN 1 ELSE ${loginAttempts.failedCount} + 1 END`,
        windowStart: sql`CASE WHEN ${loginAttempts.windowStart} <= ${fensterBeginn} THEN ${jetzt} ELSE ${loginAttempts.windowStart} END`,
      },
    })
    .returning({ failedCount: loginAttempts.failedCount });

  // Alte Einträge ohne laufende Sperre aufräumen, damit die Tabelle nicht wächst
  await db
    .delete(loginAttempts)
    .where(
      and(
        lt(loginAttempts.windowStart, fensterBeginn),
        or(isNull(loginAttempts.lockedUntil), lt(loginAttempts.lockedUntil, jetzt)),
      ),
    );

  if (zeile.failedCount < MAX_FEHLVERSUCHE) return null;
  const ende = new Date(jetzt.getTime() + FENSTER_MS);
  await db
    .update(loginAttempts)
    .set({ lockedUntil: ende, failedCount: 0, windowStart: jetzt })
    .where(eq(loginAttempts.emailHash, schluessel));
  return ende;
}

/** Nach erfolgreicher Anmeldung zählen frühere Fehlversuche nicht mehr. */
export async function vergissFehlversuche(db: Datenbank, email: string): Promise<void> {
  await db.delete(loginAttempts).where(eq(loginAttempts.emailHash, emailSchluessel(email)));
}
