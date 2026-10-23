// Status eines Exemplars (ADR 005, Punkt 2): wird abgeleitet, nicht gespeichert.
// Reihenfolge der Regeln: ausgeliehen vor vorgemerkt vor gesperrt (OF-F04-1).
import type { Datum } from "./datum";

export type Exemplarstatus = "VERFUEGBAR" | "AUSGELIEHEN" | "VORGEMERKT" | "GESPERRT";

export type ExemplarstatusEingabe = {
  condition: "GUT" | "BESCHAEDIGT" | "VERLOREN";
  offeneAusleihe: { dueDate: Datum } | null;
  abholbereitZugeordnet: boolean;
};

export type AbgeleiteterStatus = { status: Exemplarstatus; faelligAm?: Datum };

export function leiteExemplarstatusAb(exemplar: ExemplarstatusEingabe): AbgeleiteterStatus {
  // E01-US02-FR01: „ausgeliehen bis TT.MM.JJJJ“
  if (exemplar.offeneAusleihe) return { status: "AUSGELIEHEN", faelligAm: exemplar.offeneAusleihe.dueDate };
  // E01-US02-FR01, E03-US03-FR03: einer abholbereiten Vormerkung zugeordnet
  if (exemplar.abholbereitZugeordnet) return { status: "VORGEMERKT" };
  // OF-D2, OF-F02-2: verloren = „nicht verfügbar“; beschädigt bleibt ausleihbar
  if (exemplar.condition === "VERLOREN") return { status: "GESPERRT" };
  return { status: "VERFUEGBAR" };
}
