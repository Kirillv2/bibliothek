// Einzige Stelle, die Konfigurationswerte liest (ADR 006).
// Reihenfolge: Wert aus system_settings (Administrator, ab F-12), sonst `standard` aus config/system.defaults.json.
// Ein gespeicherter Wert außerhalb von min/max wird ignoriert und der Standard genommen.
import { eq } from "drizzle-orm";
import defaults from "../../../config/system.defaults.json";
import type { Datenbank } from "../db";
import { systemSettings } from "../db/schema";

export type EinstellungName =
  | "leihfristTage"
  | "ausleihlimitProMitglied"
  | "maxVerlaengerungen"
  | "mahnTagessatzEuro"
  | "erinnerungVorlaufTage"
  | "abholfristVormerkungTage"
  | "sitzungDauerStunden";

type Eintrag = { standard: number; min: number; max: number };

function eintrag(name: EinstellungName): Eintrag {
  const wert = (defaults as unknown as Record<string, Eintrag | undefined>)[name];
  if (!wert) throw new Error(`Konfigurationswert ${name} fehlt in config/system.defaults.json`);
  return wert;
}

/** Grenzen und Standard eines Konfigurationswerts aus config/system.defaults.json. */
export function grenzenVon(name: EinstellungName): Eintrag {
  const { standard, min, max } = eintrag(name);
  return { standard, min, max };
}

/** Gültiger Wert eines Konfigurationswerts. */
export async function getSetting(db: Datenbank, name: EinstellungName): Promise<number> {
  const { standard, min, max } = eintrag(name);
  const [zeile] = await db
    .select({ value: systemSettings.value })
    .from(systemSettings)
    .where(eq(systemSettings.key, name))
    .limit(1);
  if (!zeile) return standard;
  const wert = Number(zeile.value);
  if (!Number.isFinite(wert) || wert < min || wert > max) {
    console.warn(`Systemparameter ${name}=${zeile.value} liegt außerhalb von ${min}…${max}; Standard wird verwendet.`);
    return standard;
  }
  return wert;
}

export type EinstellungMitGrenzen = { name: EinstellungName; standard: number; min: number; max: number; quelle: string };

/** Alle Konfigurationswerte aus config/system.defaults.json in der Reihenfolge der Datei (F-12, OF-F12-3). */
export function alleEinstellungen(): EinstellungMitGrenzen[] {
  return Object.entries(defaults as unknown as Record<string, unknown>)
    .filter(([name]) => !name.startsWith("_"))
    .map(([name, wert]) => {
      const e = wert as Eintrag & { quelle?: string };
      return { name: name as EinstellungName, standard: e.standard, min: e.min, max: e.max, quelle: e.quelle ?? "" };
    });
}

/** Nur Namen, die als eigener Eintrag in config/system.defaults.json stehen (kein `_hinweis`, kein `__proto__`). */
export function istEinstellungName(name: unknown): name is EinstellungName {
  return typeof name === "string" && alleEinstellungen().some((e) => e.name === name);
}
