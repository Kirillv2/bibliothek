// Testdaten direkt in der Test-DB anlegen (Specs F-01 … F-07, Abschnitt „Abhängigkeiten“).
//
// Tabellen- und Spaltennamen: snake_case der Felder aus docs/architektur/datenmodell.md
// (ADR 001). Alle Werte werden ausdrücklich gesetzt, damit die Tests nicht von
// Standardwerten der Datenbank abhängen.
import { randomUUID } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import type { EinstellungName } from "./konfiguration";
import type { Rolle, Sitzung } from "./testdb";
import { zeitpunktInBerlin, type Datum } from "./uhr";

export type Nutzer = { id: string; email: string; role: Rolle };

export async function legeNutzerAn(pg: PGlite, role: Rolle, email?: string): Promise<Nutzer> {
  const id = randomUUID();
  const adresse = email ?? `${role.toLowerCase()}-${id}@test.example`;
  await pg.query(
    "INSERT INTO users (id, email, password_hash, role, created_at) VALUES ($1, $2, $3, $4, now())",
    [id, adresse, `test-hash-${id}`, role],
  );
  return { id, email: adresse, role };
}

export function sitzungFuer(nutzer: Nutzer): Sitzung {
  return { userId: nutzer.id, role: nutzer.role };
}

export type TitelFelder = {
  title?: string;
  author?: string;
  category?: string;
  isbn?: string | null;
  description?: string | null;
  publicationYear?: number | null;
  archiviert?: boolean;
};

export async function legeTitelAn(pg: PGlite, felder: TitelFelder = {}): Promise<string> {
  const id = randomUUID();
  await pg.query(
    `INSERT INTO titles (id, title, author, category, isbn, description, publication_year, archived_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), now())`,
    [
      id,
      felder.title ?? `Titel ${id.slice(0, 8)}`,
      felder.author ?? "Autorin Test",
      felder.category ?? "Testkategorie",
      felder.isbn ?? null,
      felder.description ?? null,
      felder.publicationYear ?? null,
      felder.archiviert ? new Date() : null,
    ],
  );
  return id;
}

export type Zustand = "GUT" | "BESCHAEDIGT" | "VERLOREN";

let naechsteNummer = 900_000;

/** Inventarnummer für direkt angelegte Exemplare (hoher Bereich, damit sie nicht mit vom System vergebenen Nummern kollidiert). */
export function testInventarnummer(): string {
  naechsteNummer += 1;
  return `INV-${String(naechsteNummer).padStart(6, "0")}`;
}

export type Exemplar = { id: string; inventoryNumber: string };

export async function legeExemplarAn(
  pg: PGlite,
  titleId: string,
  optionen: { condition?: Zustand; inventoryNumber?: string } = {},
): Promise<Exemplar> {
  const id = randomUUID();
  const inventoryNumber = optionen.inventoryNumber ?? testInventarnummer();
  await pg.query(
    "INSERT INTO copies (id, title_id, inventory_number, condition, created_at) VALUES ($1, $2, $3, $4, now())",
    [id, titleId, inventoryNumber, optionen.condition ?? "GUT"],
  );
  return { id, inventoryNumber };
}

export async function legeAusleiheAn(
  pg: PGlite,
  daten: {
    copyId: string;
    memberId: string;
    startDate: Datum;
    dueDate: Datum;
    renewalCount?: number;
    returnedAt?: Date | null;
  },
): Promise<string> {
  const id = randomUUID();
  await pg.query(
    `INSERT INTO loans (id, copy_id, member_id, start_date, due_date, renewal_count, returned_at, overdue_since, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, now())`,
    [id, daten.copyId, daten.memberId, daten.startDate, daten.dueDate, daten.renewalCount ?? 0, daten.returnedAt ?? null],
  );
  return id;
}

