// F-07 · E03-US03 · Rückgabe erfassen (Spec docs/specs/F-07_E03-US03.md)
// Nur Bibliothekar (Rechte-Matrix, OF-R3). Abschluss, Mahnung und Zuordnung an die Vormerkung
// geschehen in einer Transaktion (AK-03.5, ADR 005).
import { sql } from "drizzle-orm";
import type { Datum } from "@/lib/datum";
import { berechneMahngebuehrCents } from "@/lib/mahngebuehr";
import { pruefeRolle } from "./auth/rechte";
import { zeilen } from "./db";
import type { Zustand } from "./db/schema";
import { type MitWeiterenFeldern } from "./eingabe";
import { Abbruch, erfolg, fehler, type Ergebnis } from "./ergebnis";
import type { Kontext } from "./kontext";
import { getSetting } from "./settings";
import { ordneExemplarZu } from "./vormerkung/zuordnung";

export type RueckgabeErgebnis = {
  loanId: string;
  returnedAt: string;
  title: string;
  inventoryNumber: string;
  mitgliedEmail: string;
  mahngebuehrCents?: number;
  zugeordneteVormerkungId?: string;
};

/** Annahme: Bindestriche, Leerzeichen und Groß-/Kleinschreibung spielen bei der Eingabe keine Rolle (z. B. „inv 000123“). */
function normalisiere(inventarnummer: string): string {
  return inventarnummer.replace(/[-\s]/g, "").toUpperCase();
}

export async function rueckgabeErfassen(
  k: Kontext,
  eingabe: { inventoryNumber: string } & MitWeiterenFeldern,
): Promise<Ergebnis<RueckgabeErgebnis>> {
  const rechte = pruefeRolle(k.sitzung, "BIBLIOTHEKAR");
  if (rechte) return rechte;
  const roh = eingabe?.inventoryNumber;
  const nummer = typeof roh === "string" ? normalisiere(roh) : "";
  if (nummer === "") return fehler("VALIDIERUNG", { inventoryNumber: "Bitte eine Inventarnummer eingeben." });

  try {
    return erfolg(
      await k.db.transaction(async (tx) => {
        // AK-01.4, AK-01.5: nur ein offener Vorgang zu dieser Nummer; gesperrt gegen eine gleichzeitige zweite Erfassung
        const [vorgang] = zeilen<{
          id: string;
          due_date: Datum;
          copy_id: string;
          condition: Zustand;
          title_id: string;
          title: string;
          inventory_number: string;
          email: string;
        }>(
          await tx.execute(sql`
            SELECT l.id, l.due_date::text AS due_date, c.id AS copy_id, c.condition, t.id AS title_id, t.title,
              c.inventory_number, u.email
            FROM loans l
            JOIN copies c ON c.id = l.copy_id
            JOIN titles t ON t.id = c.title_id
            JOIN users u ON u.id = l.member_id
            WHERE upper(translate(c.inventory_number, '- ', '')) = ${nummer} AND l.returned_at IS NULL
            FOR UPDATE OF l`),
        );
        if (!vorgang) throw new Abbruch(fehler("NICHT_GEFUNDEN"));

        // E03-US03-FR01: abschließen mit dem Zeitpunkt der Erfassung
        const returnedAt = k.uhr.jetzt();
        const heute = k.uhr.heute();
        await tx.execute(sql`UPDATE loans SET returned_at = ${returnedAt} WHERE id = ${vorgang.id}`);

        // E03-US03-FR02: verspätet → Gebühr an der offenen Mahnung des Vorgangs, sonst neue Mahnung (OF-F07-1).
        // Eine beglichene Mahnung bleibt, wie sie ist (AK-02.5).
        // Stammt die offene Mahnung aus einer früheren Frist (verspätete Verlängerung, OF-F06-3), kommt die Gebühr
        // für die aktuelle Frist dazu, damit alle überschrittenen Tage zählen (E04-US02-FR02). Annahme, Befund R-07.
        const gebuehr = berechneMahngebuehrCents({
          dueDate: vorgang.due_date,
          stichtag: heute,
          tagessatzEuro: await getSetting(tx, "mahnTagessatzEuro"),
        });
        let mahngebuehrCents: number | undefined;
        if (gebuehr > 0) {
          const [gesetzt] = zeilen<{ fee_cents: number }>(
            await tx.execute(sql`
              INSERT INTO dunnings (loan_id, created_on, fee_cents) VALUES (${vorgang.id}, ${heute}, ${gebuehr})
              ON CONFLICT (loan_id) DO UPDATE SET fee_cents = CASE
                WHEN dunnings.created_on <= ${vorgang.due_date}::date THEN coalesce(dunnings.fee_cents, 0) + EXCLUDED.fee_cents
                ELSE EXCLUDED.fee_cents
              END,
              settled_at = NULL, settled_by_id = NULL
              WHERE dunnings.settled_at IS NULL OR dunnings.created_on <= ${vorgang.due_date}::date
              RETURNING fee_cents`),
          );
          // F-09 OF-F09-3: beglichen in einer früheren Frist → durch die neue Gebühr wieder offen.
          // Beglichen in derselben Frist bleibt beglichen (AK-02.5).
          if (gesetzt) mahngebuehrCents = gesetzt.fee_cents;
          // F-09 AK-01.4, OF-F09-4: Benachrichtigung „Mahnung“, höchstens eine je Vorgang
          await tx.execute(sql`
            INSERT INTO notifications (user_id, type, loan_id, created_at)
            SELECT member_id, 'MAHNUNG', id, ${returnedAt} FROM loans WHERE id = ${vorgang.id}
            ON CONFLICT (loan_id) WHERE type = 'MAHNUNG' DO NOTHING`);
        }

        // E03-US03-FR03: an die früheste wartende Vormerkung des Titels; ein verlorenes Exemplar nicht (AK-03.6, OF-F07-5)
        // ordneExemplarZu prüft selbst, dass das Exemplar ausleihbar ist (ADR 005); ein verlorenes nicht (AK-03.6)
        // AK-03.3: Abholfrist ab dem Tag der Rückgabe · AK-03.4, OF-D8: Benachrichtigung in der App
        const zuordnung = await ordneExemplarZu(tx, { copyId: vorgang.copy_id, heute, jetzt: returnedAt });
        const zugeordneteVormerkungId = zuordnung?.reservationId;

        return {
          loanId: vorgang.id,
          returnedAt: returnedAt.toISOString(),
          title: vorgang.title,
          inventoryNumber: vorgang.inventory_number,
          // AK-01.6: der Bibliothekar sieht, von wem das Exemplar kommt
          mitgliedEmail: vorgang.email,
          ...(mahngebuehrCents !== undefined ? { mahngebuehrCents } : {}),
          ...(zugeordneteVormerkungId ? { zugeordneteVormerkungId } : {}),
        };
      }),
    );
  } catch (e) {
    if (e instanceof Abbruch) return e.ergebnis;
    throw e;
  }
}
