// F-08 · E04-US01-FR01 und F-10 · E05-US01-FR03 · Eingebauter Zeitgeber (OF-J3, ADR 007 Punkt 7, Issue #42).
// „Ein zeitgesteuerter Prozess prüft täglich“: Ohne gehostete Instanz gibt es keinen externen Auslöser,
// deshalb prüft der Server-Prozess selbst, ob die Jobs für den heutigen Stichtag schon gelaufen sind.
// Die Idempotenz bleibt bei den Jobs (eindeutige Schlüssel, NFR04); diese Prüfung ist nur der Auslöser.
import { sql } from "drizzle-orm";
import type { Datum } from "@/lib/datum";
import { zeilen } from "../db";
import type { JOBS } from "../db/schema";
import { erfolg, type Ergebnis } from "../ergebnis";
import type { Kontext } from "../kontext";
import { abholfristen } from "./abholfristen";
import { fristpruefung } from "./fristpruefung";

type Job = (typeof JOBS)[number];

/** Reihenfolge: erst Fristen und Mahnungen, dann Abholfristen (AK-01.8, F-10 AK-03.11). */
const TAGESJOBS: { job: Job; ausfuehren: (k: Kontext) => Promise<Ergebnis<unknown>> }[] = [
  { job: "FRISTPRUEFUNG", ausfuehren: fristpruefung },
  { job: "ABHOLFRISTEN", ausfuehren: abholfristen },
];

export type TagesjobsErgebnis = { stichtag: Datum; ausgefuehrt: Job[] };

/** Jobs mit abgeschlossenem Lauf für den Stichtag (Zeitgeber oder Endpunkt); Läufe ohne Ende zählen nicht (AK-01.9). */
async function abgeschlosseneJobs(k: Kontext, stichtag: Datum): Promise<Set<string>> {
  const laeufe = zeilen<{ job: string }>(
    await k.db.execute(sql`
      SELECT DISTINCT job FROM job_runs WHERE stichtag = ${stichtag}::date AND finished_at IS NOT NULL`),
  );
  return new Set(laeufe.map((l) => l.job));
}

/** Führt die Tagesjobs aus, die für `k.uhr.heute()` noch keinen abgeschlossenen Lauf haben. */
export async function fuehreTagesjobsAus(k: Kontext): Promise<Ergebnis<TagesjobsErgebnis>> {
  const stichtag = k.uhr.heute();
  const erledigt = await abgeschlosseneJobs(k, stichtag);
  const ausgefuehrt: Job[] = [];
  for (const { job, ausfuehren } of TAGESJOBS) {
    if (erledigt.has(job)) continue;
    const ergebnis = await ausfuehren(k);
    if (!ergebnis.ok) return ergebnis;
    ausgefuehrt.push(job);
  }
  return erfolg({ stichtag, ausgefuehrt });
}

type Timer = { setInterval(fn: () => void, ms: number): unknown; clearInterval(handle: unknown): void };

export type ZeitgeberOptionen = {
  /** Kontext je Prüfung (Datenbank und Uhr); ohne Sitzung, Rolle System. */
  kontext: () => Promise<Kontext>;
  intervallMs: number;
  timer?: Timer;
  melde?: (text: string, fehler?: unknown) => void;
};

export type Zeitgeber = { pruefe(): Promise<void>; stoppen(): void; bereit: Promise<void> };

/**
 * Prüft sofort und danach alle `intervallMs`. Nie zwei Läufe gleichzeitig: eine Prüfung während eines
 * Laufs wartet auf diesen. Fehler werden gemeldet und nicht geworfen (AK-01.10).
 */
export function starteZeitgeber(optionen: ZeitgeberOptionen): Zeitgeber {
  const timer: Timer = optionen.timer ?? {
    setInterval: (fn, ms) => {
      const handle = setInterval(fn, ms);
      handle.unref?.();
      return handle;
    },
    clearInterval: (handle) => clearInterval(handle as ReturnType<typeof setInterval>),
  };
  const melde = optionen.melde ?? ((text, fehler) => console.error(text, fehler));
  let laufend: Promise<void> | null = null;

  async function einLauf(): Promise<void> {
    try {
      const ergebnis = await fuehreTagesjobsAus(await optionen.kontext());
      if (!ergebnis.ok) melde(`System-Jobs: Lauf fehlgeschlagen (${ergebnis.fehler})`);
    } catch (fehler) {
      melde("System-Jobs: Lauf fehlgeschlagen", fehler);
    }
  }

  function pruefe(): Promise<void> {
    laufend ??= einLauf().finally(() => {
      laufend = null;
    });
    return laufend;
  }

  const bereit = pruefe();
  const handle = timer.setInterval(() => void pruefe(), optionen.intervallMs);
  return { pruefe, stoppen: () => timer.clearInterval(handle), bereit };
}
