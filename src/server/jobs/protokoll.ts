// Protokoll der System-Jobs (ADR 007 Punkt 5): Start, Ende und Anzahlen aus der Datenbank in `job_runs`.
import { sql } from "drizzle-orm";
import type { Datum } from "@/lib/datum";
import { zeilen, type Datenbank } from "../db";
import type { JOBS } from "../db/schema";

export async function protokolliereLauf<T extends Record<string, number>>(
  db: Datenbank,
  job: (typeof JOBS)[number],
  stichtag: Datum,
  jetzt: Date,
  arbeit: () => Promise<T>,
): Promise<T> {
  const [lauf] = zeilen<{ id: string }>(
    await db.execute(sql`INSERT INTO job_runs (job, stichtag, started_at) VALUES (${job}, ${stichtag}, ${jetzt}) RETURNING id`),
  );
  const anzahlen = await arbeit();
  await db.execute(sql`
    UPDATE job_runs SET finished_at = ${new Date()}, ergebnis = ${JSON.stringify(anzahlen)}::jsonb WHERE id = ${lauf.id}`);
  return anzahlen;
}
