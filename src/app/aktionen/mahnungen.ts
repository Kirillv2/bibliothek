"use server";
// F-09 · E04-US02-FR03 · Mahnung als beglichen markieren. Prüfungen in src/server/mahnungen.ts.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { erstelleKontext } from "@/server/anfrage";
import { mahnungBegleichen } from "@/server/mahnungen";
import { FEHLERTEXTE } from "../meldungen";

export type BegleichenMeldung = { ok: boolean; text: string } | null;

export async function mahnungBegleichenAusloesen(_vorher: BegleichenMeldung, formular: FormData): Promise<BegleichenMeldung> {
  const eingabe = formular.get("dunningId");
  const ergebnis = await mahnungBegleichen(await erstelleKontext(), { dunningId: typeof eingabe === "string" ? eingabe : "" });
  if (!ergebnis.ok) {
    if (ergebnis.fehler === "NICHT_ANGEMELDET") redirect("/anmelden?weiter=%2Fverwaltung%2Fmahnungen");
    return { ok: false, text: FEHLERTEXTE[ergebnis.fehler] };
  }
  revalidatePath("/verwaltung/mahnungen");
  return { ok: true, text: "Als beglichen markiert." };
}
