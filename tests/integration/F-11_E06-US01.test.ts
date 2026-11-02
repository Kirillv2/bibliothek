// F-11 · E06-US01 · Registrierung und Anmeldung (Spec docs/specs/F-11_E06-US01.md)
// Vertrag: `registrieren(k, { email, passwort })` → `{ userId }` aus `@/server/auth/registrierung`;
// Anmeldung und Sitzungen aus Woche 1 (`@/server/auth/anmeldung`, ADR 003).
import { describe, expect, it } from "vitest";
import { registrieren } from "@/server/auth/registrierung";
import { beendeSitzung, erzeugeSitzung, findeSitzung, pruefeZugangsdaten } from "@/server/auth/anmeldung";
import { ausleihen } from "@/server/ausleihe";
import { verlaengern } from "@/server/verlaengerung";
import { vormerken } from "@/server/vormerkung";
import { momentaufnahme, nutzeTestDatenbank, zaehle } from "../helpers/testdb";
import { erwarteFehler, erwarteOk } from "../helpers/ergebnis";
import { legeAusleiheAn, legeExemplarAn, legeNutzerAn, legeTitelAn, setzeEinstellung } from "../helpers/daten";
import { andererGueltigerWert, standardWert } from "../helpers/konfiguration";
import { festeUhr } from "../helpers/uhr";

const t = nutzeTestDatenbank();

const PASSWORT = "sicheres-Passwort-1";

async function registriere(email: string, passwort = PASSWORT) {
  return registrieren(t.kontext(null), { email, passwort });
}

async function nutzerZeile(userId: string) {
  const { rows } = await t.pg.query<{ email: string; role: string; password_hash: string }>(
    "SELECT email, role, password_hash FROM users WHERE id = $1",
    [userId],
  );
  return rows[0];
}

