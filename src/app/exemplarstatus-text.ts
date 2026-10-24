// Anzeige des Exemplarstatus (E01-US02-FR01): verfügbar / ausgeliehen bis TT.MM.JJJJ / vorgemerkt;
// GESPERRT wird als „nicht verfügbar“ angezeigt (OF-F02-2).
import { formatiereDatum, type Datum } from "@/lib/datum";
import type { Exemplarstatus } from "@/lib/exemplarstatus";

export function statusText(exemplar: { status: Exemplarstatus; faelligAm?: Datum }): string {
  switch (exemplar.status) {
    case "AUSGELIEHEN":
      return `ausgeliehen bis ${formatiereDatum(exemplar.faelligAm!)}`;
    case "VORGEMERKT":
      return "vorgemerkt";
    case "GESPERRT":
      return "nicht verfügbar";
    default:
      return "verfügbar";
  }
}

export const ZUSTAND_TEXT = { GUT: "gut", BESCHAEDIGT: "beschädigt", VERLOREN: "verloren" } as const;
