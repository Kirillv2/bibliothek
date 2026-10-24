"use server";
// F-05 · E03-US01 · Ausleihen von der Detailseite in einem Schritt (NFR01). Prüfungen in `ausleihen()`.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formatiereDatum } from "@/lib/datum";
import { erstelleKontext } from "@/server/anfrage";
import { ausleihen } from "@/server/ausleihe";
import { FEHLERTEXTE } from "../meldungen";

export type AusleiheMeldung = { ok: boolean; text: string } | null;

export async function ausleiheAusloesen(_vorher: AusleiheMeldung, formular: FormData): Promise<AusleiheMeldung> {
  const eingabe = formular.get("titleId");
  const titleId = typeof eingabe === "string" ? eingabe : "";
  const ergebnis = await ausleihen(await erstelleKontext(), { titleId });
  if (!ergebnis.ok) {
    // AK-05.1, E06-US01-FR02: ohne Anmeldung zur Anmeldung, danach zurück zum Titel
    if (ergebnis.fehler === "NICHT_ANGEMELDET") redirect(`/anmelden?weiter=${encodeURIComponent(`/titel/${titleId}`)}`);
    return { ok: false, text: FEHLERTEXTE[ergebnis.fehler] };
  }
  // Status der Exemplare auf der Detailseite neu laden
  revalidatePath(`/titel/${titleId}`);
  const { title, inventoryNumber, dueDate } = ergebnis.daten;
  // AK-01.8: Titel, Inventarnummer und Fälligkeit (TT.MM.JJJJ)
  return {
    ok: true,
    text: `„${title}“ ist ausgeliehen: Exemplar ${inventoryNumber}, bitte zurückgeben bis ${formatiereDatum(dueDate)}.`,
  };
}