describe("E06-US01-FR01 Registrierung und Anmeldung mit E-Mail und Passwort, nur Hash", () => {
  it("AK-01.1 (OF-F11-1) neues Konto mit klein geschriebener E-Mail ohne Leerzeichen am Rand und Rolle Mitglied", async () => {
    const { userId } = erwarteOk(await registriere("  Neu.Mitglied@Example.ORG "));
    const zeile = await nutzerZeile(userId);
    expect(zeile).toMatchObject({ email: "neu.mitglied@example.org", role: "MITGLIED" });
  });

  it("AK-01.2 (NFR03) Passwort nur als scrypt-Hash; gleiches Passwort ergibt verschiedene Hashes", async () => {
    const a = erwarteOk(await registriere("a@example.org"));
    const b = erwarteOk(await registriere("b@example.org"));
    const hashA = (await nutzerZeile(a.userId)).password_hash;
    const hashB = (await nutzerZeile(b.userId)).password_hash;
    expect(hashA).not.toContain(PASSWORT);
    expect(hashA.startsWith("scrypt$")).toBe(true);
    expect(hashA).not.toBe(hashB);
    // Klartext steht nirgends in der Datenbank
    expect(await momentaufnahme(t.pg)).not.toContain(PASSWORT);
  });

  it("AK-01.3 Anmeldung mit dem neuen Konto; Groß-/Kleinschreibung der E-Mail egal", async () => {
    const { userId } = erwarteOk(await registriere("leser@example.org"));
    expect(await pruefeZugangsdaten(t.db, "leser@example.org", PASSWORT)).toEqual({ userId, role: "MITGLIED" });
    expect(await pruefeZugangsdaten(t.db, " LESER@Example.org ", PASSWORT)).toEqual({ userId, role: "MITGLIED" });
  });

  it("AK-01.4 (OF-F11-3) schon registrierte E-Mail, auch in anderer Schreibweise → EMAIL_VERGEBEN, kein zweites Konto", async () => {
    erwarteOk(await registriere("doppelt@example.org"));
    const vorher = await momentaufnahme(t.pg);
    erwarteFehler(await registriere("Doppelt@Example.org", "anderes-Passwort"), "EMAIL_VERGEBEN");
    erwarteFehler(await registriere("doppelt@example.org"), "EMAIL_VERGEBEN");
    expect(await momentaufnahme(t.pg)).toBe(vorher);
    expect(await zaehle(t.pg, "SELECT count(*) AS n FROM users WHERE email = $1", ["doppelt@example.org"])).toBe(1);
  });

  it("AK-01.4 auch ein Seed- oder Bibliothekarskonto mit der E-Mail blockiert die Registrierung", async () => {
    const bib = await legeNutzerAn(t.pg, "BIBLIOTHEKAR", "team@example.org");
    erwarteFehler(await registriere("TEAM@example.org"), "EMAIL_VERGEBEN");
    expect((await nutzerZeile(bib.id)).role).toBe("BIBLIOTHEKAR");
  });

  const ungueltig: [string, { email: unknown; passwort: unknown }, string][] = [
    ["leere E-Mail", { email: "", passwort: PASSWORT }, "email"],
    ["E-Mail nur Leerzeichen", { email: "   ", passwort: PASSWORT }, "email"],
    ["E-Mail ohne @", { email: "kein-at.example.org", passwort: PASSWORT }, "email"],
    ["E-Mail mit zwei @", { email: "a@b@example.org", passwort: PASSWORT }, "email"],
    ["E-Mail ohne Punkt in der Domain", { email: "a@localhost", passwort: PASSWORT }, "email"],
    ["E-Mail mit Leerzeichen in der Mitte", { email: "a b@example.org", passwort: PASSWORT }, "email"],
    ["E-Mail über 254 Zeichen", { email: `${"a".repeat(243)}@example.org`, passwort: PASSWORT }, "email"],
    ["E-Mail kein Text", { email: 42, passwort: PASSWORT }, "email"],
    ["Passwort 7 Zeichen", { email: "p@example.org", passwort: "1234567" }, "passwort"],
    ["Passwort leer", { email: "p@example.org", passwort: "" }, "passwort"],
    ["Passwort 201 Zeichen", { email: "p@example.org", passwort: "x".repeat(201) }, "passwort"],
    ["Passwort kein Text", { email: "p@example.org", passwort: null }, "passwort"],
  ];

  it.each(ungueltig)("AK-01.5 (OF-F11-2) %s → VALIDIERUNG mit Feld, kein Konto", async (_name, eingabe, feld) => {
    const vorher = await momentaufnahme(t.pg);
    const felder = erwarteFehler(
      await registrieren(t.kontext(null), eingabe as { email: string; passwort: string }),
      "VALIDIERUNG",
    );
    expect(Object.keys(felder)).toContain(feld);
    expect(await momentaufnahme(t.pg)).toBe(vorher);
  });

  it("AK-01.5 Grenzen gültig: E-Mail mit genau 254 Zeichen, Passwort mit genau 8 und 200 Zeichen", async () => {
    const lang = `${"a".repeat(242)}@example.org`;
    expect(lang).toHaveLength(254);
    erwarteOk(await registriere(lang, "12345678"));
    erwarteOk(await registriere("max@example.org", "y".repeat(200)));
  });

  it("AK-01.6 ein mitgeschicktes Feld role wird ignoriert: Rolle Mitglied", async () => {
    const eingabe = { email: "admin-versuch@example.org", passwort: PASSWORT, role: "ADMINISTRATOR" };
    const { userId } = erwarteOk(await registrieren(t.kontext(null), eingabe));
    expect((await nutzerZeile(userId)).role).toBe("MITGLIED");
  });

  it("AK-01.8 falsches Passwort und unbekannte E-Mail ergeben dieselbe Antwort", async () => {
    erwarteOk(await registriere("bekannt@example.org"));
    const falsch = await pruefeZugangsdaten(t.db, "bekannt@example.org", "falsches-Passwort");
    const unbekannt = await pruefeZugangsdaten(t.db, "niemand@example.org", PASSWORT);
    expect(falsch).toBeNull();
    expect(unbekannt).toBeNull();
  });

  it("AK-01.9 Abmelden beendet die Sitzung: das alte Token gilt nicht mehr", async () => {
    const { userId } = erwarteOk(await registriere("abmelden@example.org"));
    const jetzt = festeUhr("2026-11-10").jetzt();
    const { token } = await erzeugeSitzung(t.db, userId, jetzt);
    expect(await findeSitzung(t.db, token, jetzt)).toEqual({ userId, role: "MITGLIED" });
    await beendeSitzung(t.db, token);
    expect(await findeSitzung(t.db, token, jetzt)).toBeNull();
  });
});

