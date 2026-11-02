// Zuordnung eines ausleihbar gewordenen Exemplars an die erste wartende Vormerkung des Titels
// (E03-US03-FR03, E05-US01-FR03, OF-F10-1). Gemeinsam für Rückgabe (F-07), Exemplare (F-04) und Abholfristen (F-10).
import { sql } from "drizzle-orm";
import { plusTage, type Datum } from "@/lib/datum";
import { zeilen, type Datenbank } from "../db";
import { exemplarIstVerfuegbar } from "../katalog/verfuegbarkeit";
import { getSetting } from "../settings";

/**
 * Ist das Exemplar verfügbar (ADR 005) und wartet für seinen Titel eine Vormerkung, wird es der frühesten
 * zugeordnet: Status `ABHOLBEREIT`, letzter Abholtag = heute + `abholfristVormerkungTage` (OF-F10-7),
 * Benachrichtigung `ABHOLBEREIT` (OF-D8). Muss innerhalb einer Transaktion laufen.
 */
export async function ordneExemplarZu(
  tx: Datenbank,
  eingabe: { copyId: string; heute: Datum; jetzt: Date },
): Promise<{ reservationId: string; memberId: string } | undefined> {
  const [exemplar] = zeilen<{ title_id: string }>(
    await tx.execute(sql`SELECT c.title_id FROM copies c WHERE c.id = ${eingabe.copyId} AND ${exemplarIstVerfuegbar("c")}`),
  );
  if (!exemplar) return undefined;

  // E05-US01-FR02: Warteschlange nach Zeitpunkt, bei Gleichstand nach ID
  const [naechste] = zeilen<{ id: string; member_id: string }>(
    await tx.execute(sql`
      SELECT id, member_id FROM reservations
      WHERE title_id = ${exemplar.title_id} AND status = 'WARTEND'
      ORDER BY created_at, id
      LIMIT 1
      FOR UPDATE`),
  );
  if (!naechste) return undefined;

  const abholfrist = plusTage(eingabe.heute, await getSetting(tx, "abholfristVormerkungTage"));
  await tx.execute(sql`
    UPDATE reservations SET status = 'ABHOLBEREIT', copy_id = ${eingabe.copyId}, pickup_deadline = ${abholfrist}
    WHERE id = ${naechste.id}`);
  await tx.execute(sql`
    INSERT INTO notifications (user_id, type, reservation_id, created_at)
    VALUES (${naechste.member_id}, 'ABHOLBEREIT', ${naechste.id}, ${eingabe.jetzt})
    ON CONFLICT (reservation_id) WHERE type = 'ABHOLBEREIT' DO NOTHING`);
  return { reservationId: naechste.id, memberId: naechste.member_id };
}

/**
 * OF-F10-4: Ein abholbereit zugeordnetes Exemplar ist nicht mehr ausleihbar (verloren) → die Vormerkung
 * wartet wieder mit ihrem ursprünglichen Zeitpunkt; die nicht mehr gültige Benachrichtigung entfällt.
 */
export async function loeseZuordnung(tx: Datenbank, copyId: string): Promise<void> {
  const geloest = zeilen<{ id: string }>(
    await tx.execute(sql`
      UPDATE reservations SET status = 'WARTEND', copy_id = NULL, pickup_deadline = NULL
      WHERE copy_id = ${copyId} AND status = 'ABHOLBEREIT'
      RETURNING id`),
  );
  for (const { id } of geloest) {
    await tx.execute(sql`DELETE FROM notifications WHERE reservation_id = ${id} AND type = 'ABHOLBEREIT'`);
  }
}
