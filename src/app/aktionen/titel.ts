"use server";
// F-03 · E02-US01 · Formulare der Titelverwaltung. Rechte und Prüfungen liegen in src/server/titel.ts.
import { redirect } from "next/navigation";
import { erstelleKontext } from "@/server/anfrage";
import { titelAnlegen, titelArchivieren, titelBearbeiten } from "@/server/titel";
import { FEHLERTEXTE } from "../meldungen";

export type TitelFormularWerte = {
  title: string;
  author: string;
  category: string;
  isbn: string;
  description: string;
  publicationYear: string;
};

export type TitelFormularZustand = {
  meldung?: string;
  felder?: Record<string, string>;
  werte?: TitelFormularWerte;
};

function text(formular: FormData, name: string): string {
  const wert = formular.get(name);
  return typeof wert === "string" ? wert : "";
}

/** Leeres Jahr = nicht angegeben (OF-D1); alles andere wird als Zahl geprüft. */
function jahr(wert: string): number | undefined {
  const getrimmt = wert.trim();
  if (getrimmt === "") return undefined;
  return /^-?\d+$/.test(getrimmt) ? Number(getrimmt) : Number.NaN;
}

export async function titelSpeichern(_vorher: TitelFormularZustand, formular: FormData): Promise<TitelFormularZustand> {
  const werte: TitelFormularWerte = {
    title: text(formular, "title"),
    author: text(formular, "author"),
    category: text(formular, "category"),
    isbn: text(formular, "isbn"),
    description: text(formular, "description"),
    publicationYear: text(formular, "publicationYear"),
  };
  const felder = { ...werte, publicationYear: jahr(werte.publicationYear) };
  const titleId = text(formular, "titleId");
  const k = await erstelleKontext();

  const ergebnis = titleId ? await titelBearbeiten(k, { titleId, ...felder }) : await titelAnlegen(k, felder);
  if (!ergebnis.ok) {
    return {
      meldung: ergebnis.fehler === "VALIDIERUNG" ? "Bitte die markierten Felder korrigieren." : FEHLERTEXTE[ergebnis.fehler],
      felder: ergebnis.felder,
      werte,
    };
  }
  redirect(`/verwaltung/titel/${ergebnis.daten.titleId}?gespeichert=1`);
}

export type ArchivZustand = { meldung?: string };

export async function titelArchivierenAusFormular(_vorher: ArchivZustand, formular: FormData): Promise<ArchivZustand> {
  const titleId = text(formular, "titleId");
  const ergebnis = await titelArchivieren(await erstelleKontext(), { titleId });
  if (!ergebnis.ok) return { meldung: FEHLERTEXTE[ergebnis.fehler] };
  redirect(`/verwaltung/titel/${titleId}?archiviert=1`);
}
