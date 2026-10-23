"use server";
// F-06 · E03-US02 · Verlängern aus „Meine Ausleihen“. Prüfungen in src/server/verlaengerung.ts.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formatiereDatum } from "@/lib/datum";
import { erstelleKontext } from "@/server/anfrage";
import { verlaengern } from "@/server/verlaengerung";
import { FEHLERTEXTE } from "../meldungen";

export type VerlaengerungMeldung = { ok: boolean; text: string } | null;

export async function verlaengerungAusloesen(_vorher: VerlaengerungMeldung, formular: FormData): Promise<VerlaengerungMeldung> {
  const eingabe = formular.get("loanId");
  const ergebnis = await verlaengern(await erstelleKontext(), { loanId: typeof eingabe === "string" ? eingabe : "" });
  if (!ergebnis.ok) {
    if (ergebnis.fehler === "NICHT_ANGEMELDET") redirect("/anmelden?weiter=%2Fkonto%2Fausleihen");
    return { ok: false, text: FEHLERTEXTE[ergebnis.fehler] };
  }
  revalidatePath("/konto/ausleihen");
  const { dueDate, mahngebuehrCents } = ergebnis.daten;
  const gebuehr =
    mahngebuehrCents !== undefined
      ? ` Weil die Frist schon überschritten war, wurde eine Mahnung über ${(mahngebuehrCents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" })} erstellt.`
      : "";
  return { ok: true, text: `Verlängert bis ${formatiereDatum(dueDate)}.${gebuehr}` };
}
