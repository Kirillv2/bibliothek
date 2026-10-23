// Hilfen zur Prüfung von Eingaben auf dem Server (security-architektur.md, Abschnitt 6).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** IDs aus Anfragen werden vor der Abfrage geprüft; ein falsches Format gilt als „nicht gefunden“. */
export function istUuid(wert: unknown): wert is string {
  return typeof wert === "string" && UUID.test(wert);
}

/** Getrimmter Text oder `null`, wenn leer bzw. kein Text. */
export function textOderNull(wert: unknown): string | null {
  if (typeof wert !== "string") return null;
  const getrimmt = wert.trim();
  return getrimmt === "" ? null : getrimmt;
}

/** Eingaben aus Formularen und Aufrufen: bekannte Felder plus beliebige weitere, die ignoriert werden. */
export type MitWeiterenFeldern = { [weiteres: string]: unknown };
