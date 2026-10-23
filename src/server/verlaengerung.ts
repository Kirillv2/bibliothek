// F-06 · E03-US02 · Eigene Ausleihen einsehen und verlängern (Spec docs/specs/F-06_E03-US02.md)
// Nur Mitglied, nur eigene Vorgänge (Rechte-Matrix).
import { sql } from "drizzle-orm";
import type { Datum } from "@/lib/datum";
import { berechneMahngebuehrCents } from "@/lib/mahngebuehr";
import { berechneNeueFaelligkeit } from "@/lib/verlaengerung";
import { pruefeRolle } from "./auth/rechte";
import { zeilen } from "./db";
import { istUuid, type MitWeiterenFeldern } from "./eingabe";
import { Abbruch, erfolg, fehler, type Ergebnis, type Fehlercode } from "./ergebnis";
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

export type VerlaengerungErgebnis = { loanId: string; dueDate: Datum; renewalCount: number; mahngebuehrCents?: number };

/**
 * E03-US02-FR02, FR03. Prüfreihenfolge (schnittstellen.md): Vorgang gehört dem Mitglied → offen →
 * wartende Vormerkung → Höchstzahl. Alles in einer Transaktion mit gesperrtem Vorgang.
 */
export async function verlaengern(
  k: Kontext,
  eingabe: { loanId: string } & MitWeiterenFeldern,
): Promise<Ergebnis<VerlaengerungErgebnis>> {
  const rechte = pruefeRolle(k.sitzung, "MITGLIED");
  if (rechte) return rechte;
  const memberId = k.sitzung!.userId;
  const loanId = eingabe?.loanId;
  if (!istUuid(loanId)) return fehler("NICHT_GEFUNDEN");

  try {
    return erfolg(
      await k.db.transaction(async (tx) => {
        // AK-02.6: ein fremder Vorgang ist „nicht gefunden“ und verrät nicht, dass es ihn gibt
        const [vorgang] = zeilen<{
          title_id: string;
          due_date: Datum;
          renewal_count: number;
          abgeschlossen: boolean;
        }>(
          await tx.execute(sql`
            SELECT c.title_id, l.due_date::text AS due_date, l.renewal_count, l.returned_at IS NOT NULL AS abgeschlossen
            FROM loans l JOIN copies c ON c.id = l.copy_id
            WHERE l.id = ${loanId} AND l.member_id = ${memberId}
            FOR UPDATE OF l`),
        );
        if (!vorgang) throw new Abbruch(fehler("NICHT_GEFUNDEN"));
        // AK-02.7
        if (vorgang.abgeschlossen) throw new Abbruch(fehler("AUSLEIHVORGANG_ABGESCHLOSSEN"));

        const [vormerkung] = zeilen<{ id: string }>(
          await tx.execute(sql`
            SELECT id FROM reservations WHERE title_id = ${vorgang.title_id} AND status = 'WARTEND' LIMIT 1`),
        );
        const renewalCount = Number(vorgang.renewal_count);
        const grund = grundGegenVerlaengerung({
          wartendeVormerkung: vormerkung !== undefined,
          renewalCount,
          maxVerlaengerungen: await getSetting(tx, "maxVerlaengerungen"),
        });
        if (grund) throw new Abbruch(fehler(grund));

        const heute = k.uhr.heute();
        const alteFaelligkeit = vorgang.due_date;
        // AK-03.1, AK-03.2, OF-F06-2
        const dueDate = berechneNeueFaelligkeit({
          alteFaelligkeit,
          verlaengerungstag: heute,
          leihfristTage: await getSetting(tx, "leihfristTage"),
        });
        const verspaetet = heute > alteFaelligkeit;

        // AK-03.3: rechtzeitig verlängert → nicht überfällig; AK-03.4: verspätet → Überfälligkeit bleibt bestehen
        await tx.execute(sql`
          UPDATE loans SET due_date = ${dueDate}, renewal_count = renewal_count + 1,
            overdue_since = ${verspaetet ? sql`overdue_since` : sql`NULL`}
          WHERE id = ${loanId}`);

        let mahngebuehrCents: number | undefined;
        if (verspaetet) {
          // AK-03.5, OF-F06-3: überfällig ohne Mahnung → offene Mahnung mit Gebühr bis heute; höchstens eine je Vorgang
          const gebuehr = berechneMahngebuehrCents({
            dueDate: alteFaelligkeit,
            stichtag: heute,
            tagessatzEuro: await getSetting(tx, "mahnTagessatzEuro"),
          });
          const neu = zeilen<{ id: string }>(
            await tx.execute(sql`
              INSERT INTO dunnings (loan_id, created_on, fee_cents) VALUES (${loanId}, ${heute}, ${gebuehr})
              ON CONFLICT (loan_id) DO NOTHING
              RETURNING id`),
          );
          if (neu.length > 0) mahngebuehrCents = gebuehr;
        }

        return {
          loanId,
          dueDate,
          renewalCount: renewalCount + 1,
          ...(mahngebuehrCents !== undefined ? { mahngebuehrCents } : {}),
        };
      }),
    );
  } catch (e) {
    if (e instanceof Abbruch) return e.ergebnis;
    throw e;
  }
}
