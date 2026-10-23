// E04-US02-FR02 · Mahngebühr = überschrittene Kalendertage × mahnTagessatzEuro, als ganze Cent (ADR 006, ADR 008)
import { tageZwischen, type Datum } from "./datum";

/** Gebühr in Cent für die Tage nach `dueDate` bis `stichtag`; am oder vor dem Fälligkeitstag 0. */
export function berechneMahngebuehrCents(eingabe: { dueDate: Datum; stichtag: Datum; tagessatzEuro: number }): number {
  const tage = tageZwischen(eingabe.dueDate, eingabe.stichtag);
  if (tage <= 0) return 0;
  return Math.round(tage * eingabe.tagessatzEuro * 100);
}
