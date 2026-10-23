"use server";
// F-05 · E03-US01 · Ausleihen von der Detailseite in einem Schritt (NFR01). Prüfungen in `ausleihen()`.
import { revalidatePath } from "next/cache";
import { formatiereDatum } from "@/lib/datum";
import { erstelleKontext } from "@/server/anfrage";
import { ausleihen } from "@/server/ausleihe";
import { FEHLERTEXTE } from "../meldungen";

export type AusleiheMeldung = { ok: boolean; text: string } | null;

export async function ausleiheAusloesen(_vorher: AusleiheMeldung, formular: FormData): Promise<AusleiheMeldung> {
  const eingabe = formular.get("titleId");
  const titleId = typeof eingabe === "string" ? eingabe : "";
  const ergebnis = await ausleihen(await erstelleKontext(), { titleId });
  if (!ergebnis.ok) return { ok: false, text: FEHLERTEXTE[ergebnis.fehler] };
  // Status der Exemplare auf der Detailseite neu laden
  revalidatePath(`/titel/${titleId}`);
  const { inventoryNumber, dueDate } = ergebnis.daten;
  // E03-US01-FR01: Bestätigung mit Fälligkeit
  return { ok: true, text: `Ausgeliehen: Exemplar ${inventoryNumber}, zurückgeben bis ${formatiereDatum(dueDate)}.` };
}
