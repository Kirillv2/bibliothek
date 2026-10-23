// F-04 · E02-US02-FR01 · Format der Inventarnummer: "INV-" + sechs Ziffern (OF-D6)

/** Laufende Nummer 1 … 999999 als Inventarnummer; alles andere lässt sich nicht sechsstellig darstellen. */
export function formatiereInventarnummer(laufendeNummer: number): string {
  if (!Number.isInteger(laufendeNummer) || laufendeNummer < 1 || laufendeNummer > 999_999) {
    throw new RangeError(`Keine sechsstellige Inventarnummer möglich für ${laufendeNummer}`);
  }
  return `INV-${String(laufendeNummer).padStart(6, "0")}`;
}
