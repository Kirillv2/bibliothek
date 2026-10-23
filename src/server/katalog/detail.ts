// F-02 · E01-US02 · Detailseite eines Titels mit Exemplarstatus (Spec docs/specs/F-02_E01-US02.md)
// Für alle Rollen inkl. Gast; die Antwort enthält keine Personendaten (AK-01.7).
import { sql } from "drizzle-orm";
import type { Datum } from "@/lib/datum";
import { leiteExemplarstatusAb, type Exemplarstatus } from "@/lib/exemplarstatus";
import { zeilen, type Datenbank } from "../db";
import type { Zustand } from "../db/schema";
import { istUuid } from "../eingabe";
import { erfolg, fehler, type Ergebnis } from "../ergebnis";
import type { Kontext } from "../kontext";

export type ExemplarImDetail = { inventoryNumber: string; status: Exemplarstatus; faelligAm?: Datum };

export type TitelDetail = {
  titleId: string;
  title: string;
  author: string;
  category: string;
  isbn: string | null;
  description: string | null;
  publicationYear: number | null;
  exemplare: ExemplarImDetail[];
  aktionen: { ausleihen: boolean; vormerken: boolean };
};

/** AK-01.8, AK-01.9, OF-F02-3: nur bekannte, nicht archivierte Titel haben eine Detailseite. */
export async function titelIstSichtbar(db: Datenbank, titleId: string): Promise<boolean> {
  if (!istUuid(titleId)) return false;
  const [titel] = zeilen<{ id: string }>(
    await db.execute(sql`SELECT id FROM titles WHERE id = ${titleId} AND archived_at IS NULL`),
  );
  return titel !== undefined;
}

export async function ladeTitelDetail(k: Kontext, titleId: string): Promise<Ergebnis<TitelDetail>> {
  // AK-01.8: eine ID in falschem Format ist wie eine unbekannte ID
  if (!istUuid(titleId)) return fehler("NICHT_GEFUNDEN");

  // AK-01.9, OF-F02-3: archivierte Titel sind „nicht gefunden“.
  // Annahme: auch für Bibliothekar und Administrator; sie sehen archivierte Titel in der Verwaltung (F-03).
  const [titel] = zeilen<{
    id: string;
    title: string;
    author: string;
    category: string;
    isbn: string | null;
    description: string | null;
    publication_year: number | null;
  }>(
    await k.db.execute(sql`
      SELECT id, title, author, category, isbn, description, publication_year
      FROM titles WHERE id = ${titleId} AND archived_at IS NULL`),
  );
  if (!titel) return fehler("NICHT_GEFUNDEN");

  // AK-01.2, AK-01.10: alle Exemplare nach Inventarnummer, nur Fälligkeit und Zuordnung, keine Personen
  const exemplare = zeilen<{ inventory_number: string; condition: Zustand; due_date: Datum | null; abholbereit: boolean }>(
    await k.db.execute(sql`
      SELECT c.inventory_number, c.condition,
        (SELECT l.due_date::text FROM loans l WHERE l.copy_id = c.id AND l.returned_at IS NULL LIMIT 1) AS due_date,
        EXISTS (SELECT 1 FROM reservations r WHERE r.copy_id = c.id AND r.status = 'ABHOLBEREIT') AS abholbereit
      FROM copies c
      WHERE c.title_id = ${titleId}
      ORDER BY c.inventory_number`),
  ).map((z) => ({
    inventoryNumber: z.inventory_number,
    ...leiteExemplarstatusAb({
      condition: z.condition,
      offeneAusleihe: z.due_date ? { dueDate: z.due_date } : null,
      abholbereitZugeordnet: Boolean(z.abholbereit),
    }),
  }));

  const einesVerfuegbar = exemplare.some((e) => e.status === "VERFUEGBAR");
  const rolle = k.sitzung?.role ?? null;
  return erfolg({
    titleId: titel.id,
    title: titel.title,
    author: titel.author,
    category: titel.category,
    isbn: titel.isbn,
    description: titel.description,
    publicationYear: titel.publication_year === null ? null : Number(titel.publication_year),
    exemplare,
    aktionen: {
      // E01-US02-FR02, OF-R1: nur angemeldete Mitglieder
      ausleihen: einesVerfuegbar && rolle === "MITGLIED",
      // E01-US02-FR03, OF-R1, OF-R2: Mitglied und Gast (Gast wird zur Anmeldung geleitet)
      vormerken: !einesVerfuegbar && (rolle === null || rolle === "MITGLIED"),
    },
  });
}
