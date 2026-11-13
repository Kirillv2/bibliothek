// F-11 · E06-US01 · Schutz gegen Passwort-Raten bei der Anmeldung (NFR03, Issue #47)
// Nach MAX_FEHLVERSUCHE Fehlversuchen innerhalb des Zeitfensters ist die Anmeldung für diese Adresse
// SPERRE_MINUTEN lang gesperrt, auch mit richtigem Passwort. Unbekannte Adressen verhalten sich gleich.
// Erwartungen werden aus den exportierten Werten berechnet, nicht als feste Zahl geschrieben.
import { describe, expect, it } from "vitest";
import { meldeAn } from "@/server/auth/anmeldung";
import { MAX_FEHLVERSUCHE, SPERRE_MINUTEN } from "@/server/auth/anmeldeschutz";
import { registrieren } from "@/server/auth/registrierung";
import { nutzeTestDatenbank } from "../helpers/testdb";
import { erwarteOk } from "../helpers/ergebnis";

const t = nutzeTestDatenbank();
const PASSWORT = "sicheres-Passwort-1";
const START = new Date("2026-11-10T10:00:00Z");

function nach(minuten: number): Date {
  return new Date(START.getTime() + minuten * 60_000);
}

async function konto(email: string): Promise<string> {
  return erwarteOk(await registrieren(t.kontext(null), { email, passwort: PASSWORT })).userId;
}

async function fehlversuche(email: string, anzahl: number, zeitpunkt = START) {
  const ergebnisse = [];
  for (let i = 0; i < anzahl; i++) ergebnisse.push(await meldeAn(t.db, email, "falsches-Passwort", zeitpunkt));
  return ergebnisse;
}

describe("E06-US01-FR01 Anmeldeschutz gegen Passwort-Raten (NFR03)", () => {
  it("richtiges Passwort meldet an", async () => {
    const userId = await konto("ok@example.org");
    expect(await meldeAn(t.db, "ok@example.org", PASSWORT, START)).toEqual({
      ok: true,
      sitzung: { userId, role: "MITGLIED" },
    });
  });

  it("Fehlversuche unter der Grenze melden nur „falsch“, danach klappt das richtige Passwort", async () => {
    await konto("knapp@example.org");
    const ergebnisse = await fehlversuche("knapp@example.org", MAX_FEHLVERSUCHE - 1);
    expect(ergebnisse.every((e) => !e.ok && e.grund === "FALSCH")).toBe(true);
    expect((await meldeAn(t.db, "knapp@example.org", PASSWORT, START)).ok).toBe(true);
  });

  it("beim Erreichen der Grenze wird gesperrt, auch das richtige Passwort wird dann abgewiesen", async () => {
    await konto("gesperrt@example.org");
    const ergebnisse = await fehlversuche("gesperrt@example.org", MAX_FEHLVERSUCHE);
    expect(ergebnisse.at(-1)).toMatchObject({ ok: false, grund: "GESPERRT", bis: nach(SPERRE_MINUTEN) });
    expect(await meldeAn(t.db, "gesperrt@example.org", PASSWORT, nach(1))).toMatchObject({ ok: false, grund: "GESPERRT" });
  });

  it("nach Ablauf der Sperre ist die Anmeldung wieder möglich", async () => {
    await konto("wieder@example.org");
    await fehlversuche("wieder@example.org", MAX_FEHLVERSUCHE);
    expect((await meldeAn(t.db, "wieder@example.org", PASSWORT, nach(SPERRE_MINUTEN + 1))).ok).toBe(true);
  });

  it("Groß- und Kleinschreibung sowie Leerzeichen umgehen die Sperre nicht", async () => {
    await konto("schreibweise@example.org");
    await fehlversuche("schreibweise@example.org", MAX_FEHLVERSUCHE);
    expect(await meldeAn(t.db, "  SchreibWeise@Example.org ", PASSWORT, nach(1))).toMatchObject({ grund: "GESPERRT" });
  });

  it("Fehlversuche außerhalb des Zeitfensters zählen nicht zusammen", async () => {
    await konto("verteilt@example.org");
    await fehlversuche("verteilt@example.org", MAX_FEHLVERSUCHE - 1, START);
    const spaeter = await fehlversuche("verteilt@example.org", 1, nach(SPERRE_MINUTEN + 1));
    expect(spaeter[0]).toMatchObject({ ok: false, grund: "FALSCH" });
  });

  it("erfolgreiche Anmeldung setzt die Zählung zurück", async () => {
    await konto("zurueck@example.org");
    await fehlversuche("zurueck@example.org", MAX_FEHLVERSUCHE - 1);
    expect((await meldeAn(t.db, "zurueck@example.org", PASSWORT, START)).ok).toBe(true);
    const danach = await fehlversuche("zurueck@example.org", MAX_FEHLVERSUCHE - 1);
    expect(danach.every((e) => !e.ok && e.grund === "FALSCH")).toBe(true);
  });

  it("die Sperre gilt nur für diese Adresse, andere Konten melden sich normal an", async () => {
    await konto("opfer@example.org");
    await konto("andere@example.org");
    await fehlversuche("opfer@example.org", MAX_FEHLVERSUCHE);
    expect((await meldeAn(t.db, "andere@example.org", PASSWORT, nach(1))).ok).toBe(true);
  });

  it("unbekannte Adresse verhält sich gleich (verrät nicht, ob es ein Konto gibt)", async () => {
    const ergebnisse = await fehlversuche("unbekannt@example.org", MAX_FEHLVERSUCHE);
    expect(ergebnisse.slice(0, -1).every((e) => !e.ok && e.grund === "FALSCH")).toBe(true);
    expect(ergebnisse.at(-1)).toMatchObject({ ok: false, grund: "GESPERRT" });
  });

  it("die Datenbank speichert die Adresse nicht im Klartext", async () => {
    await fehlversuche("klartext@example.org", 1);
    const { rows } = await t.pg.query<{ email_hash: string }>("SELECT email_hash FROM login_attempts");
    expect(rows).toHaveLength(1);
    expect(rows[0].email_hash).not.toContain("klartext");
    expect(rows[0].email_hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
