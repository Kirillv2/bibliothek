// Datenbankzugriff (ADR 002): PostgreSQL über Drizzle ORM.
// Tests und lokale Entwicklung nutzen PGlite, gehostet kommt die Verbindung aus DATABASE_URL.
import type { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/pglite";
import { MIGRATIONEN } from "./migrationen";
import * as schema from "./schema";

export type Schema = typeof schema;

/** Die Datenbank, mit der die Anwendungsschicht arbeitet (Teil des Kontexts, ADR 004). */
export type Datenbank = PgDatabase<PgQueryResultHKT, Schema>;

/** Wendet alle noch fehlenden Migrationen an. Läuft unter einer Sperre, damit gleichzeitige Starts sich nicht stören. */
export async function wendeMigrationenAn(db: Datenbank): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(4711)`);
    await tx.execute(sql`CREATE SCHEMA IF NOT EXISTS bibliothek_intern`);
    await tx.execute(
      sql`CREATE TABLE IF NOT EXISTS bibliothek_intern.migrationen (id text PRIMARY KEY, angewendet_am timestamptz NOT NULL DEFAULT now())`,
    );
    const angewendet = await tx.execute(sql`SELECT id FROM bibliothek_intern.migrationen`);
    const ids = new Set(zeilen<{ id: string }>(angewendet).map((z) => z.id));
    for (const migration of MIGRATIONEN) {
      if (ids.has(migration.id)) continue;
      for (const anweisung of migration.anweisungen) await tx.execute(sql.raw(anweisung));
      await tx.execute(sql`INSERT INTO bibliothek_intern.migrationen (id) VALUES (${migration.id})`);
    }
  });
}

/**
 * Vertrag mit Testing (docs/testing/README.md): wendet alle Migrationen auf die übergebene
 * PGlite-Instanz an und gibt die Datenbank für die Anwendungsschicht zurück.
 */
export async function erstelleDatenbank(client: PGlite): Promise<Datenbank> {
  const db = drizzle(client, { schema });
  await wendeMigrationenAn(db);
  return db;
}

/** Zeilen eines `execute`-Ergebnisses, unabhängig vom Treiber (PGlite: `{ rows }`, postgres-js: Array). */
export function zeilen<T>(ergebnis: unknown): T[] {
  if (Array.isArray(ergebnis)) return ergebnis as T[];
  return ((ergebnis as { rows?: T[] }).rows ?? []) as T[];
}

/** PostgreSQL-Fehlercode eines Datenbankfehlers (auch wenn Drizzle ihn einpackt). */
export function fehlercodeDerDatenbank(fehler: unknown): string | undefined {
  let aktuell: unknown = fehler;
  for (let i = 0; i < 5 && aktuell && typeof aktuell === "object"; i++) {
    const code = (aktuell as { code?: unknown }).code;
    if (typeof code === "string") return code;
    aktuell = (aktuell as { cause?: unknown }).cause;
  }
  return undefined;
}

/** Verletzung eines eindeutigen Index (z. B. NFR06: zweiter offener Ausleihvorgang). */
export function istEindeutigkeitsfehler(fehler: unknown): boolean {
  return fehlercodeDerDatenbank(fehler) === "23505";
}
