// F-08 · E04-US01 · Rechte-Tests Fristprüfung und Benachrichtigungen
// Rechte-Matrix: Fristprüfung nur System mit Job-Secret (ADR 007); Nutzer-Sitzung (auch Administrator) reicht nicht.
// Benachrichtigungen: jeder angemeldete Nutzer, nur eigene. Gast → NICHT_ANGEMELDET.
import { describe, expect, it, vi } from "vitest";
import { bearbeiteJobAnfrage } from "@/server/jobs/endpunkt";
import { benachrichtigungenGelesen, ladeMeineBenachrichtigungen } from "@/server/benachrichtigungen";
import { fristpruefung } from "@/server/jobs/fristpruefung";
import { nutzeTestDatenbank } from "../helpers/testdb";
import { erwarteFehler, erwarteOk } from "../helpers/ergebnis";
import { festeUhr } from "../helpers/uhr";
import { leseBenachrichtigungen, legeAusleiheAn, legeExemplarAn, legeNutzerAn, legeTitelAn, sitzungFuer } from "../helpers/daten";

const t = nutzeTestDatenbank();
const SECRET = "test-secret-nur-fuer-tests-0123456789";

function anfrage(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/system/jobs/fristpruefung", { method: "POST", headers });
}

describe("E04-US01-FR01 Rechte: Job-Endpunkt nur mit Job-Secret (ADR 007, NFR03)", () => {
  const abgelehnt: [string, Record<string, string>, string | undefined][] = [
    ["ohne Secret", {}, SECRET],
    ["falsches Secret", { authorization: `Bearer ${SECRET}x` }, SECRET],
    ["Secret ohne Bearer", { authorization: SECRET }, SECRET],
    ["nur Sitzungs-Cookie (auch Administrator)", { cookie: "bibliothek_sitzung=gueltig-fuer-admin" }, SECRET],
    ["kein JOB_SECRET gesetzt, leerer Bearer", { authorization: "Bearer " }, undefined],
    ["kein JOB_SECRET gesetzt, Bearer undefined", { authorization: "Bearer undefined" }, undefined],
    ["leeres JOB_SECRET", { authorization: "Bearer " }, ""],
  ];

  it.each(abgelehnt)("AK-01.7 %s → 401, Job läuft nicht", async (_name, headers, secret) => {
    const ausfuehren = vi.fn(async () => ({ ok: true }));
    const antwort = await bearbeiteJobAnfrage(anfrage(headers), { secret, ausfuehren });
    expect(antwort.status).toBe(401);
    expect(ausfuehren).not.toHaveBeenCalled();
    // verrät nichts über den Job
    expect(await antwort.text()).not.toMatch(/frist|mahnung|erinnerung/i);
  });

  it("AK-01.7 mit gültigem Secret → 200 und Ergebnis des Jobs", async () => {
    const ausfuehren = vi.fn(async () => ({ ok: true as const, daten: { stichtag: "2026-11-10", erinnerungen: 0 } }));
    const antwort = await bearbeiteJobAnfrage(anfrage({ authorization: `Bearer ${SECRET}` }), { secret: SECRET, ausfuehren });
    expect(antwort.status).toBe(200);
    expect(ausfuehren).toHaveBeenCalledTimes(1);
    expect(await antwort.json()).toMatchObject({ stichtag: "2026-11-10", erinnerungen: 0 });
  });

  it("AK-01.3 der Endpunkt übernimmt keinen Stichtag aus der Anfrage (OF-F08-4)", async () => {
    const titleId = await legeTitelAn(t.pg);
    const exemplar = await legeExemplarAn(t.pg, titleId);
    const mitglied = await legeNutzerAn(t.pg, "MITGLIED");
    await legeAusleiheAn(t.pg, { copyId: exemplar.id, memberId: mitglied.id, startDate: "2026-10-01", dueDate: "2026-11-20" });
    const k = t.kontext(null, festeUhr("2026-11-10", "02:00"));
    const antwort = await bearbeiteJobAnfrage(
      new Request("http://localhost/api/system/jobs/fristpruefung?stichtag=2026-12-31", {
        method: "POST",
        headers: { authorization: `Bearer ${SECRET}`, "content-type": "application/json" },
        body: JSON.stringify({ stichtag: "2026-12-31" }),
      }),
      { secret: SECRET, ausfuehren: () => fristpruefung(k) },
    );
    expect(antwort.status).toBe(200);
    expect(await antwort.json()).toMatchObject({ stichtag: "2026-11-10", ueberfaellig: 0, mahnungen: 0 });
  });
});

describe("E04-US01-FR02 Rechte: nur eigene Benachrichtigungen", () => {
  it("AK-02.7 Gast → NICHT_ANGEMELDET", async () => {
    erwarteFehler(await ladeMeineBenachrichtigungen(t.kontext(null)), "NICHT_ANGEMELDET");
    erwarteFehler(await benachrichtigungenGelesen(t.kontext(null)), "NICHT_ANGEMELDET");
  });

  it("AK-02.7 Mitglied A sieht und liest keine Benachrichtigungen von B", async () => {
    const a = await legeNutzerAn(t.pg, "MITGLIED");
    const b = await legeNutzerAn(t.pg, "MITGLIED");
    const titleId = await legeTitelAn(t.pg);
    const exemplar = await legeExemplarAn(t.pg, titleId);
    await legeAusleiheAn(t.pg, { copyId: exemplar.id, memberId: b.id, startDate: "2026-10-13", dueDate: "2026-11-10" });
    erwarteOk(await fristpruefung(t.kontext(null, festeUhr("2026-11-10", "02:00"))));

    expect(erwarteOk(await ladeMeineBenachrichtigungen(t.kontext(sitzungFuer(a))))).toEqual([]);
    expect(erwarteOk(await benachrichtigungenGelesen(t.kontext(sitzungFuer(a))))).toMatchObject({ anzahl: 0 });
    expect((await leseBenachrichtigungen(t.pg, b.id))[0].read_at).toBeNull();
  });

  it.each(["BIBLIOTHEKAR", "ADMINISTRATOR"] as const)("AK-02.7 %s darf die eigene (leere) Liste sehen", async (rolle) => {
    const nutzer = await legeNutzerAn(t.pg, rolle);
    expect(erwarteOk(await ladeMeineBenachrichtigungen(t.kontext(sitzungFuer(nutzer))))).toEqual([]);
  });
});
