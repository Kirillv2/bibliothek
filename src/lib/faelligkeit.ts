// Fälligkeit eines neuen Ausleihvorgangs (E03-US01-FR01, FR02; ADR 008, OF-Z1).
import { plusTage, type Datum } from "./datum";

/** Startdatum plus Leihfrist in Kalendertagen. Die Leihfrist kommt immer als Parameter (ADR 006). */
export function berechneFaelligkeit(startDate: Datum, leihfristTage: number): Datum {
  // E03-US01-FR02: Fälligkeit = Startdatum + konfigurierte Leihfrist
  return plusTage(startDate, leihfristTage);
}
