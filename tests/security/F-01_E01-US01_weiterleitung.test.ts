// F-01 · E01-US01 · Rechte-Test Weiterleitung nach der Anmeldung (Befund R-01, Review & Security)
// Gast wird zur Anmeldung geleitet (E06-US01-FR02, Rechte-Matrix „Gast“) und kommt danach auf die Ausgangsseite
// zurück. Das Ziel `weiter` kommt aus der URL und ist damit Eingabe von außen: Es darf nie auf eine fremde
// Herkunft führen (kein offener Redirect). Geprüft wird die Server Action `anmelden` selbst; Datenbank, Sitzung
// und `redirect` sind ersetzt, damit nur die Wahl des Ziels geprüft wird.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { anmelden } from "@/app/aktionen/anmeldung";

const umleitung = vi.hoisted(() => ({ ziel: "" }));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    umleitung.ziel = url;
    throw new Error("NEXT_REDIRECT");
  },
}));
vi.mock("@/server/db/verbindung", () => ({ holeDatenbank: async () => ({}) }));
vi.mock("@/server/auth/anmeldung", () => ({
  pruefeZugangsdaten: async (_db: unknown, _email: string, passwort: string) =>
    passwort === "richtig" ? { userId: "00000000-0000-4000-8000-000000000001", role: "MITGLIED" } : null,
}));
vi.mock("@/server/auth/sitzung", () => ({ starteSitzung: async () => {}, beendeAktuelleSitzung: async () => {} }));

const HERKUNFT = "https://bibliothek.example";

async function zielNachAnmeldung(weiter: string, passwort = "richtig"): Promise<string> {
  const formular = new FormData();
  formular.set("email", "mitglied@example.org");
  formular.set("passwort", passwort);
  formular.set("weiter", weiter);
  umleitung.ziel = "";
  await expect(anmelden(formular)).rejects.toThrow("NEXT_REDIRECT");
  return umleitung.ziel;
}

/** Wohin der Browser mit diesem Location-Wert tatsächlich geht. */
function herkunftImBrowser(location: string): string {
  return new URL(location, HERKUNFT).origin;
}

const FREMD = ["/\\evil.example/x", "/\t/evil", "/.//evil", "//evil", "http://evil", "https://evil.example/titel", "/\\\\evil", "\\\\evil", "evil.example"];

describe("E06-US01-FR02 Rechte: Anmeldung leitet nie auf fremde Herkunft weiter (R-01)", () => {
  beforeEach(() => {
    umleitung.ziel = "";
  });

  it.each(FREMD)("Ziel %j führt nach der Anmeldung auf /", async (weiter) => {
    expect(await zielNachAnmeldung(weiter)).toBe("/");
  });

  it("Ziel /%5Cevil.example bleibt ein Pfad der eigenen Herkunft (kodierter Backslash wird nicht als Host gelesen)", async () => {
    const ziel = await zielNachAnmeldung("/%5Cevil.example");
    expect(ziel.startsWith("/")).toBe(true);
    expect(ziel.startsWith("//")).toBe(false);
    expect(ziel.startsWith("/\\")).toBe(false);
    expect(herkunftImBrowser(ziel)).toBe(HERKUNFT);
  });

  it.each([...FREMD, "/%5Cevil.example"])("Ziel %j: der Browser bleibt auf der eigenen Herkunft", async (weiter) => {
    expect(herkunftImBrowser(await zielNachAnmeldung(weiter))).toBe(HERKUNFT);
  });

  it("ein Pfad der App bleibt mit Suchparametern erhalten", async () => {
    const pfad = "/titel/3f2b8c1e-0000-4000-8000-00000000abcd?x=1";
    expect(await zielNachAnmeldung(pfad)).toBe(pfad);
  });

  it.each(FREMD)("fehlgeschlagene Anmeldung mit Ziel %j: das Ziel im Rücksprung ist ebenfalls /", async (weiter) => {
    const ruecksprung = new URL(await zielNachAnmeldung(weiter, "falsch"), HERKUNFT);
    expect(ruecksprung.origin).toBe(HERKUNFT);
    expect(ruecksprung.pathname).toBe("/anmelden");
    expect(ruecksprung.searchParams.get("weiter")).toBe("/");
  });
});
