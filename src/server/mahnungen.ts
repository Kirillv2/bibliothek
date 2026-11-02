// F-09 · E04-US02 · Mahnungen und Gebühren verwalten (Spec docs/specs/F-09_E04-US02.md)
// Liste und Begleichen nur Bibliothekar (Rechte-Matrix, OF-R3); eigene Mahnungen nur das Mitglied (OF-R4).
// Erzeugt werden Mahnungen von der Fristprüfung (F-08), bei verspäteter Verlängerung (F-06) und Rückgabe (F-07).
import { sql } from "drizzle-orm";
import { datumInBerlin, type Datum } from "@/lib/datum";
import { gesamtgebuehrCents, ueberschritteneTage } from "@/lib/mahngebuehr";
import { pruefeRolle } from "./auth/rechte";
import { zeilen } from "./db";
import { istUuid, type MitWeiterenFeldern } from "./eingabe";
import { Abbruch, erfolg, fehler, type Ergebnis } from "./ergebnis";
import type { Kontext } from "./kontext";
import { getSetting } from "./settings";

type MahnungZeile = {
  id: string;
  loan_id: string;
  created_on: Datum;
  fee_cents: number | null;
  beglichen: boolean;
  email: string;
  title: string;
  inventory_number: string;
  due_date: Datum;
  returned_at: Date | string | null;
};

/** Gebühr und überschrittene Tage einer Mahnung am Stichtag `heute` (AK-02.1 … AK-02.4). */
function bewerte(z: MahnungZeile, heute: Datum, tagessatzEuro: number) {
  const offen = z.returned_at === null;
  const laeuft = offen && heute > z.due_date;
  // Annahme (Testplan F-09): abgeschlossen → Tage bis zum Rückgabetag; laufend → bis heute
  const bis = offen ? heute : datumInBerlin(new Date(z.returned_at!));
  return {
    ueberschritteneTage: ueberschritteneTage(z.due_date, bis),
    gebuehrCents: gesamtgebuehrCents({
      festgehaltenCents: z.fee_cents === null ? null : Number(z.fee_cents),
      laufend: laeuft ? { dueDate: z.due_date, stichtag: heute } : null,
      tagessatzEuro,
    }),
    laeuft,
  };
}

function mahnungenAbfrage(bedingung: ReturnType<typeof sql>) {
  return sql`
    SELECT d.id, d.loan_id, d.created_on::text AS created_on, d.fee_cents, d.settled_at IS NOT NULL AS beglichen,
      u.email, t.title, c.inventory_number, l.due_date::text AS due_date, l.returned_at
    FROM dunnings d
    JOIN loans l ON l.id = d.loan_id
    JOIN users u ON u.id = l.member_id
    JOIN copies c ON c.id = l.copy_id
    JOIN titles t ON t.id = c.title_id
    WHERE ${bedingung}
    ORDER BY (d.settled_at IS NOT NULL), d.created_on, d.id`;
}

export type MahnungImUeberblick = {
  dunningId: string;
  loanId: string;
  createdOn: Datum;
  mitgliedEmail: string;
  title: string;
  inventoryNumber: string;
  dueDate: Datum;
  ueberschritteneTage: number;
  gebuehrCents: number;
  beglichen: boolean;
  /** Überschreitung läuft noch: Begleichen erst nach Rückgabe oder Verlängerung (OF-F09-2). */
  begleichbar: boolean;
};

