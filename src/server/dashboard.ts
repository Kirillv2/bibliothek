// F-13 · E07-US01 · Dashboard mit Kennzahlen und Bestandsexport (Spec docs/specs/F-13_E07-US01.md)
// Nur Bibliothekar (Rechte-Matrix, OF-R3). Alle Funktionen lesen nur; Zahlen bei jedem Aufruf frisch aus der DB (AK-01.5).
import { sql } from "drizzle-orm";
import { erstelleCsv } from "@/lib/csv";
import type { Datum } from "@/lib/datum";
import { ueberschritteneTage } from "@/lib/mahngebuehr";
import { pruefeRolle } from "./auth/rechte";
import { zeilen } from "./db";
import { istUuid, type MitWeiterenFeldern } from "./eingabe";
import { erfolg, fehler, type Ergebnis } from "./ergebnis";
import { anzahlVerfuegbar } from "./katalog/verfuegbarkeit";
import type { Kontext } from "./kontext";
import { mahnungZumVorgang, type MahnungZumVorgang } from "./mahnungen";

export type Sortierung = "FAELLIGKEIT" | "MITGLIED";
export type Richtung = "AUF" | "AB";

export type UeberfaelligerVorgang = {
  loanId: string;
  mitgliedEmail: string;
  title: string;
  inventoryNumber: string;
  dueDate: Datum;
  ueberschritteneTage: number;
};

export type Dashboard = {
  kennzahlen: { offeneAusleihen: number; ueberfaellig: number; aktiveVormerkungen: number };
  ueberfaellige: UeberfaelligerVorgang[];
};

/** AK-02.2, AK-02.3, AK-02.6: nur feste Sortierungen; alles andere → Fälligkeit aufsteigend (OF-F13-2). */
function reihenfolge(sortierung: unknown, richtung: unknown) {
  const ab = richtung === "AB";
  if (sortierung === "MITGLIED") {
    return ab ? sql`u.email DESC, l.due_date ASC, l.id` : sql`u.email ASC, l.due_date ASC, l.id`;
  }
  if (sortierung === "FAELLIGKEIT" && ab) return sql`l.due_date DESC, u.email ASC, l.id`;
  // Standard, auch bei unbekannter Sortierung (dann gilt die mitgeschickte Richtung nicht)
  return sql`l.due_date ASC, u.email ASC, l.id`;
}

export async function ladeDashboard(
  k: Kontext,
  anfrage: { sortierung?: Sortierung; richtung?: Richtung } & MitWeiterenFeldern = {},
): Promise<Ergebnis<Dashboard>> {
  const rechte = pruefeRolle(k.sitzung, "BIBLIOTHEKAR");
  if (rechte) return rechte;
  const heute = k.uhr.heute();

  // AK-01.1 … AK-01.3; überfällig = offen und Fälligkeit vor heute (OF-F13-1, OF-Z2)
  const [zahlen] = zeilen<{ offen: number; ueberfaellig: number; vormerkungen: number }>(
    await k.db.execute(sql`
      SELECT
        (SELECT count(*)::int FROM loans WHERE returned_at IS NULL) AS offen,
        (SELECT count(*)::int FROM loans WHERE returned_at IS NULL AND due_date < ${heute}::date) AS ueberfaellig,
        (SELECT count(*)::int FROM reservations WHERE status IN ('WARTEND', 'ABHOLBEREIT')) AS vormerkungen`),
  );

  // AK-02.1
  const liste = zeilen<{ id: string; email: string; title: string; inventory_number: string; due_date: Datum }>(
    await k.db.execute(sql`
      SELECT l.id, u.email, t.title, c.inventory_number, l.due_date::text AS due_date
      FROM loans l
      JOIN users u ON u.id = l.member_id
      JOIN copies c ON c.id = l.copy_id
      JOIN titles t ON t.id = c.title_id
      WHERE l.returned_at IS NULL AND l.due_date < ${heute}::date
      ORDER BY ${reihenfolge(anfrage?.sortierung, anfrage?.richtung)}`),
  );

  return erfolg({
    kennzahlen: {
      offeneAusleihen: Number(zahlen.offen),
      ueberfaellig: Number(zahlen.ueberfaellig),
      aktiveVormerkungen: Number(zahlen.vormerkungen),
    },
    ueberfaellige: liste.map((z) => ({
      loanId: z.id,
      mitgliedEmail: z.email,
      title: z.title,
      inventoryNumber: z.inventory_number,
      dueDate: z.due_date,
      ueberschritteneTage: ueberschritteneTage(z.due_date, heute),
    })),
  });
}

