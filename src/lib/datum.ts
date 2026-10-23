// Kalenderdaten ohne Uhrzeit (ADR 008). Reine Funktionen ohne I/O (ADR 004).

/** Kalenderdatum im Format JJJJ-MM-TT. */
export type Datum = string;

const DATUM_MUSTER = /^(\d{4})-(\d{2})-(\d{2})$/;

function zerlege(datum: Datum): [number, number, number] {
  const teile = DATUM_MUSTER.exec(datum);
  if (!teile) throw new Error(`Ungültiges Datum: ${datum}`);
  return [Number(teile[1]), Number(teile[2]), Number(teile[3])];
}

function alsUtcMillis(datum: Datum): number {
  const [jahr, monat, tag] = zerlege(datum);
  return Date.UTC(jahr, monat - 1, tag);
}

/** Datum plus `tage` Kalendertage; Wochenenden und Feiertage zählen mit (ADR 008, OF-Z1). */
export function plusTage(datum: Datum, tage: number): Datum {
  return new Date(alsUtcMillis(datum) + tage * 86_400_000).toISOString().slice(0, 10);
}

/** Anzahl Kalendertage von `von` bis `bis` (bis − von). */
export function tageZwischen(von: Datum, bis: Datum): number {
  return Math.round((alsUtcMillis(bis) - alsUtcMillis(von)) / 86_400_000);
}

/** Anzeige als TT.MM.JJJJ (E01-US02-FR01, ADR 008 Regel 5). */
export function formatiereDatum(datum: Datum): string {
  const [jahr, monat, tag] = zerlege(datum);
  return `${String(tag).padStart(2, "0")}.${String(monat).padStart(2, "0")}.${jahr}`;
}

const BERLIN = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Berlin",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Kalenderdatum eines Zeitpunkts in Europe/Berlin (ADR 008 Regel 2). */
export function datumInBerlin(zeitpunkt: Date): Datum {
  return BERLIN.format(zeitpunkt);
}

/** Jahr eines Kalenderdatums. */
export function jahrVon(datum: Datum): number {
  return zerlege(datum)[0];
}
