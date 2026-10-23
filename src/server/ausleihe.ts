// F-05 · E03-US01 · Verfügbares Exemplar ausleihen (Spec docs/specs/F-05_E03-US01.md)
// Nur Mitglieder (OF-R1). Prüfreihenfolge OF-S1: Anmeldung → Rolle → Titel existiert/aktiv →
// offene Mahnung → Ausleihlimit → verfügbares Exemplar. Alles in einer Transaktion (ADR 005).
import { sql } from "drizzle-orm";
import { berechneFaelligkeit } from "@/lib/faelligkeit";
import type { Datum } from "@/lib/datum";
import { pruefeRolle } from "./auth/rechte";
import { istEindeutigkeitsfehler, zeilen } from "./db";
import { loans } from "./db/schema";
import { istUuid, type MitWeiterenFeldern } from "./eingabe";
import { Abbruch, erfolg, fehler, type Ergebnis } from "./ergebnis";
import { exemplarIstVerfuegbar } from "./katalog/verfuegbarkeit";
import type { Kontext } from "./kontext";
import { getSetting } from "./settings";

export type AusleiheEingabe = { titleId: string } & MitWeiterenFeldern;

export type AusleiheErgebnis = {
  loanId: string;
  title: string;
  inventoryNumber: string;
  startDate: Datum;
  dueDate: Datum;
};

// Wie oft eine Ausleihe wiederholt wird, wenn ein gleichzeitiger Vorgang dasselbe Exemplar bekommen hat (ADR 005, Punkt 3)
const VERSUCHE_BEI_GLEICHZEITIGKEIT = 5;

export async function ausleihen(k: Kontext, eingabe: AusleiheEingabe): Promise<Ergebnis<AusleiheErgebnis>> {
  const rechte = pruefeRolle(k.sitzung, "MITGLIED");
  if (rechte) return rechte;
  // AK-05.8: die Mitglieds-ID kommt nur aus der Sitzung, nie aus der Eingabe
  const memberId = k.sitzung!.userId;
  const titleId = eingabe?.titleId;
  if (!istUuid(titleId)) return fehler("NICHT_GEFUNDEN");

  for (let versuch = 1; versuch <= VERSUCHE_BEI_GLEICHZEITIGKEIT; versuch++) {
    try {
      return erfolg(await ausleiheInTransaktion(k, memberId, titleId));
    } catch (e) {
      if (e instanceof Abbruch) return e.ergebnis;
      // NFR06: der eindeutige Index hat einen zweiten offenen Vorgang verhindert → nächstes Exemplar versuchen
      if (!istEindeutigkeitsfehler(e)) throw e;
    }
  }
  return fehler("KEIN_EXEMPLAR_VERFUEGBAR");
}

async function ausleiheInTransaktion(k: Kontext, memberId: string, titleId: string): Promise<AusleiheErgebnis> {
  return k.db.transaction(async (tx) => {
    // Ausleihen desselben Mitglieds nacheinander, damit das Limit auch bei gleichzeitigen Anfragen hält
    await tx.execute(sql`SELECT id FROM users WHERE id = ${memberId} FOR UPDATE`);

    // OF-D4, AK-05.5: archivierte oder unbekannte Titel sind nicht ausleihbar
    const [titel] = zeilen<{ title: string }>(
      await tx.execute(sql`SELECT title FROM titles WHERE id = ${titleId} AND archived_at IS NULL FOR SHARE`),
    );
    if (!titel) throw new Abbruch(fehler("NICHT_GEFUNDEN"));

    // E03-US01-FR03: keine offene (nicht beglichene) Mahnung
    const [mahnung] = zeilen<{ id: string }>(
      await tx.execute(sql`
        SELECT d.id FROM dunnings d JOIN loans l ON l.id = d.loan_id
        WHERE l.member_id = ${memberId} AND d.settled_at IS NULL
        LIMIT 1`),
    );
    if (mahnung) throw new Abbruch(fehler("OFFENE_MAHNUNG"));

    // E03-US01-FR03: offene Ausleihen unter dem konfigurierten Limit
    const limit = await getSetting(tx, "ausleihlimitProMitglied");
    const [offen] = zeilen<{ n: number }>(
      await tx.execute(sql`SELECT count(*)::int AS n FROM loans WHERE member_id = ${memberId} AND returned_at IS NULL`),
    );
    if (Number(offen?.n ?? 0) >= limit) throw new Abbruch(fehler("AUSLEIHLIMIT_ERREICHT"));

    // E03-US01-FR01, OF-F05-1: das verfügbare Exemplar mit der kleinsten Inventarnummer
    const [exemplar] = zeilen<{ id: string; inventory_number: string }>(
      await tx.execute(sql`
        SELECT c.id, c.inventory_number FROM copies c
        WHERE c.title_id = ${titleId} AND ${exemplarIstVerfuegbar("c")}
        ORDER BY c.inventory_number
        LIMIT 1`),
    );
    if (!exemplar) throw new Abbruch(fehler("KEIN_EXEMPLAR_VERFUEGBAR"));

    const startDate = k.uhr.heute();
    const dueDate = berechneFaelligkeit(startDate, await getSetting(tx, "leihfristTage"));
    const [vorgang] = await tx
      .insert(loans)
      .values({ copyId: exemplar.id, memberId, startDate, dueDate, renewalCount: 0 })
      .returning({ id: loans.id });

    return { loanId: vorgang.id, title: titel.title, inventoryNumber: exemplar.inventory_number, startDate, dueDate };
  });
}
