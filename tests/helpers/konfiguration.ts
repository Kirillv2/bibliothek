// Konfigurationswerte für Tests (ADR 006).
// Tests schreiben keine eigenen Zahlen für Leihfrist, Limit usw., sondern nehmen
// Standard und Grenzen aus config/system.defaults.json und rechnen Erwartungen daraus.
import defaults from "../../config/system.defaults.json";

export type EinstellungName =
  | "leihfristTage"
  | "ausleihlimitProMitglied"
  | "maxVerlaengerungen"
  | "mahnTagessatzEuro"
  | "erinnerungVorlaufTage"
  | "abholfristVormerkungTage";

type Eintrag = { standard: number; min: number; max: number };

function eintrag(name: EinstellungName): Eintrag {
  return (defaults as unknown as Record<EinstellungName, Eintrag>)[name];
}

export function standardWert(name: EinstellungName): number {
  return eintrag(name).standard;
}

export function grenzen(name: EinstellungName): { min: number; max: number } {
  const { min, max } = eintrag(name);
  return { min, max };
}

/** Ein gültiger Wert (innerhalb min/max), der sich von `wert` unterscheidet. */
export function andererGueltigerWert(name: EinstellungName, wert: number): number {
  const { min, max } = grenzen(name);
  if (min === max) throw new Error(`${name} hat nur einen gültigen Wert`);
  const schritt = Number.isInteger(wert) ? 1 : 0.5;
  return wert + schritt <= max ? wert + schritt : wert - schritt;
}

/** Mahngebühr in Cent für k überschrittene Tage beim Tagessatz in Euro (ADR 006: Cent als ganze Zahl). */
export function gebuehrCents(tage: number, tagessatzEuro: number): number {
  return Math.round(tage * tagessatzEuro * 100);
}
