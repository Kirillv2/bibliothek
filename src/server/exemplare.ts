// F-04 · E02-US02 · Exemplare anlegen und Zustand pflegen (Spec docs/specs/F-04_E02-US02.md)
// Nur Bibliothekar (Rechte-Matrix, OF-R3). Exemplare werden nie gelöscht (OF-F04-3).
import { sql } from "drizzle-orm";
import type { Datum } from "@/lib/datum";
import { leiteExemplarstatusAb, type Exemplarstatus } from "@/lib/exemplarstatus";
import { formatiereInventarnummer } from "@/lib/inventarnummer";
import { pruefeRolle } from "./auth/rechte";
import { istEindeutigkeitsfehler, zeilen } from "./db";
import { ZUSTAENDE, type Zustand } from "./db/schema";
import { istUuid, type MitWeiterenFeldern } from "./eingabe";
import { Abbruch, erfolg, fehler, type Ergebnis } from "./ergebnis";
import type { Kontext } from "./kontext";
import { lageDesExemplars } from "./katalog/verfuegbarkeit";

// Wiederholungen, falls eine Nummer der Folge schon vergeben ist (z. B. von Hand eingespielte Altdaten)
const VERSUCHE_BEI_BELEGTER_NUMMER = 5;

function istZustand(wert: unknown): wert is Zustand {
  return typeof wert === "string" && (ZUSTAENDE as readonly string[]).includes(wert);
}

const ZUSTAND_FEHLER = { condition: "Zustand muss „gut“, „beschädigt“ oder „verloren“ sein." };

export type ExemplarAnlegenEingabe = { titleId: string; condition?: Zustand } & MitWeiterenFeldern;

export async function exemplarAnlegen(
  k: Kontext,
  eingabe: ExemplarAnlegenEingabe,
): Promise<Ergebnis<{ copyId: string; inventoryNumber: string }>> {
  const rechte = pruefeRolle(k.sitzung, "BIBLIOTHEKAR");
  if (rechte) return rechte;
  const titleId = eingabe?.titleId;
  if (!istUuid(titleId)) return fehler("NICHT_GEFUNDEN");
  // AK-02.1, OF-D3: ohne Angabe „gut“
  const condition = eingabe.condition ?? "GUT";
  if (!istZustand(condition)) return fehler("VALIDIERUNG", ZUSTAND_FEHLER);

  for (let versuch = 1; ; versuch++) {
    try {
      return erfolg(
        await k.db.transaction(async (tx) => {
          // Sperre gegen gleichzeitiges Archivieren desselben Titels (titelArchivieren sperrt FOR UPDATE)
          const [titel] = zeilen<{ archiviert: boolean }>(
            await tx.execute(sql`SELECT archived_at IS NOT NULL AS archiviert FROM titles WHERE id = ${titleId} FOR SHARE`),
          );
          if (!titel) throw new Abbruch(fehler("NICHT_GEFUNDEN"));
          // AK-01.6, OF-F04-2
          if (titel.archiviert) throw new Abbruch(fehler("TITEL_ARCHIVIERT"));

          // E02-US02-FR01: die Nummer vergibt immer das System aus der Folge (AK-01.4); eine mitgeschickte wird ignoriert
          const [folge] = zeilen<{ n: string | number }>(await tx.execute(sql`SELECT nextval('inventory_number_seq') AS n`));
          const inventoryNumber = formatiereInventarnummer(Number(folge.n));
          const [neu] = zeilen<{ id: string }>(
            await tx.execute(sql`
              INSERT INTO copies (title_id, inventory_number, condition, created_at)
              VALUES (${titleId}, ${inventoryNumber}, ${condition}, ${k.uhr.jetzt()})
              RETURNING id`),
          );
          return { copyId: neu.id, inventoryNumber };
        }),
      );
    } catch (e) {
      if (e instanceof Abbruch) return e.ergebnis;
      // AK-01.3: der eindeutige Index hat eine doppelte Nummer verhindert → nächste Nummer der Folge
      if (!istEindeutigkeitsfehler(e) || versuch >= VERSUCHE_BEI_BELEGTER_NUMMER) throw e;
    }
  }
}

export type ZustandAendernEingabe = { copyId: string; condition: Zustand } & MitWeiterenFeldern;

/** E02-US02-FR02: Zustand ändern; ein offener Ausleihvorgang bleibt davon unberührt (AK-02.7, OF-F04-1). */
export async function exemplarZustandAendern(
  k: Kontext,
  eingabe: ZustandAendernEingabe,
): Promise<Ergebnis<{ copyId: string; condition: Zustand }>> {
  const rechte = pruefeRolle(k.sitzung, "BIBLIOTHEKAR");
  if (rechte) return rechte;
  const copyId = eingabe?.copyId;
  if (!istUuid(copyId)) return fehler("NICHT_GEFUNDEN");
  const condition = eingabe.condition;
  if (!istZustand(condition)) return fehler("VALIDIERUNG", ZUSTAND_FEHLER);

  const geaendert = zeilen<{ id: string }>(
    await k.db.execute(sql`UPDATE copies SET condition = ${condition} WHERE id = ${copyId} RETURNING id`),
  );
  if (geaendert.length === 0) return fehler("NICHT_GEFUNDEN");
  return erfolg({ copyId, condition });
}

export type ExemplarInDerVerwaltung = {
  copyId: string;
  inventoryNumber: string;
  condition: Zustand;
  status: Exemplarstatus;
  faelligAm?: Datum;
};

/** Exemplare eines Titels für die Verwaltung, mit Zustand und abgeleitetem Status (ADR 005), ohne Personendaten. */
export async function ladeExemplareDesTitels(k: Kontext, titleId: string): Promise<Ergebnis<ExemplarInDerVerwaltung[]>> {
  const rechte = pruefeRolle(k.sitzung, "BIBLIOTHEKAR");
  if (rechte) return rechte;
  if (!istUuid(titleId)) return fehler("NICHT_GEFUNDEN");
  const liste = zeilen<{ id: string; inventory_number: string; condition: Zustand; due_date: Datum | null; abholbereit: boolean }>(
    await k.db.execute(sql`
      SELECT c.id, c.inventory_number, c.condition, ${lageDesExemplars("c")}
      FROM copies c WHERE c.title_id = ${titleId}
      ORDER BY c.inventory_number`),
  );
  return erfolg(
    liste.map((z) => ({
      copyId: z.id,
      inventoryNumber: z.inventory_number,
      condition: z.condition,
      ...leiteExemplarstatusAb({
        condition: z.condition,
        offeneAusleihe: z.due_date ? { dueDate: z.due_date } : null,
        abholbereitZugeordnet: Boolean(z.abholbereit),
      }),
    })),
  );
}
