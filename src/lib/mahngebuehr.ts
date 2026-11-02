// E04-US02-FR02 · Mahngebühr = überschrittene Kalendertage × mahnTagessatzEuro, als ganze Cent (ADR 006, ADR 008)
import { tageZwischen, type Datum } from "./datum";

/** Gebühr in Cent für die Tage nach `dueDate` bis `stichtag`; am oder vor dem Fälligkeitstag 0. */
export function berechneMahngebuehrCents(eingabe: { dueDate: Datum; stichtag: Datum; tagessatzEuro: number }): number {
  const tage = tageZwischen(eingabe.dueDate, eingabe.stichtag);
  if (tage <= 0) return 0;
  return Math.round(tage * eingabe.tagessatzEuro * 100);
}

/** Überschrittene Kalendertage von `dueDate` bis `bis`; nie negativ (ADR 008, OF-Z2). */
export function ueberschritteneTage(dueDate: Datum, bis: Datum): number {
  return Math.max(0, tageZwischen(dueDate, bis));
}

/**
 * E04-US02-FR02, OF-F09-1: Gebühr einer Mahnung = festgehaltene Gebühr früherer Überschreitungen
 * + Gebühr der noch laufenden Überschreitung bis zum Stichtag (falls der Vorgang offen und überfällig ist).
 */
export function gesamtgebuehrCents(eingabe: {
  festgehaltenCents: number | null;
  laufend: { dueDate: Datum; stichtag: Datum } | null;
  tagessatzEuro: number;
}): number {
  const fest = eingabe.festgehaltenCents ?? 0;
  if (!eingabe.laufend) return fest;
  return fest + berechneMahngebuehrCents({ ...eingabe.laufend, tagessatzEuro: eingabe.tagessatzEuro });
}
