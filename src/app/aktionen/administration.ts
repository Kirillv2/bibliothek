"use server";
// F-12 · E06-US02 · Rollen zuweisen und Systemparameter ändern. Prüfungen in src/server/administration.ts.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { erstelleKontext } from "@/server/anfrage";
import { rolleZuweisen, systemparameterAendern } from "@/server/administration";
import type { Rolle } from "@/server/kontext";
import { FEHLERTEXTE } from "../meldungen";

export type AdminMeldung = { ok: boolean; text: string } | null;

function text(formular: FormData, feld: string): string {
  const wert = formular.get(feld);
  return typeof wert === "string" ? wert : "";
}

export async function rolleZuweisenAusloesen(_vorher: AdminMeldung, formular: FormData): Promise<AdminMeldung> {
  const ergebnis = await rolleZuweisen(await erstelleKontext(), {
    userId: text(formular, "userId"),
    role: text(formular, "role") as Rolle,
  });
  if (!ergebnis.ok) {
    if (ergebnis.fehler === "NICHT_ANGEMELDET") redirect("/anmelden?weiter=%2Fadmin%2Fnutzer");
    return { ok: false, text: ergebnis.felder?.role ?? FEHLERTEXTE[ergebnis.fehler] };
  }
  revalidatePath("/admin/nutzer");
  return { ok: true, text: "Gespeichert." };
}

/** Eingabe aus dem Formular als Zahl; Komma als Dezimaltrenner erlaubt. Leer oder Text → NaN (Server meldet VALIDIERUNG). */
function alsZahl(eingabe: string): number {
  const bereinigt = eingabe.trim().replace(",", ".");
  return bereinigt === "" || !/^-?\d+(\.\d+)?$/.test(bereinigt) ? Number.NaN : Number(bereinigt);
}

export async function systemparameterAusloesen(_vorher: AdminMeldung, formular: FormData): Promise<AdminMeldung> {
  const ergebnis = await systemparameterAendern(await erstelleKontext(), {
    name: text(formular, "name"),
    wert: alsZahl(text(formular, "wert")),
  });
  if (!ergebnis.ok) {
    if (ergebnis.fehler === "NICHT_ANGEMELDET") redirect("/anmelden?weiter=%2Fadmin%2Fparameter");
    return { ok: false, text: ergebnis.felder?.wert ?? ergebnis.felder?.name ?? FEHLERTEXTE[ergebnis.fehler] };
  }
  revalidatePath("/admin/parameter");
  return { ok: true, text: "Gespeichert. Gilt ab sofort für neue Vorgänge." };
}
