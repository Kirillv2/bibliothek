// Ziel nach Anmeldung oder Registrierung (Befund R-01): nur Pfade innerhalb der App, kein offener Redirect.
const INTERN = "http://intern.invalid";

/**
 * Nur Pfade innerhalb der App als Ziel nach der Anmeldung (kein offener Redirect).
 * Aufgelöst wie im Browser: `/\host`, Tabulatoren oder `/.//host` dürfen nicht auf eine fremde Herkunft führen.
 */
export function sicheresZiel(wert: FormDataEntryValue | null | undefined): string {
  if (typeof wert !== "string" || !wert.startsWith("/")) return "/";
  let url: URL;
  try {
    url = new URL(wert, INTERN);
  } catch {
    return "/";
  }
  const pfad = url.pathname + url.search + url.hash;
  return url.origin === INTERN && !pfad.startsWith("//") ? pfad : "/";
}
