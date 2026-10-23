// Sitzung aus dem Cookie lesen und setzen (ADR 003). Nur auf dem Server verwenden.
import { cookies } from "next/headers";
import { connection } from "next/server";
import { holeDatenbank } from "../db/verbindung";
import type { Sitzung } from "../kontext";
import { beendeSitzung, erzeugeSitzung, findeSitzung } from "./anmeldung";
import { SITZUNGS_COOKIE } from "./cookie";

/** Angemeldeter Nutzer (`userId`, `role`) oder `null` für einen Gast. */
export async function getSession(): Promise<Sitzung | null> {
  const token = (await cookies()).get(SITZUNGS_COOKIE)?.value;
  if (!token) return null;
  // Gültigkeit hängt von der aktuellen Uhrzeit ab, also nie vorab rendern
  await connection();
  return findeSitzung(await holeDatenbank(), token, new Date());
}

export async function starteSitzung(userId: string): Promise<void> {
  const { token, ablauf } = await erzeugeSitzung(await holeDatenbank(), userId, new Date());
  (await cookies()).set(SITZUNGS_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: ablauf,
  });
}

export async function beendeAktuelleSitzung(): Promise<void> {
  const speicher = await cookies();
  const token = speicher.get(SITZUNGS_COOKIE)?.value;
  if (token) await beendeSitzung(await holeDatenbank(), token);
  speicher.delete(SITZUNGS_COOKIE);
}
