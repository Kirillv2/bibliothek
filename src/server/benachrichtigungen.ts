// F-08 / F-10 · Eigene Benachrichtigungen in der App (OF-D8, OF-F08-5). Jeder angemeldete Nutzer, nur eigene.
import { sql } from "drizzle-orm";
import type { Datum } from "@/lib/datum";
import { pruefeRolle } from "./auth/rechte";
import { zeilen } from "./db";
import { erfolg, type Ergebnis } from "./ergebnis";
import type { Kontext } from "./kontext";

export type Benachrichtigung = {
  notificationId: string;
  type: "ERINNERUNG" | "MAHNUNG" | "ABHOLBEREIT";
  createdAt: string;
  gelesen: boolean;
  title?: string;
  inventoryNumber?: string;
  dueDate?: Datum;
  pickupDeadline?: Datum;
};

/** AK-02.7: neueste zuerst; Titel und Inventarnummer über den Vorgang bzw. die Vormerkung. */
export async function ladeMeineBenachrichtigungen(k: Kontext): Promise<Ergebnis<Benachrichtigung[]>> {
  const rechte = pruefeRolle(k.sitzung, "MITGLIED", "BIBLIOTHEKAR", "ADMINISTRATOR");
  if (rechte) return rechte;

  const liste = zeilen<{
    id: string;
    type: Benachrichtigung["type"];
    created_at: Date | string;
    gelesen: boolean;
    title: string | null;
    inventory_number: string | null;
    due_date: Datum | null;
    pickup_deadline: Datum | null;
  }>(
    await k.db.execute(sql`
      SELECT n.id, n.type, n.created_at, n.read_at IS NOT NULL AS gelesen,
        coalesce(t1.title, t2.title) AS title,
        coalesce(c1.inventory_number, c2.inventory_number) AS inventory_number,
        (CASE WHEN n.type = 'ERINNERUNG' THEN n.due_date ELSE l.due_date END)::text AS due_date,
        r.pickup_deadline::text AS pickup_deadline
      FROM notifications n
      LEFT JOIN loans l ON l.id = n.loan_id
      LEFT JOIN copies c1 ON c1.id = l.copy_id
      LEFT JOIN titles t1 ON t1.id = c1.title_id
      LEFT JOIN reservations r ON r.id = n.reservation_id
      LEFT JOIN copies c2 ON c2.id = r.copy_id
      LEFT JOIN titles t2 ON t2.id = r.title_id
      WHERE n.user_id = ${k.sitzung!.userId}
      ORDER BY n.created_at DESC, n.id DESC`),
  );

  return erfolg(
    liste.map((z) => ({
      notificationId: z.id,
      type: z.type,
      createdAt: new Date(z.created_at).toISOString(),
      gelesen: Boolean(z.gelesen),
      ...(z.title !== null ? { title: z.title } : {}),
      ...(z.inventory_number !== null ? { inventoryNumber: z.inventory_number } : {}),
      ...(z.due_date !== null ? { dueDate: z.due_date } : {}),
      ...(z.pickup_deadline !== null ? { pickupDeadline: z.pickup_deadline } : {}),
    })),
  );
}

/** Anzahl ungelesener eigener Benachrichtigungen (für das Menü). Gast: 0. */
export async function zaehleUngeleseneBenachrichtigungen(k: Kontext): Promise<number> {
  if (!k.sitzung) return 0;
  const [z] = zeilen<{ n: number }>(
    await k.db.execute(
      sql`SELECT count(*)::int AS n FROM notifications WHERE user_id = ${k.sitzung.userId} AND read_at IS NULL`,
    ),
  );
  return Number(z?.n ?? 0);
}

/** AK-02.7: alle eigenen ungelesenen als gelesen markieren. */
export async function benachrichtigungenGelesen(k: Kontext): Promise<Ergebnis<{ anzahl: number }>> {
  const rechte = pruefeRolle(k.sitzung, "MITGLIED", "BIBLIOTHEKAR", "ADMINISTRATOR");
  if (rechte) return rechte;
  const [z] = zeilen<{ n: number }>(
    await k.db.execute(sql`
      WITH gelesen AS (
        UPDATE notifications SET read_at = ${k.uhr.jetzt()}
        WHERE user_id = ${k.sitzung!.userId} AND read_at IS NULL
        RETURNING 1
      )
      SELECT count(*)::int AS n FROM gelesen`),
  );
  return erfolg({ anzahl: Number(z?.n ?? 0) });
}
