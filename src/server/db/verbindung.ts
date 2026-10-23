// Datenbank der laufenden App (ADR 002): gehostet über DATABASE_URL (PostgreSQL),
// sonst lokal mit PGlite in `.data/`. Die Verbindung wird einmal je Prozess aufgebaut.
import path from "node:path";
import { mkdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { erstelleDatenbank, wendeMigrationenAn, type Datenbank } from "./index";
import * as schema from "./schema";
import { legeEntwicklungsdatenAn } from "./seed";

const speicher = globalThis as unknown as { bibliothekDatenbank?: Promise<Datenbank> };

/**
 * PGlite findet seine WASM- und Datendateien über `import.meta.url`. Im gebauten Next-Server
 * schlägt das fehl, deshalb werden die Dateien hier ausdrücklich aus node_modules geladen.
 */
async function ladePgliteDateien() {
  const ordner = path.join(process.cwd(), "node_modules", "@electric-sql", "pglite", "dist");
  const [pglite, initdb, daten] = await Promise.all([
    readFile(path.join(ordner, "pglite.wasm")),
    readFile(path.join(ordner, "initdb.wasm")),
    readFile(path.join(ordner, "pglite.data")),
  ]);
  return {
    pgliteWasmModule: await WebAssembly.compile(pglite),
    initdbWasmModule: await WebAssembly.compile(initdb),
    fsBundle: new Blob([daten]),
  };
}

async function verbinde(): Promise<Datenbank> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const db = drizzle(postgres(url), { schema });
    await wendeMigrationenAn(db);
    return db;
  }
  const ordner = path.join(process.cwd(), ".data");
  await mkdir(ordner, { recursive: true });
  const db = await erstelleDatenbank(
    new PGlite({ dataDir: path.join(ordner, "pglite"), ...(await ladePgliteDateien()) }),
  );
  // Seed-Nutzer und Beispielbestand nur in der lokalen Entwicklung (ADR 003, Punkt 5)
  if (process.env.NODE_ENV === "development") await legeEntwicklungsdatenAn(db, ordner);
  return db;
}

export function holeDatenbank(): Promise<Datenbank> {
  speicher.bibliothekDatenbank ??= verbinde().catch((fehler) => {
    speicher.bibliothekDatenbank = undefined;
    throw fehler;
  });
  return speicher.bibliothekDatenbank;
}
