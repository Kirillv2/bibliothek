// F-10 · E05-US01 · Titel vormerken (Spec docs/specs/F-10_E05-US01.md)
// Nur Mitglied (OF-R1), Mitglieds-ID nur aus der Sitzung. Prüfreihenfolge: Anmeldung → Rolle →
// Titel existiert/aktiv → schon vorgemerkt → Exemplar verfügbar (AK-01.6).
import { sql } from "drizzle-orm";
import type { Datum } from "@/lib/datum";
import { pruefeRolle } from "../auth/rechte";
import { zeilen } from "../db";
import type { VormerkungStatus } from "../db/schema";
import { istUuid, type MitWeiterenFeldern } from "../eingabe";
import { Abbruch, erfolg, fehler, type Ergebnis } from "../ergebnis";
import { anzahlVerfuegbar } from "../katalog/verfuegbarkeit";
import type { Kontext } from "../kontext";

/** Platz einer wartenden Vormerkung in der Warteschlange ihres Titels (E05-US01-FR02), SQL-Alias `alias`. */
function platz(alias: string) {
  const r = sql.raw(alias);
  return sql`(SELECT count(*)::int FROM reservations w
    WHERE w.title_id = ${r}.title_id AND w.status = 'WARTEND' AND (w.created_at, w.id) <= (${r}.created_at, ${r}.id))`;
}

export async function vormerken(
  k: Kontext,
  eingabe: { titleId: string } & MitWeiterenFeldern,
): Promise<Ergebnis<{ reservationId: string; position: number }>> {
  const rechte = pruefeRolle(k.sitzung, "MITGLIED");
  if (rechte) return rechte;
  const memberId = k.sitzung!.userId;
  const titleId = eingabe?.titleId;
  if (!istUuid(titleId)) return fehler("NICHT_GEFUNDEN");

  try {
    return erfolg(
      await k.db.transaction(async (tx) => {
        // gleichzeitige Vormerkungen desselben Mitglieds nacheinander (OF-F10-2)
        await tx.execute(sql`SELECT id FROM users WHERE id = ${memberId} FOR UPDATE`);
        // AK-01.3, OF-D4
        const [titel] = zeilen<{ verfuegbar: number }>(
          await tx.execute(sql`
            SELECT ${anzahlVerfuegbar("t")} AS verfuegbar FROM titles t
            WHERE t.id = ${titleId} AND t.archived_at IS NULL FOR SHARE OF t`),
        );
        if (!titel) throw new Abbruch(fehler("NICHT_GEFUNDEN"));
        // AK-01.4, OF-F10-2
        const [vorhanden] = zeilen<{ id: string }>(
          await tx.execute(sql`
            SELECT id FROM reservations
            WHERE title_id = ${titleId} AND member_id = ${memberId} AND status IN ('WARTEND', 'ABHOLBEREIT')
            LIMIT 1`),
        );
        if (vorhanden) throw new Abbruch(fehler("BEREITS_VORGEMERKT"));
        // E05-US01-FR01
        if (Number(titel.verfuegbar) > 0) throw new Abbruch(fehler("EXEMPLAR_VERFUEGBAR"));

        const [neu] = zeilen<{ id: string; position: number }>(
          await tx.execute(sql`
            WITH neu AS (
              INSERT INTO reservations (title_id, member_id, created_at, status)
              VALUES (${titleId}, ${memberId}, ${k.uhr.jetzt()}, 'WARTEND')
              RETURNING id, title_id, created_at
            )
            SELECT neu.id, (SELECT count(*)::int FROM reservations w
              WHERE w.title_id = neu.title_id AND w.status = 'WARTEND' AND (w.created_at, w.id) < (neu.created_at, neu.id)) + 1 AS position
            FROM neu`),
        );
        return { reservationId: neu.id, position: Number(neu.position) };
      }),
    );
  } catch (e) {
    if (e instanceof Abbruch) return e.ergebnis;
    throw e;
  }
}

export type MeineVormerkung = {
  reservationId: string;
  titleId: string;
  title: string;
  status: Extract<VormerkungStatus, "WARTEND" | "ABHOLBEREIT">;
  position?: number;
  inventoryNumber?: string;
  pickupDeadline?: Datum;
};

/** AK-02.3: aktive eigene Vormerkungen; abholbereite zuerst, dann nach Zeitpunkt. */
export async function ladeMeineVormerkungen(k: Kontext): Promise<Ergebnis<MeineVormerkung[]>> {
  const rechte = pruefeRolle(k.sitzung, "MITGLIED");
  if (rechte) return rechte;
  const liste = zeilen<{
    id: string;
    title_id: string;
    title: string;
    status: MeineVormerkung["status"];
    position: number;
    inventory_number: string | null;
    pickup_deadline: Datum | null;
  }>(
    await k.db.execute(sql`
      SELECT r.id, r.title_id, t.title, r.status, ${platz("r")} AS position, c.inventory_number,
        r.pickup_deadline::text AS pickup_deadline
      FROM reservations r
      JOIN titles t ON t.id = r.title_id
      LEFT JOIN copies c ON c.id = r.copy_id
      WHERE r.member_id = ${k.sitzung!.userId} AND r.status IN ('WARTEND', 'ABHOLBEREIT')
      ORDER BY (r.status = 'WARTEND'), r.created_at, r.id`),
  );
  return erfolg(
    liste.map((z) => ({
      reservationId: z.id,
      titleId: z.title_id,
      title: z.title,
      status: z.status,
      ...(z.status === "WARTEND"
        ? { position: Number(z.position) }
        : { inventoryNumber: z.inventory_number ?? undefined, pickupDeadline: z.pickup_deadline ?? undefined }),
    })),
  );
}

/** Eigene aktive Vormerkung für einen Titel (Detailseite, AK-01.5); keine Daten anderer Mitglieder. */
export async function eigeneVormerkungZumTitel(
  k: Kontext,
  titleId: string,
): Promise<{ status: "WARTEND"; position: number } | { status: "ABHOLBEREIT"; pickupDeadline: Datum } | undefined> {
  if (k.sitzung?.role !== "MITGLIED") return undefined;
  const [z] = zeilen<{ status: "WARTEND" | "ABHOLBEREIT"; position: number; pickup_deadline: Datum | null }>(
    await k.db.execute(sql`
      SELECT r.status, ${platz("r")} AS position, r.pickup_deadline::text AS pickup_deadline
      FROM reservations r
      WHERE r.title_id = ${titleId} AND r.member_id = ${k.sitzung.userId} AND r.status IN ('WARTEND', 'ABHOLBEREIT')
      LIMIT 1`),
  );
  if (!z) return undefined;
  return z.status === "WARTEND"
    ? { status: "WARTEND", position: Number(z.position) }
    : { status: "ABHOLBEREIT", pickupDeadline: z.pickup_deadline! };
}
