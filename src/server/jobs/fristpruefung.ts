// F-08 · E04-US01 · Fristprüfung (Spec docs/specs/F-08_E04-US01.md), löst E04-US02 aus (F-09).
// Rolle System: nur über den Endpunkt mit Job-Secret erreichbar (ADR 007), deshalb keine Sitzungsprüfung.
// Idempotent über eindeutige Schlüssel (NFR04): Erinnerung je (Vorgang, Fälligkeit), Mahnung je Vorgang.
import { sql } from "drizzle-orm";
import type { Datum } from "@/lib/datum";
import { letzteFaelligkeitImVorlauf } from "@/lib/frist";
import { zeilen } from "../db";
import { erfolg, type Ergebnis } from "../ergebnis";
import type { Kontext } from "../kontext";
import { getSetting } from "../settings";
import { protokolliereLauf } from "./protokoll";

export type FristpruefungErgebnis = { stichtag: Datum; erinnerungen: number; ueberfaellig: number; mahnungen: number };

function anzahl(ergebnis: unknown): number {
  return Number(zeilen<{ n: number }>(ergebnis)[0]?.n ?? 0);
}

export async function fristpruefung(k: Kontext): Promise<Ergebnis<FristpruefungErgebnis>> {
  // AK-01.3, ADR 008: Stichtag = heutiges Datum in Europe/Berlin
  const stichtag = k.uhr.heute();
  const jetzt = k.uhr.jetzt();

  const anzahlen = await protokolliereLauf(k.db, "FRISTPRUEFUNG", stichtag, jetzt, () =>
    k.db.transaction(async (tx) => {
      // E04-US01-FR02, OF-F08-1, OF-F08-2: offene Vorgänge mit Fälligkeit im Vorlauf (S ≤ F ≤ S + V)
      const bis = letzteFaelligkeitImVorlauf(stichtag, await getSetting(tx, "erinnerungVorlaufTage"));
      const erinnerungen = anzahl(
        await tx.execute(sql`
          WITH neu AS (
            INSERT INTO notifications (user_id, type, loan_id, due_date, created_at)
            SELECT l.member_id, 'ERINNERUNG', l.id, l.due_date, ${jetzt}
            FROM loans l
            WHERE l.returned_at IS NULL AND l.due_date >= ${stichtag}::date AND l.due_date <= ${bis}::date
            ON CONFLICT (loan_id, due_date) WHERE type = 'ERINNERUNG' DO NOTHING
            RETURNING 1
          )
          SELECT count(*)::int AS n FROM neu`),
      );

      // E04-US01-FR03, OF-F08-3: overdueSince = Fälligkeit + 1; neu nur, wenn leer oder aus einer früheren Frist
      const ueberfaellig = anzahl(
        await tx.execute(sql`
          WITH neu AS (
            UPDATE loans SET overdue_since = due_date + 1
            WHERE returned_at IS NULL AND due_date < ${stichtag}::date
              AND (overdue_since IS NULL OR overdue_since <= due_date)
            RETURNING 1
          )
          SELECT count(*)::int AS n FROM neu`),
      );

      // AK-03.4, E04-US02-FR01: eine Mahnung je überfälligem Vorgang mit Datum = Stichtag (F-09)
      const mahnungen = anzahl(
        await tx.execute(sql`
          WITH neu AS (
            INSERT INTO dunnings (loan_id, created_on)
            SELECT l.id, ${stichtag}::date FROM loans l
            WHERE l.returned_at IS NULL AND l.due_date < ${stichtag}::date
            ON CONFLICT (loan_id) DO NOTHING
            RETURNING loan_id
          ), benachrichtigt AS (
            INSERT INTO notifications (user_id, type, loan_id, created_at)
            SELECT l.member_id, 'MAHNUNG', l.id, ${jetzt} FROM neu JOIN loans l ON l.id = neu.loan_id
            ON CONFLICT (loan_id) WHERE type = 'MAHNUNG' DO NOTHING
            RETURNING 1
          )
          SELECT count(*)::int AS n FROM neu`),
      );

      return { erinnerungen, ueberfaellig, mahnungen };
    }),
  );

  return erfolg({ stichtag, ...anzahlen });
}