/** AK-01.5: alle Mahnungen, offene zuerst, älteste zuerst; optional nur offene (OF-F09-5). */
export async function ladeMahnungen(
  k: Kontext,
  anfrage: { nurOffene?: boolean } & MitWeiterenFeldern = {},
): Promise<Ergebnis<MahnungImUeberblick[]>> {
  const rechte = pruefeRolle(k.sitzung, "BIBLIOTHEKAR");
  if (rechte) return rechte;
  const heute = k.uhr.heute();
  const tagessatz = await getSetting(k.db, "mahnTagessatzEuro");
  const bedingung = anfrage?.nurOffene === true ? sql`d.settled_at IS NULL` : sql`TRUE`;
  const liste = zeilen<MahnungZeile>(await k.db.execute(mahnungenAbfrage(bedingung)));
  return erfolg(
    liste.map((z) => {
      const { ueberschritteneTage, gebuehrCents, laeuft } = bewerte(z, heute, tagessatz);
      const beglichen = Boolean(z.beglichen);
      return {
        dunningId: z.id,
        loanId: z.loan_id,
        createdOn: z.created_on,
        mitgliedEmail: z.email,
        title: z.title,
        inventoryNumber: z.inventory_number,
        dueDate: z.due_date,
        ueberschritteneTage,
        gebuehrCents,
        beglichen,
        begleichbar: !beglichen && !laeuft,
      };
    }),
  );
}

export type MeineMahnung = {
  dunningId: string;
  createdOn: Datum;
  title: string;
  inventoryNumber: string;
  gebuehrCents: number;
  beglichen: boolean;
};

/** AK-02.6, OF-R4: eigene Mahnungen des Mitglieds, ohne Personendaten. */
export async function ladeMeineMahnungen(k: Kontext): Promise<Ergebnis<MeineMahnung[]>> {
  const rechte = pruefeRolle(k.sitzung, "MITGLIED");
  if (rechte) return rechte;
  const heute = k.uhr.heute();
  const tagessatz = await getSetting(k.db, "mahnTagessatzEuro");
  const liste = zeilen<MahnungZeile>(await k.db.execute(mahnungenAbfrage(sql`l.member_id = ${k.sitzung!.userId}`)));
  return erfolg(
    liste.map((z) => ({
      dunningId: z.id,
      createdOn: z.created_on,
      title: z.title,
      inventoryNumber: z.inventory_number,
      gebuehrCents: bewerte(z, heute, tagessatz).gebuehrCents,
      beglichen: Boolean(z.beglichen),
    })),
  );
}

export type BegleichenErgebnis = { dunningId: string; settledAt: string; gebuehrCents: number };

/** E04-US02-FR03: als beglichen markieren; erst wenn die Gebühr feststeht (OF-F09-2). */
export async function mahnungBegleichen(
  k: Kontext,
  eingabe: { dunningId: string } & MitWeiterenFeldern,
): Promise<Ergebnis<BegleichenErgebnis>> {
  const rechte = pruefeRolle(k.sitzung, "BIBLIOTHEKAR");
  if (rechte) return rechte;
  const dunningId = eingabe?.dunningId;
  if (!istUuid(dunningId)) return fehler("NICHT_GEFUNDEN");

  try {
    return erfolg(
      await k.db.transaction(async (tx) => {
        const [m] = zeilen<{ fee_cents: number | null; beglichen: boolean; due_date: Datum; offen: boolean }>(
          await tx.execute(sql`
            SELECT d.fee_cents, d.settled_at IS NOT NULL AS beglichen, l.due_date::text AS due_date, l.returned_at IS NULL AS offen
            FROM dunnings d JOIN loans l ON l.id = d.loan_id
            WHERE d.id = ${dunningId}
            FOR UPDATE OF d`),
        );
        if (!m) throw new Abbruch(fehler("NICHT_GEFUNDEN"));
        if (m.beglichen) throw new Abbruch(fehler("MAHNUNG_BEGLICHEN"));
        // AK-03.4: Überschreitung läuft noch → Gebühr steht nicht fest
        if (m.offen && k.uhr.heute() > m.due_date) throw new Abbruch(fehler("UEBERSCHREITUNG_LAEUFT"));

        const settledAt = k.uhr.jetzt();
        // AK-03.2: Zeitpunkt und Bibliothekar (aus der Sitzung, nie aus der Eingabe)
        await tx.execute(sql`
          UPDATE dunnings SET settled_at = ${settledAt}, settled_by_id = ${k.sitzung!.userId} WHERE id = ${dunningId}`);
        return { dunningId, settledAt: settledAt.toISOString(), gebuehrCents: Number(m.fee_cents ?? 0) };
      }),
    );
  } catch (e) {
    if (e instanceof Abbruch) return e.ergebnis;
    throw e;
  }
}