describe("E06-US01-FR02 Geschützte Aktionen nur mit aktiver Anmeldung", () => {
  async function verliehenerTitel() {
    const titleId = await legeTitelAn(t.pg);
    const exemplar = await legeExemplarAn(t.pg, titleId);
    const leiher = await legeNutzerAn(t.pg, "MITGLIED");
    const loanId = await legeAusleiheAn(t.pg, { copyId: exemplar.id, memberId: leiher.id, startDate: "2026-11-01", dueDate: "2026-11-29" });
    return { titleId, loanId };
  }

  it("AK-02.1 (Querverweis F-05) Gast kann nicht ausleihen: NICHT_ANGEMELDET, kein Vorgang", async () => {
    const titleId = await legeTitelAn(t.pg);
    await legeExemplarAn(t.pg, titleId);
    const vorher = await momentaufnahme(t.pg);
    erwarteFehler(await ausleihen(t.kontext(null), { titleId }), "NICHT_ANGEMELDET");
    expect(await momentaufnahme(t.pg)).toBe(vorher);
  });

  it("AK-02.2 (Querverweis F-10) Gast kann nicht vormerken: NICHT_ANGEMELDET, keine Vormerkung", async () => {
    const { titleId } = await verliehenerTitel();
    const vorher = await momentaufnahme(t.pg);
    erwarteFehler(await vormerken(t.kontext(null), { titleId }), "NICHT_ANGEMELDET");
    expect(await momentaufnahme(t.pg)).toBe(vorher);
  });

  it("AK-02.3 (Querverweis F-06) Gast kann nicht verlängern: NICHT_ANGEMELDET", async () => {
    const { loanId } = await verliehenerTitel();
    const vorher = await momentaufnahme(t.pg);
    erwarteFehler(await verlaengern(t.kontext(null), { loanId }), "NICHT_ANGEMELDET");
    expect(await momentaufnahme(t.pg)).toBe(vorher);
  });

  it("AK-02.4 abgelaufene Sitzung gilt nicht als Anmeldung (Laufzeit sitzungDauerStunden)", async () => {
    const stunden = standardWert("sitzungDauerStunden");
    const { userId } = erwarteOk(await registriere("ablauf@example.org"));
    const start = festeUhr("2026-11-10", "08:00").jetzt();
    const { token } = await erzeugeSitzung(t.db, userId, start);
    const kurzVorher = new Date(start.getTime() + stunden * 3_600_000 - 1000);
    const danach = new Date(start.getTime() + stunden * 3_600_000 + 1000);
    expect(await findeSitzung(t.db, token, kurzVorher)).toEqual({ userId, role: "MITGLIED" });
    expect(await findeSitzung(t.db, token, danach)).toBeNull();
  });

  it("AK-02.4 ein anderer gültiger Wert für sitzungDauerStunden wirkt", async () => {
    const stunden = andererGueltigerWert("sitzungDauerStunden", standardWert("sitzungDauerStunden"));
    await setzeEinstellung(t.pg, "sitzungDauerStunden", stunden);
    const { userId } = erwarteOk(await registriere("anders@example.org"));
    const start = festeUhr("2026-11-10", "08:00").jetzt();
    const { token, ablauf } = await erzeugeSitzung(t.db, userId, start);
    expect(ablauf.getTime() - start.getTime()).toBe(stunden * 3_600_000);
    expect(await findeSitzung(t.db, token, new Date(ablauf.getTime() + 1000))).toBeNull();
  });

  it("AK-02.6 ein frisch registriertes Mitglied kann sofort ausleihen und vormerken", async () => {
    const { userId } = erwarteOk(await registriere("frisch@example.org"));
    const sitzung = { userId, role: "MITGLIED" as const };

    const frei = await legeTitelAn(t.pg);
    await legeExemplarAn(t.pg, frei);
    erwarteOk(await ausleihen(t.kontext(sitzung), { titleId: frei }));

    const { titleId: verliehen } = await verliehenerTitel();
    expect(erwarteOk(await vormerken(t.kontext(sitzung), { titleId: verliehen })).position).toBe(1);
  });
});
