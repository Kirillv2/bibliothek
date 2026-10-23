// Anmeldung mit E-Mail und Passwort, Sitzungen in der Datenbank (ADR 003, E06-US01-FR01).
// Im Cookie steht nur ein zufälliges Token, in der Datenbank nur dessen SHA-256-Hash.
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import type { Datenbank } from "../db";
import { sessions, users } from "../db/schema";
import type { Sitzung } from "../kontext";
import { hashePasswort, pruefePasswort } from "./passwort";

/**
 * Laufzeit einer Sitzung. Annahme: technischer Wert der Konfigurationsrolle (ADR 003), steht noch nicht in config/;
 * bis dahin aus der Umgebung (SITZUNG_DAUER_STUNDEN), sonst ein Arbeitstag.
 */
function sitzungsDauerMs(): number {
  const stunden = Number(process.env.SITZUNG_DAUER_STUNDEN);
  return (Number.isFinite(stunden) && stunden > 0 ? stunden : 8) * 3_600_000;
}

function hasheToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Vergleichswert, damit eine unbekannte E-Mail genauso lange prüft wie ein falsches Passwort
let platzhalterHash: Promise<string> | undefined;

/** Prüft E-Mail und Passwort. Bei unbekannter E-Mail und falschem Passwort gleiche Antwort (`null`). */
export async function pruefeZugangsdaten(db: Datenbank, email: string, passwort: string): Promise<Sitzung | null> {
  const [nutzer] = await db
    .select({ id: users.id, role: users.role, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()))
    .limit(1);
  platzhalterHash ??= hashePasswort(randomBytes(16).toString("hex"));
  const passt = await pruefePasswort(passwort, nutzer?.passwordHash ?? (await platzhalterHash));
  return nutzer && passt ? { userId: nutzer.id, role: nutzer.role } : null;
}

/** Legt eine Sitzung an und gibt das Token für das Cookie zurück. */
export async function erzeugeSitzung(db: Datenbank, userId: string, jetzt: Date): Promise<{ token: string; ablauf: Date }> {
  const token = randomBytes(32).toString("base64url");
  const ablauf = new Date(jetzt.getTime() + sitzungsDauerMs());
  await db.insert(sessions).values({ userId, tokenHash: hasheToken(token), expiresAt: ablauf });
  return { token, ablauf };
}

/** Sitzung zum Token, wenn sie noch gültig ist. */
export async function findeSitzung(db: Datenbank, token: string, jetzt: Date): Promise<Sitzung | null> {
  const [treffer] = await db
    .select({ userId: users.id, role: users.role })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, hasheToken(token)), gt(sessions.expiresAt, jetzt)))
    .limit(1);
  return treffer ?? null;
}

/** Abmelden löscht die Sitzung (ADR 003). */
export async function beendeSitzung(db: Datenbank, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, hasheToken(token)));
}
