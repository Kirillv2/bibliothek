// Kontext, den jede Funktion der Anwendungsschicht als ersten Parameter bekommt
// (ADR 004, docs/testing/README.md „Vertrag mit Development“, Punkt 2).
import { datumInBerlin, type Datum } from "@/lib/datum";
import type { Datenbank } from "./db";
import type { Rolle } from "./db/schema";

export type { Rolle } from "./db/schema";

/** Angemeldeter Nutzer; Rolle und ID kommen nur aus der Sitzung (ADR 003). Gast = `null`. */
export type Sitzung = { userId: string; role: Rolle };

/** Uhr (ADR 004 `Clock`, ADR 008): „heute“ als Datum in Europe/Berlin, „jetzt“ als Zeitpunkt. */
export type Uhr = { heute(): Datum; jetzt(): Date };

export type Kontext = { db: Datenbank; uhr: Uhr; sitzung: Sitzung | null };

export const systemUhr: Uhr = {
  heute: () => datumInBerlin(new Date()),
  jetzt: () => new Date(),
};
