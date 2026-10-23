// Rollenprüfung auf dem Server (ADR 003, Rechte-Matrix). Rolle und Nutzer-ID kommen nur aus der Sitzung.
import { fehler, type Fehler } from "../ergebnis";
import type { Rolle, Sitzung } from "../kontext";

/** `NICHT_ANGEMELDET` ohne Sitzung, `KEINE_BERECHTIGUNG` bei anderer Rolle, sonst `null`. */
export function pruefeRolle(sitzung: Sitzung | null, ...erlaubt: Rolle[]): Fehler | null {
  if (!sitzung) return fehler("NICHT_ANGEMELDET");
  if (!erlaubt.includes(sitzung.role)) return fehler("KEINE_BERECHTIGUNG");
  return null;
}
