// Kontext für Seiten und Server Actions (ADR 004): Datenbank, echte Uhr und Sitzung aus dem Cookie.
import { connection } from "next/server";
import { getSession } from "./auth/sitzung";
import { holeDatenbank } from "./db/verbindung";
import { systemUhr, type Kontext } from "./kontext";

// Datenbankzugriffe gehören immer zur Anfrage und werden nie vorab gerendert (`connection()`).
export async function erstelleKontext(): Promise<Kontext> {
  await connection();
  const [db, sitzung] = await Promise.all([holeDatenbank(), getSession()]);
  return { db, uhr: systemUhr, sitzung };
}

/** Kontext ohne Sitzung für öffentliche Lese-Funktionen (Katalog), die für alle Rollen gleich antworten. */
export async function erstelleOeffentlichenKontext(): Promise<Kontext> {
  await connection();
  return { db: await holeDatenbank(), uhr: systemUhr, sitzung: null };
}