export type Vorgang = {
  loanId: string;
  title: string;
  inventoryNumber: string;
  mitgliedEmail: string;
  startDate: Datum;
  dueDate: Datum;
  renewalCount: number;
  overdueSince: Datum | null;
  returnedAt: string | null;
  mahnung?: MahnungZumVorgang;
};

/** AK-02.4, OF-F13-3: Seite eines Ausleihvorgangs in der Verwaltung. */
export async function ladeVorgang(k: Kontext, loanId: string): Promise<Ergebnis<Vorgang>> {
  const rechte = pruefeRolle(k.sitzung, "BIBLIOTHEKAR");
  if (rechte) return rechte;
  // AK-02.5
  if (!istUuid(loanId)) return fehler("NICHT_GEFUNDEN");
  const [z] = zeilen<{
    id: string;
    title: string;
    inventory_number: string;
    email: string;
    start_date: Datum;
    due_date: Datum;
    renewal_count: number;
    overdue_since: Datum | null;
    returned_at: Date | string | null;
  }>(
    await k.db.execute(sql`
      SELECT l.id, t.title, c.inventory_number, u.email, l.start_date::text AS start_date, l.due_date::text AS due_date,
        l.renewal_count, l.overdue_since::text AS overdue_since, l.returned_at
      FROM loans l
      JOIN users u ON u.id = l.member_id
      JOIN copies c ON c.id = l.copy_id
      JOIN titles t ON t.id = c.title_id
      WHERE l.id = ${loanId}`),
  );
  if (!z) return fehler("NICHT_GEFUNDEN");
  const mahnung = await mahnungZumVorgang(k, z.id);
  return erfolg({
    loanId: z.id,
    title: z.title,
    inventoryNumber: z.inventory_number,
    mitgliedEmail: z.email,
    startDate: z.start_date,
    dueDate: z.due_date,
    renewalCount: Number(z.renewal_count),
    overdueSince: z.overdue_since,
    returnedAt: z.returned_at === null ? null : new Date(z.returned_at).toISOString(),
    ...(mahnung ? { mahnung } : {}),
  });
}

const KOPFZEILE = ["Titel", "Autor", "Kategorie", "ISBN", "Exemplare gesamt", "Exemplare verfügbar"];

/** E07-US01-FR03, OF-F13-4: aktive Titel mit Anzahlen; „verfügbar“ wie im Katalog (ADR 005); keine Personendaten. */
export async function exportiereBestandCsv(k: Kontext): Promise<Ergebnis<{ dateiname: string; inhalt: string }>> {
  const rechte = pruefeRolle(k.sitzung, "BIBLIOTHEKAR");
  if (rechte) return rechte;
  const titel = zeilen<{ title: string; author: string; category: string; isbn: string | null; gesamt: number; verfuegbar: number }>(
    await k.db.execute(sql`
      SELECT t.title, t.author, t.category, t.isbn,
        (SELECT count(*)::int FROM copies gc WHERE gc.title_id = t.id) AS gesamt,
        ${anzahlVerfuegbar("t")} AS verfuegbar
      FROM titles t
      WHERE t.archived_at IS NULL
      ORDER BY t.title, t.id`),
  );
  const inhalt = erstelleCsv([
    KOPFZEILE,
    ...titel.map((z) => [z.title, z.author, z.category, z.isbn, Number(z.gesamt), Number(z.verfuegbar)]),
  ]);
  // AK-03.7
  return erfolg({ dateiname: `bestand-${k.uhr.heute()}.csv`, inhalt });
}
