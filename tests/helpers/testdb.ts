// Test-Datenbank mit PGlite (ADR 002): eine Instanz je Testdatei, vor jedem Test geleert.
//
// Vertrag mit Development (docs/testing/README.md):
//   `@/server/db` exportiert `erstelleDatenbank(client: PGlite)`. Die Funktion wendet alle
//   Migrationen auf die übergebene PGlite-Instanz an und gibt die Datenbank zurück, die
//   die Anwendungsschicht im Kontext erwartet.
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach } from "vitest";
import { erstelleDatenbank } from "@/server/db";
import { festeUhr, type Uhr } from "./uhr";

export type Rolle = "MITGLIED" | "BIBLIOTHEKAR" | "ADMINISTRATOR";

/** Angemeldeter Nutzer. Gast = `null` (ADR 003). */
export type Sitzung = { userId: string; role: Rolle };

export type Datenbank = Awaited<ReturnType<typeof erstelleDatenbank>>;

/** Kontext, den jede Funktion der Anwendungsschicht als ersten Parameter bekommt (ADR 004). */
export type Kontext = { db: Datenbank; uhr: Uhr; sitzung: Sitzung | null };

/** Standard-Stichtag der Tests, wenn ein Test keinen eigenen braucht. */
export const STANDARD_HEUTE = "2026-11-10";

export type TestDatenbank = {
  /** Direkter SQL-Zugriff zum Anlegen und Prüfen von Testdaten. */
  readonly pg: PGlite;
  readonly db: Datenbank;
  kontext(sitzung: Sitzung | null, uhr?: Uhr): Kontext;
};

/**
 * Registriert die Hooks für eine frische Datenbank je Testdatei.
 * Vor jedem Test werden alle Tabellen des Schemas `public` geleert.
 */
export function nutzeTestDatenbank(): TestDatenbank {
  let pg: PGlite | undefined;
  let db: Datenbank | undefined;

  beforeAll(async () => {
    pg = new PGlite();
    db = await erstelleDatenbank(pg);
  }, 120_000);

  beforeEach(async () => {
    await leereAlleTabellen(pg!);
  });

  afterAll(async () => {
    await pg?.close();
  });

  return {
    get pg() {
      if (!pg) throw new Error("Test-Datenbank noch nicht bereit");
      return pg;
    },
    get db() {
      if (!db) throw new Error("Test-Datenbank noch nicht bereit");
      return db;
    },
    kontext(sitzung, uhr = festeUhr(STANDARD_HEUTE)) {
      if (!db) throw new Error("Test-Datenbank noch nicht bereit");
      return { db, uhr, sitzung };
    },
  };
}

async function tabellen(pg: PGlite): Promise<string[]> {
  const { rows } = await pg.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
  );
  return rows.map((z) => z.tablename);
}

async function leereAlleTabellen(pg: PGlite): Promise<void> {
  const namen = await tabellen(pg);
  if (namen.length === 0) return;
  await pg.exec(`TRUNCATE TABLE ${namen.map((n) => `"${n}"`).join(", ")} RESTART IDENTITY CASCADE`);
}

/**
 * Inhalt aller Tabellen als Text. Damit prüfen Tests „ohne Wirkung in der Datenbank“:
 * Momentaufnahme vorher und nachher müssen gleich sein.
 */
export async function momentaufnahme(pg: PGlite): Promise<string> {
  const teile: string[] = [];
  for (const name of await tabellen(pg)) {
    const { rows } = await pg.query(`SELECT * FROM "${name}" ORDER BY 1`);
    teile.push(`${name}: ${JSON.stringify(rows)}`);
  }
  return teile.join("\n");
}

/** Anzahl Zeilen einer Abfrage `SELECT count(*) AS n …`. */
export async function zaehle(pg: PGlite, sql: string, parameter: unknown[] = []): Promise<number> {
  const { rows } = await pg.query<{ n: number | string }>(sql, parameter);
  return Number(rows[0]?.n ?? 0);
}
