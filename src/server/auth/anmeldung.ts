// Anmeldung mit E-Mail und Passwort, Sitzungen in der Datenbank (ADR 003, E06-US01-FR01).
// Im Cookie steht nur ein zufälliges Token, in der Datenbank nur dessen SHA-256-Hash.
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import type { Datenbank } from "../db";
import { sessions, users } from "../db/schema";
import type { Sitzung } from "../kontext";
import { getSetting } from "../settings";
import { gesperrtBis, merkeFehlversuch, vergissFehlversuche } from "./anmeldeschutz";
import { hashePasswort, pruefePasswort } from "./passwort";

/** Laufzeit einer Sitzung: technischer Wert der Konfigurationsrolle (ADR 003), über die Einstellungen (ADR 006). */
async function sitzungsDauerMs(db: Datenbank): Promise<number> {
  return (await getSetting(db, "sitzungDauerStunden")) * 3_600_000;
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

export type AnmeldeErgebnis = { ok: true; sitzung: Sitzung } | { ok: false; grund: "FALSCH" } | { ok: false; grund: "GESPERRT"; bis: Date };

/**
 * Anmeldung mit Schutz gegen Passwort-Raten (NFR03, Issue #47): Während einer Sperre wird das Passwort
 * gar nicht erst geprüft, auch ein richtiges nicht. Jeder Fehlversuch wird gezählt, Erfolg setzt die Zählung zurück.
 */
export async function meldeAn(db: Datenbank, email: string, passwort: string, jetzt: Date): Promise<AnmeldeErgebnis> {
  const gesperrt = await gesperrtBis(db, email, jetzt);
  if (gesperrt) return { ok: false, grund: "GESPERRT", bis: gesperrt };
  const sitzung = await pruefeZugangsdaten(db, email, passwort);
  if (sitzung) {
    await vergissFehlversuche(db, email);
    return { ok: true, sitzung };
  }
  const neueSperre = await merkeFehlversuch(db, email, jetzt);
  return neueSperre ? { ok: false, grund: "GESPERRT", bis: neueSperre } : { ok: false, grund: "FALSCH" };
}

/** Legt eine Sitzung an und gibt das Token für das Cookie zurück. */
export async function erzeugeSitzung(db: Datenbank, userId: string, jetzt: Date): Promise<{ token: string; ablauf: Date }> {
  const token = randomBytes(32).toString("base64url");
  const ablauf = new Date(jetzt.getTime() + (await sitzungsDauerMs(db)));
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
