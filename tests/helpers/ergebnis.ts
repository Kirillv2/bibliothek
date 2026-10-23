// Ergebnis einer Server Action bzw. Lese-Funktion (docs/architektur/schnittstellen.md).
import { expect } from "vitest";

export type Fehlercode =
  | "NICHT_ANGEMELDET"
  | "KEINE_BERECHTIGUNG"
  | "NICHT_GEFUNDEN"
  | "VALIDIERUNG"
  | "KEIN_EXEMPLAR_VERFUEGBAR"
  | "AUSLEIHLIMIT_ERREICHT"
  | "OFFENE_MAHNUNG"
  | "TITEL_ARCHIVIERT"
  | "VORMERKUNG_VORHANDEN"
  | "MAX_VERLAENGERUNGEN_ERREICHT"
  | "AUSLEIHVORGANG_ABGESCHLOSSEN"
  | "TITEL_NICHT_ARCHIVIERBAR";

type Ergebnis<T> =
  | { ok: true; daten: T }
  | { ok: false; fehler: string; felder?: Record<string, string> };

/** Prüft auf Erfolg und gibt die Daten zurück. */
export function erwarteOk<T>(ergebnis: Ergebnis<T>): T {
  if (!ergebnis.ok) {
    throw new Error(`Erfolg erwartet, Fehler erhalten: ${ergebnis.fehler} ${JSON.stringify(ergebnis.felder ?? {})}`);
  }
  return ergebnis.daten;
}

/** Prüft auf genau diesen Fehlercode und gibt die Feldangaben zurück. */
export function erwarteFehler<T>(ergebnis: Ergebnis<T>, code: Fehlercode): Record<string, string> {
  expect(ergebnis.ok, `Fehler ${code} erwartet, aber Erfolg erhalten`).toBe(false);
  if (ergebnis.ok) return {};
  expect(ergebnis.fehler).toBe(code);
  return ergebnis.felder ?? {};
}