export async function legeMahnungAn(
  pg: PGlite,
  daten: { loanId: string; createdOn: Datum; feeCents?: number | null; beglichenVon?: string | null },
): Promise<string> {
  const id = randomUUID();
  await pg.query(
    `INSERT INTO dunnings (id, loan_id, created_on, fee_cents, settled_at, settled_by_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      id,
      daten.loanId,
      daten.createdOn,
      daten.feeCents ?? null,
      daten.beglichenVon ? new Date() : null,
      daten.beglichenVon ?? null,
    ],
  );
  return id;
}

export type VormerkungStatus = "WARTEND" | "ABHOLBEREIT" | "ABGEHOLT" | "ABGELAUFEN";

export async function legeVormerkungAn(
  pg: PGlite,
  daten: {
    titleId: string;
    memberId: string;
    status: VormerkungStatus;
    createdAt: Date;
    copyId?: string | null;
    pickupDeadline?: Datum | null;
  },
): Promise<string> {
  const id = randomUUID();
  await pg.query(
    `INSERT INTO reservations (id, title_id, member_id, created_at, status, copy_id, pickup_deadline)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, daten.titleId, daten.memberId, daten.createdAt, daten.status, daten.copyId ?? null, daten.pickupDeadline ?? null],
  );
  return id;
}

/**
 * Setzt einen Systemparameter wie der Administrator (Tabelle system_settings, ADR 006).
 * Der Wert muss innerhalb der Grenzen aus config/system.defaults.json liegen.
 */
export async function setzeEinstellung(pg: PGlite, key: EinstellungName, value: number): Promise<void> {
  const admin = await legeNutzerAn(pg, "ADMINISTRATOR");
  await pg.query(
    `INSERT INTO system_settings (key, value, updated_at, updated_by_id) VALUES ($1, $2, now(), $3)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at, updated_by_id = EXCLUDED.updated_by_id`,
    [key, value, admin.id],
  );
}

/** Ausleihvorgang so, wie er in der DB steht (Datumswerte als Text JJJJ-MM-TT). */
export type AusleiheZeile = {
  id: string;
  copy_id: string;
  member_id: string;
  start_date: string;
  due_date: string;
  renewal_count: number;
  returned_at: Date | null;
  overdue_since: string | null;
};

const AUSLEIHE_SPALTEN =
  "id, copy_id, member_id, start_date::text AS start_date, due_date::text AS due_date, renewal_count, returned_at, overdue_since::text AS overdue_since";

export async function leseAusleihe(pg: PGlite, loanId: string): Promise<AusleiheZeile | undefined> {
  const { rows } = await pg.query<AusleiheZeile>(`SELECT ${AUSLEIHE_SPALTEN} FROM loans WHERE id = $1`, [loanId]);
  return rows[0];
}

export async function leseAusleihenZuExemplar(pg: PGlite, copyId: string): Promise<AusleiheZeile[]> {
  const { rows } = await pg.query<AusleiheZeile>(
    `SELECT ${AUSLEIHE_SPALTEN} FROM loans WHERE copy_id = $1 ORDER BY created_at`,
    [copyId],
  );
  return rows;
}

export type MahnungZeile = {
  id: string;
  loan_id: string;
  created_on: string;
  fee_cents: number | null;
  settled_at: Date | null;
};

export async function leseMahnungen(pg: PGlite, loanId: string): Promise<MahnungZeile[]> {
  const { rows } = await pg.query<MahnungZeile>(
    "SELECT id, loan_id, created_on::text AS created_on, fee_cents, settled_at FROM dunnings WHERE loan_id = $1",
    [loanId],
  );
  return rows.map((z) => ({ ...z, fee_cents: z.fee_cents === null ? null : Number(z.fee_cents) }));
}

/** Zeitpunkt für Vormerkungen: Tag und Uhrzeit in Europe/Berlin. */
export function zeitpunkt(datum: Datum, uhrzeit = "12:00"): Date {
  return zeitpunktInBerlin(datum, uhrzeit);
}
