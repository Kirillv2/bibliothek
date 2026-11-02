// F-13 · E07-US01-FR03 · CSV für den Bestandsexport (OF-F13-5): Semikolon, UTF-8 mit BOM, CRLF.
// Werte, die eine Tabellenkalkulation als Formel lesen würde, werden entschärft (Security-Architektur 6, AK-03.5).

const FORMELANFANG = /^[=+\-@\t\r]/;
const BRAUCHT_ANFUEHRUNG = /[;"\r\n]/;

/** Ein Feld: entschärft (vorangestelltes `'`) und, wenn nötig, in Anführungszeichen mit verdoppelten inneren. */
export function csvFeld(wert: string | number | null): string {
  let text = wert === null ? "" : String(wert);
  if (FORMELANFANG.test(text)) text = `'${text}`;
  return BRAUCHT_ANFUEHRUNG.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Ganze Datei: BOM, Felder mit Semikolon getrennt, jede Zeile mit CRLF abgeschlossen. */
export function erstelleCsv(zeilen: (string | number | null)[][]): string {
  return "﻿" + zeilen.map((z) => z.map(csvFeld).join(";") + "\r\n").join("");
}
