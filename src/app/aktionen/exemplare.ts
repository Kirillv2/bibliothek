"use server";
// F-04 · E02-US02 · Formulare für Exemplare. Rechte und Prüfungen liegen in src/server/exemplare.ts.
import { revalidatePath } from "next/cache";
import { erstelleKontext } from "@/server/anfrage";
import type { Zustand } from "@/server/db/schema";
import { exemplarAnlegen, exemplarZustandAendern } from "@/server/exemplare";
import { FEHLERTEXTE } from "../meldungen";

export type ExemplarMeldung = { ok: boolean; text: string } | null;

function text(formular: FormData, name: string): string {
  const wert = formular.get(name);
  return typeof wert === "string" ? wert : "";
}

export async function exemplarAnlegenAusFormular(_vorher: ExemplarMeldung, formular: FormData): Promise<ExemplarMeldung> {
  const titleId = text(formular, "titleId");
  const ergebnis = await exemplarAnlegen(await erstelleKontext(), {
    titleId,
    condition: text(formular, "condition") as Zustand,
  });
  if (!ergebnis.ok) return { ok: false, text: FEHLERTEXTE[ergebnis.fehler] };
  revalidatePath(`/verwaltung/titel/${titleId}`);
  return { ok: true, text: `Exemplar ${ergebnis.daten.inventoryNumber} angelegt.` };
}

export async function zustandAendernAusFormular(_vorher: ExemplarMeldung, formular: FormData): Promise<ExemplarMeldung> {
  const ergebnis = await exemplarZustandAendern(await erstelleKontext(), {
    copyId: text(formular, "copyId"),
    condition: text(formular, "condition") as Zustand,
  });
  if (!ergebnis.ok) return { ok: false, text: FEHLERTEXTE[ergebnis.fehler] };
  revalidatePath(`/verwaltung/titel/${text(formular, "titleId")}`);
  return { ok: true, text: "Zustand gespeichert." };
}
