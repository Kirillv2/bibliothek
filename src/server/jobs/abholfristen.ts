// F-10 · E05-US01-FR03 · Abholfristen (ADR 007): abgelaufene Abholoptionen beenden, nächste Person rückt nach.
// Rolle System: nur über den Endpunkt mit Job-Secret erreichbar. Idempotent: Statuswechsel nur aus ABHOLBEREIT (NFR04).
import { sql } from "drizzle-orm";
import type { Datum } from "@/lib/datum";
import { zeilen } from "../db";
import { erfolg, type Ergebnis } from "../ergebnis";
import type { Kontext } from "../kontext";
import { ordneExemplarZu } from "../vormerkung/zuordnung";
import { protokolliereLauf } from "./protokoll";

export type AbholfristenErgebnis = { stichtag: Datum; abgelaufen: number; nachgerueckt: number };

export async function abholfristen(k: Kontext): Promise<Ergebnis<AbholfristenErgebnis>> {
  const stichtag = k.uhr.heute();
  const jetzt = k.uhr.jetzt();

  const anzahlen = await protokolliereLauf(k.db, "ABHOLFRISTEN", stichtag, jetzt, () =>
    k.db.transaction(async (tx) => {
      // AK-03.5, OF-F10-7: abgelaufen erst am Tag nach dem letzten Abholtag
      const abgelaufen = zeilen<{ id: string; copy_id: string | null }>(
        await tx.execute(sql`
          UPDATE reservations SET status = 'ABGELAUFEN'
          WHERE status = 'ABHOLBEREIT' AND pickup_deadline < ${stichtag}::date
          RETURNING id, copy_id`),
      );
      let nachgerueckt = 0;
      for (const { copy_id } of abgelaufen) {
        // AK-03.5, AK-03.6: nächste wartende Person oder frei verfügbar
        if (copy_id && (await ordneExemplarZu(tx, { copyId: copy_id, heute: stichtag, jetzt }))) nachgerueckt++;
      }
      return { abgelaufen: abgelaufen.length, nachgerueckt };
    }),
  );
  return erfolg({ stichtag, ...anzahlen });
}
