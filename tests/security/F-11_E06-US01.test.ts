// F-11 · E06-US01 · Rechte-Tests Registrierung und Anmeldung
// Rechte-Matrix: Registrieren nur Gast; Rolle nie aus der Eingabe; Passwort nur als Hash (NFR03, ADR 003).
import { describe, expect, it } from "vitest";
import { registrieren } from "@/server/auth/registrierung";
import { pruefeZugangsdaten } from "@/server/auth/anmeldung";
import { momentaufnahme, nutzeTestDatenbank, type Rolle } from "../helpers/testdb";
import { erwarteFehler, erwarteOk } from "../helpers/ergebnis";
import { legeNutzerAn, sitzungFuer } from "../helpers/daten";

const t = nutzeTestDatenbank();
const PASSWORT = "sicheres-Passwort-1";

describe("E06-US01-FR01 Rechte: Registrieren nur als Gast", () => {
  it.each<[string, Rolle]>([
    ["Mitglied", "MITGLIED"],
    ["Bibliothekar", "BIBLIOTHEKAR"],
    ["Administrator", "ADMINISTRATOR"],
  ])("angemeldet als %s → KEINE_BERECHTIGUNG, kein Konto", async (_name, rolle) => {
    const sitzung = sitzungFuer(await legeNutzerAn(t.pg, rolle));
    const vorher = await momentaufnahme(t.pg);
    erwarteFehler(await registrieren(t.kontext(sitzung), { email: "zweitkonto@example.org", passwort: PASSWORT }), "KEINE_BERECHTIGUNG");
    expect(await momentaufnahme(t.pg)).toBe(vorher);
  });

  it.each(["ADMINISTRATOR", "BIBLIOTHEKAR", "administrator"])("mitgeschickte Rolle %j wird ignoriert (Mitglied)", async (role) => {
    const { userId } = erwarteOk(
      await registrieren(t.kontext(null), { email: `rolle-${role}@example.org`, passwort: PASSWORT, role }),
    );
    expect(await pruefeZugangsdaten(t.db, `rolle-${role}@example.org`, PASSWORT)).toEqual({ userId, role: "MITGLIED" });
  });

  it("mitgeschickte id oder password_hash werden ignoriert", async () => {
    const fremdeId = "00000000-0000-4000-8000-000000000099";
    const { userId } = erwarteOk(
      await registrieren(t.kontext(null), {
        email: "felder@example.org",
        passwort: PASSWORT,
        id: fremdeId,
        userId: fremdeId,
        password_hash: "klartext",
      }),
    );
    expect(userId).not.toBe(fremdeId);
    const { rows } = await t.pg.query<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = $1", [userId]);
    expect(rows[0].password_hash).not.toBe("klartext");
    expect(rows[0].password_hash.startsWith("scrypt$")).toBe(true);
  });

  it("die Antwort der Registrierung enthält weder Passwort noch Hash", async () => {
    const antwort = await registrieren(t.kontext(null), { email: "antwort@example.org", passwort: PASSWORT });
    const text = JSON.stringify(antwort);
    expect(text).not.toContain(PASSWORT);
    expect(text).not.toContain("scrypt$");
  });

  it("die Fehlerantwort bei ungültigem Passwort gibt das Passwort nicht zurück", async () => {
    const antwort = await registrieren(t.kontext(null), { email: "kurz@example.org", passwort: "geheim1" });
    expect(JSON.stringify(antwort)).not.toContain("geheim1");
  });
});
