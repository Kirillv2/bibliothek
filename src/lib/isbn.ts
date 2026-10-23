// F-03 · E02-US01-FR01 · Formprüfung der ISBN (AK-01.6, OF-F03-2). Keine Prüfziffer, keine Eindeutigkeit.

/** Nach Entfernen von Bindestrichen und Leerzeichen: 10 Zeichen (Ziffern, letztes auch `X`) oder 13 Ziffern. */
export function istGueltigeIsbnForm(isbn: string): boolean {
  return /^(\d{9}[\dX]|\d{13})$/.test(isbn.replace(/[-\s]/g, ""));
}
