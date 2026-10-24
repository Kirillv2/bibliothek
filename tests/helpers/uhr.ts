// Feste Uhr für Tests (ADR 004, ADR 008).
// „Heute“ ist ein Kalenderdatum in Europe/Berlin, „jetzt“ ein Zeitpunkt am selben Tag.

/** Kalenderdatum im Format JJJJ-MM-TT (ADR 008). */
export type Datum = string;

/** Uhr, wie sie die Anwendungsschicht erwartet (ADR 004: `Clock`). */
export type Uhr = {
  heute(): Datum;
  jetzt(): Date;
};

const BERLIN = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Berlin",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function berlinZeit(zeitpunkt: Date): string {
  return BERLIN.format(zeitpunkt);
}

/** Zeitpunkt für eine Uhrzeit an einem Tag in Europe/Berlin (Sommer- oder Winterzeit). */
export function zeitpunktInBerlin(datum: Datum, uhrzeit = "12:00"): Date {
  for (const versatz of ["+01:00", "+02:00"]) {
    const zeitpunkt = new Date(`${datum}T${uhrzeit}:00${versatz}`);
    if (berlinZeit(zeitpunkt) === `${datum} ${uhrzeit}`) return zeitpunkt;
  }
  throw new Error(`Ungültige Zeit in Europe/Berlin: ${datum} ${uhrzeit}`);
}

/** Uhr, die immer denselben Tag und Zeitpunkt liefert. */
export function festeUhr(datum: Datum, uhrzeit = "12:00"): Uhr {
  const zeitpunkt = zeitpunktInBerlin(datum, uhrzeit);
  return {
    heute: () => datum,
    jetzt: () => new Date(zeitpunkt),
  };
}

/** Kalendertage addieren, ohne Uhrzeit und ohne Zeitzone (eigene Rechnung der Tests). */
export function plusTage(datum: Datum, tage: number): Datum {
  const [j, m, t] = datum.split("-").map(Number);
  const utc = new Date(Date.UTC(j, m - 1, t + tage));
  return utc.toISOString().slice(0, 10);
}

/** Anzahl Kalendertage von `von` bis `bis` (bis − von). */
export function tageZwischen(von: Datum, bis: Datum): number {
  const ms = Date.parse(`${bis}T00:00:00Z`) - Date.parse(`${von}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}
