// Prüft, dass eine öffentliche Antwort keine Personendaten enthält
// (Rechte-Matrix „Daten, die eine Rolle sehen darf“; security-architektur.md 4.3).
import { expect } from "vitest";
import type { Nutzer } from "./daten";

const VERBOTENE_SCHLUESSEL = /^(member_?id|user_?id|email|e_?mail|password_?hash|token_?hash|settled_?by_?id)$/i;

function sammleSchluessel(wert: unknown, ziel: Set<string>): void {
  if (Array.isArray(wert)) {
    for (const element of wert) sammleSchluessel(element, ziel);
  } else if (wert && typeof wert === "object" && !(wert instanceof Date)) {
    for (const [schluessel, inhalt] of Object.entries(wert)) {
      ziel.add(schluessel);
      sammleSchluessel(inhalt, ziel);
    }
  }
}

export function erwarteKeinePersonendaten(antwort: unknown, nutzer: Nutzer[]): void {
  const text = JSON.stringify(antwort);
  for (const n of nutzer) {
    expect(text, `Antwort enthält E-Mail von ${n.role}`).not.toContain(n.email);
    expect(text, `Antwort enthält ID von ${n.role}`).not.toContain(n.id);
  }
  const schluessel = new Set<string>();
  sammleSchluessel(antwort, schluessel);
  const verboten = [...schluessel].filter((s) => VERBOTENE_SCHLUESSEL.test(s));
  expect(verboten, "Antwort enthält Felder mit Personendaten").toEqual([]);
}
