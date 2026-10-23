// Gemeinsame Antwort geschützter Seiten, wenn die Funktion der Anwendungsschicht den Zugriff ablehnt.
import { notFound, redirect } from "next/navigation";
import type { Fehlercode } from "@/server/ergebnis";
import { FEHLERTEXTE } from "./meldungen";

/** Abgelaufene Sitzung → Anmeldung (E06-US01-FR02), falsche Rolle → Hinweis, sonst „nicht gefunden“. */
export function Zugriffsfehler({ fehler, pfad }: { fehler: Fehlercode; pfad: string }) {
  if (fehler === "NICHT_ANGEMELDET") redirect(`/anmelden?weiter=${encodeURIComponent(pfad)}`);
  if (fehler !== "KEINE_BERECHTIGUNG") notFound();
  return (
    <p className="meldung fehler" role="alert">
      {FEHLERTEXTE.KEINE_BERECHTIGUNG}
    </p>
  );
}
