// F-11 · E06-US01 · Rechte-Test der Server Action zur Registrierung
// AK-01.7 (OF-F11-4): nach erfolgreicher Registrierung angemeldet, Sitzung für das neue Konto.
// Ziel `weiter` ist Eingabe von außen: nie auf eine fremde Herkunft (wie bei der Anmeldung, Befund R-01).
// Bei Fehlern entsteht keine Sitzung. Datenbank, Sitzung und `redirect` sind ersetzt.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { registrierungAbsenden } from "@/app/aktionen/registrierung";

const zustand = vi.hoisted(() => ({
  ziel: "",
  gestartet: [] as string[],
  sitzung: null as null | { userId: string; role: string },
  eingaben: [] as unknown[],
}));

const NEUE_ID = "00000000-0000-4000-8000-000000000011";

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    zustand.ziel = url;
    throw new Error("NEXT_REDIRECT");
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/server/anfrage", () => ({
  erstelleKontext: async () => ({ db: {}, uhr: { heute: () => "2026-11-10", jetzt: () => new Date() }, sitzung: zustand.sitzung }),
}));
vi.mock("@/server/auth/registrierung", () => ({
  registrieren: async (k: { sitzung: unknown }, eingabe: { email: string; passwort: string }) => {
    zustand.eingaben.push(eingabe);
    if (k.sitzung) return { ok: false, fehler: "KEINE_BERECHTIGUNG" };
    if (eingabe.email === "vergeben@example.org") return { ok: false, fehler: "EMAIL_VERGEBEN" };
    if (eingabe.passwort.length < 8) return { ok: false, fehler: "VALIDIERUNG", felder: { passwort: "Länge ungültig" } };
    return { ok: true, daten: { userId: NEUE_ID } };
  },
}));
vi.mock("@/server/auth/sitzung", () => ({
  starteSitzung: async (userId: string) => {
    zustand.gestartet.push(userId);
  },
  beendeAktuelleSitzung: async () => {},
  getSession: async () => zustand.sitzung,
}));

const HERKUNFT = "https://bibliothek.example";

function formular(felder: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(felder)) f.set(k, v);
  return f;
}

async function zielNachRegistrierung(weiter: string): Promise<string> {
  await expect(
    registrierungAbsenden(null, formular({ email: "neu@example.org", passwort: "sicheres-Passwort-1", weiter })),
  ).rejects.toThrow("NEXT_REDIRECT");
  return zustand.ziel;
}

describe("E06-US01-FR01 Rechte: Registrierung über die Server Action", () => {
  beforeEach(() => {
    zustand.ziel = "";
    zustand.gestartet = [];
    zustand.sitzung = null;
    zustand.eingaben = [];
  });

  it("AK-01.7 (OF-F11-4) Erfolg: Sitzung für das neue Konto, danach zur Startseite", async () => {
    expect(await zielNachRegistrierung("")).toBe("/");
    expect(zustand.gestartet).toEqual([NEUE_ID]);
  });

  it("AK-02.5 Erfolg mit Ziel aus der Anmeldung: zurück auf die geschützte Seite", async () => {
    expect(await zielNachRegistrierung("/konto/vormerkungen")).toBe("/konto/vormerkungen");
  });

  it.each(["//evil", "https://evil.example/x", "/\\evil.example", "/\t/evil", "evil.example"])(
    "Ziel %j führt nie auf eine fremde Herkunft",
    async (weiter) => {
      const ziel = await zielNachRegistrierung(weiter);
      expect(new URL(ziel, HERKUNFT).origin).toBe(HERKUNFT);
      expect(ziel).toBe("/");
    },
  );

  it("Rolle aus dem Formular wird nicht weitergegeben", async () => {
    await expect(
      registrierungAbsenden(null, formular({ email: "neu@example.org", passwort: "sicheres-Passwort-1", role: "ADMINISTRATOR" })),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(zustand.eingaben).toEqual([{ email: "neu@example.org", passwort: "sicheres-Passwort-1" }]);
  });

  it.each([
    ["vergebene E-Mail", { email: "vergeben@example.org", passwort: "sicheres-Passwort-1" }],
    ["zu kurzes Passwort", { email: "neu@example.org", passwort: "kurz" }],
  ])("%s: keine Sitzung, Meldung mit Text, Passwort nicht zurückgegeben", async (_name, felder) => {
    const stand = await registrierungAbsenden(null, formular(felder));
    expect(zustand.gestartet).toEqual([]);
    expect(stand?.text).toBeTruthy();
    expect(JSON.stringify(stand)).not.toContain(felder.passwort);
  });

  it("angemeldeter Nutzer: keine neue Sitzung, Weiterleitung zur Startseite", async () => {
    zustand.sitzung = { userId: "00000000-0000-4000-8000-000000000022", role: "MITGLIED" };
    await expect(
      registrierungAbsenden(null, formular({ email: "neu@example.org", passwort: "sicheres-Passwort-1" })),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(zustand.ziel).toBe("/");
    expect(zustand.gestartet).toEqual([]);
  });
});
