// Ergebnis jeder Funktion der Anwendungsschicht (docs/architektur/schnittstellen.md, ADR 004).

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

export type Fehler = { ok: false; fehler: Fehlercode; felder?: Record<string, string> };

export type Ergebnis<T> = { ok: true; daten: T } | Fehler;

export function erfolg<T>(daten: T): { ok: true; daten: T } {
  return { ok: true, daten };
}

export function fehler(code: Fehlercode, felder?: Record<string, string>): Fehler {
  return felder ? { ok: false, fehler: code, felder } : { ok: false, fehler: code };
}

/** Wird innerhalb einer Transaktion geworfen, damit sie zurückgerollt wird und der Fehler als Ergebnis ankommt. */
export class Abbruch extends Error {
  constructor(readonly ergebnis: Fehler) {
    super(ergebnis.fehler);
  }
}
