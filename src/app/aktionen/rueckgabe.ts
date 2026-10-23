"use server";
// F-07 · E03-US03 · Rückgabe per Inventarnummer. Prüfungen und Wirkung in src/server/rueckgabe.ts.
import { redirect } from "next/navigation";
import { erstelleKontext } from "@/server/anfrage";
import { rueckgabeErfassen, type RueckgabeErgebnis } from "@/server/rueckgabe";
import { FEHLERTEXTE } from "../meldungen";

export type RueckgabeZustand =
  | { art: "leer" }
  | { art: "fehler"; text: string; eingabe: string }
  | { art: "erfolg"; daten: RueckgabeErgebnis };

export async function rueckgabeAusFormular(_vorher: RueckgabeZustand, formular: FormData): Promise<RueckgabeZustand> {
  const roh = formular.get("inventoryNumber");
  const eingabe = typeof roh === "string" ? roh : "";
  const ergebnis = await rueckgabeErfassen(await erstelleKontext(), { inventoryNumber: eingabe });
  if (ergebnis.ok) return { art: "erfolg", daten: ergebnis.daten };
  if (ergebnis.fehler === "NICHT_ANGEMELDET") redirect("/anmelden?weiter=%2Fverwaltung%2Frueckgabe");
  const text =
    ergebnis.fehler === "NICHT_GEFUNDEN"
      ? `Zu „${eingabe.trim()}“ gibt es keinen offenen Ausleihvorgang.`
      : (ergebnis.felder?.inventoryNumber ?? FEHLERTEXTE[ergebnis.fehler]);
  return { art: "fehler", text, eingabe };
}
