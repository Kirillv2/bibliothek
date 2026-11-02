// Start des Server-Prozesses (Next.js Instrumentation): eingebauter Zeitgeber für die täglichen System-Jobs
// (F-08 E04-US01-FR01, F-10 E05-US01-FR03; OF-J3, ADR 007 Punkt 7, Issue #42).

/** OF-J3: stündlich prüfen, ob die Jobs für den heutigen Stichtag schon gelaufen sind (Technik, kein Fachwert). */
const PRUEFINTERVALL_MS = 60 * 60 * 1000;

const speicher = globalThis as unknown as { bibliothekZeitgeber?: boolean };

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  // Ein Zeitgeber je Prozess, auch wenn der Entwicklungsserver neu lädt
  if (speicher.bibliothekZeitgeber) return;
  speicher.bibliothekZeitgeber = true;

  const [{ starteZeitgeber }, { holeDatenbank }, { systemUhr }] = await Promise.all([
    import("./server/jobs/zeitgeber"),
    import("./server/db/verbindung"),
    import("./server/kontext"),
  ]);
  starteZeitgeber({
    kontext: async () => ({ db: await holeDatenbank(), uhr: systemUhr, sitzung: null }),
    intervallMs: PRUEFINTERVALL_MS,
  });
}
