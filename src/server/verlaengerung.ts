// F-06 · E03-US02 · Eigene Ausleihen einsehen und verlängern (Spec docs/specs/F-06_E03-US02.md)
// Nur Mitglied, nur eigene Vorgänge (Rechte-Matrix). Die Liste ist vorgezogen, weil die F-03-Tests sie nutzen.
import { sql } from "drizzle-orm";
import type { Datum } from "@/lib/datum";
import { pruefeRolle } from "./auth/rechte";
import { zeilen } from "./db";
import { erfolg, type Ergebnis, type Fehlercode } from "./ergebnis";
import type { Kontext } from "./kontext";
import { getSetting } from "./settings";

export type MeineAusleihe = {
  loanId: string;
  title: string;
  inventoryNumber: string;
  dueDate: Datum;
  renewalCount: number;
  verlaengerbar: boolean;
  grund?: Fehlercode;
};

/**
 * E03-US02-FR02: Verlängern ist möglich ohne wartende Vormerkung für den Titel (OF-F06-1) und unter der Höchstzahl.
 * Reihenfolge wie bei `verlaengern`: wartende Vormerkung vor Höchstzahl (schnittstellen.md).
 */
export function grundGegenVerlaengerung(vorgang: {
  wartendeVormerkung: boolean;
  renewalCount: number;
  maxVerlaengerungen: number;
}): Fehlercode | undefined {
  if (vorgang.wartendeVormerkung) return "VORMERKUNG_VORHANDEN";
  if (vorgang.renewalCount >= vorgang.maxVerlaengerungen) return "MAX_VERLAENGERUNGEN_ERREICHT";
  return undefined;
}

/** E03-US02-FR01: offene eigene Ausleihvorgänge mit aktuellem Titel (OF-F03-5), Inventarnummer und Fälligkeit. */
export async function ladeMeineAusleihen(k: Kontext): Promise<Ergebnis<MeineAusleihe[]>> {
  const rechte = pruefeRolle(k.sitzung, "MITGLIED");
  if (rechte) return rechte;
  const maxVerlaengerungen = await getSetting(k.db, "maxVerlaengerungen");

  const vorgaenge = zeilen<{
    id: string;
    title: string;
    inventory_number: string;
    due_date: Datum;
    renewal_count: number;
    wartend: boolean;
  }>(
    await k.db.execute(sql`
      SELECT l.id, t.title, c.inventory_number, l.due_date::text AS due_date, l.renewal_count,
        EXISTS (SELECT 1 FROM reservations r WHERE r.title_id = t.id AND r.status = 'WARTEND') AS wartend
      FROM loans l
      JOIN copies c ON c.id = l.copy_id
      JOIN titles t ON t.id = c.title_id
      WHERE l.member_id = ${k.sitzung!.userId} AND l.returned_at IS NULL
      ORDER BY l.due_date, lower(t.title), l.id`),
  );

  return erfolg(
    vorgaenge.map((z) => {
      const renewalCount = Number(z.renewal_count);
      const grund = grundGegenVerlaengerung({ wartendeVormerkung: Boolean(z.wartend), renewalCount, maxVerlaengerungen });
      return {
        loanId: z.id,
        title: z.title,
        inventoryNumber: z.inventory_number,
        dueDate: z.due_date,
        renewalCount,
        verlaengerbar: grund === undefined,
        ...(grund ? { grund } : {}),
      };
    }),
  );
}
