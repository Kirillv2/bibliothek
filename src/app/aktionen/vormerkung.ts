"use server";
// F-10 · E05-US01-FR01 · Vormerken von der Detailseite in einem Schritt (NFR01). Prüfungen in `vormerken()`.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { erstelleKontext } from "@/server/anfrage";
import { vormerken } from "@/server/vormerkung";
import { FEHLERTEXTE } from "../meldungen";

export type VormerkungMeldung = { ok: boolean; text: string } | null;

export async function vormerkungAusloesen(_vorher: VormerkungMeldung, formular: FormData): Promise<VormerkungMeldung> {
  const eingabe = formular.get("titleId");
  const titleId = typeof eingabe === "string" ? eingabe : "";
  const ergebnis = await vormerken(await erstelleKontext(), { titleId });
  if (!ergebnis.ok) {
    // OF-R2: ohne Anmeldung zur Anmeldung, danach zurück zum Titel
    if (ergebnis.fehler === "NICHT_ANGEMELDET") redirect(`/anmelden?weiter=${encodeURIComponent(`/titel/${titleId}`)}`);
    return { ok: false, text: FEHLERTEXTE[ergebnis.fehler] };
  }
  revalidatePath(`/titel/${titleId}`);
  revalidatePath("/konto/vormerkungen");
  // E05-US01-FR02: Platz in der Warteschlange
  return { ok: true, text: `Vorgemerkt. Du bist auf Platz ${ergebnis.daten.position} der Warteschlange.` };
}
