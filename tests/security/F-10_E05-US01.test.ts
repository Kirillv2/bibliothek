// F-10 · E05-US01 · Rechte-Tests Vormerken
// Rechte-Matrix: vormerken und eigene Vormerkungen sehen nur Mitglied (OF-R1); Gast → NICHT_ANGEMELDET (OF-R2).
// Abholfristen-Job nur System mit Job-Secret. Wer vorgemerkt hat, sehen Gast und andere Mitglieder nicht.
import { describe, expect, it } from "vitest";
import { ladeMeineVormerkungen, vormerken } from "@/server/vormerkung";
import { ladeTitelDetail } from "@/server/katalog/detail";
import { bearbeiteJobAnfrage } from "@/server/jobs/endpunkt";
import { momentaufnahme, nutzeTestDatenbank, type Rolle } from "../helpers/testdb";
import { erwarteFehler, erwarteOk, type Fehlercode } from "../helpers/ergebnis";
import { erwarteKeinePersonendaten } from "../helpers/personendaten";
import { legeAusleiheAn, legeExemplarAn, legeNutzerAn, legeTitelAn, sitzungFuer } from "../helpers/daten";

const t = nutzeTestDatenbank();

async function verliehenerTitel() {
  const titleId = await legeTitelAn(t.pg);
  const exemplar = await legeExemplarAn(t.pg, titleId);
  const leiher = await legeNutzerAn(t.pg, "MITGLIED");
  await legeAusleiheAn(t.pg, { copyId: exemplar.id, memberId: leiher.id, startDate: "2026-10-20", dueDate: "2026-11-17" });
  return { titleId, leiher };
}

describe("E05-US01-FR01 Rechte: vormerken nur Mitglied", () => {
  const verboten: [string, Rolle | null, Fehlercode][] = [
    ["Gast", null, "NICHT_ANGEMELDET"],
    ["Bibliothekar", "BIBLIOTHEKAR", "KEINE_BERECHTIGUNG"],
    ["Administrator", "ADMINISTRATOR", "KEINE_BERECHTIGUNG"],
  ];

  it.each(verboten)("%s → %s, keine Vormerkung", async (_name, rolle, code) => {
    const { titleId } = await verliehenerTitel();
    const sitzung = rolle ? sitzungFuer(await legeNutzerAn(t.pg, rolle)) : null;
    const vorher = await momentaufnahme(t.pg);
    erwarteFehler(await vormerken(t.kontext(sitzung), { titleId }), code);
    expect(await momentaufnahme(t.pg)).toBe(vorher);
  });

  it.each(verboten)("%s: eigene Vormerkungen → %s", async (_name, rolle, code) => {
    const sitzung = rolle ? sitzungFuer(await legeNutzerAn(t.pg, rolle)) : null;
    erwarteFehler(await ladeMeineVormerkungen(t.kontext(sitzung)), code);
  });

  it("die Mitglieds-ID kommt aus der Sitzung, nicht aus der Eingabe", async () => {
    const { titleId } = await verliehenerTitel();
    const a = await legeNutzerAn(t.pg, "MITGLIED");
    const b = await legeNutzerAn(t.pg, "MITGLIED");
    erwarteOk(await vormerken(t.kontext(sitzungFuer(a)), { titleId, memberId: b.id, userId: b.id }));
    const { rows } = await t.pg.query<{ member_id: string }>("SELECT member_id FROM reservations");
    expect(rows.map((z) => z.member_id)).toEqual([a.id]);
  });
});

describe("E05-US01-FR02 Rechte: Vormerkungen anderer bleiben verborgen", () => {
  it("Mitglied A sieht die Vormerkung von B nicht", async () => {
    const { titleId } = await verliehenerTitel();
    const a = await legeNutzerAn(t.pg, "MITGLIED");
    const b = await legeNutzerAn(t.pg, "MITGLIED");
    erwarteOk(await vormerken(t.kontext(sitzungFuer(b)), { titleId }));
    expect(erwarteOk(await ladeMeineVormerkungen(t.kontext(sitzungFuer(a))))).toEqual([]);
  });

  it("Detailseite mit Vormerkungen enthält für Gast und andere Mitglieder keine Personendaten", async () => {
    const { titleId, leiher } = await verliehenerTitel();
    const b = await legeNutzerAn(t.pg, "MITGLIED");
    erwarteOk(await vormerken(t.kontext(sitzungFuer(b)), { titleId }));
    const anderer = await legeNutzerAn(t.pg, "MITGLIED");
    for (const sitzung of [null, sitzungFuer(anderer)]) {
      const detail = erwarteOk(await ladeTitelDetail(t.kontext(sitzung), titleId));
      erwarteKeinePersonendaten(detail, [leiher, b]);
      expect(detail.meineVormerkung).toBeUndefined();
    }
  });
});

describe("E05-US01-FR03 Rechte: Abholfristen-Job nur mit Job-Secret", () => {
  it("ohne Secret → 401, Job läuft nicht", async () => {
    let gelaufen = false;
    const antwort = await bearbeiteJobAnfrage(new Request("http://localhost/api/system/jobs/abholfristen", { method: "POST" }), {
      secret: "geheim-fuer-tests-0123456789",
      ausfuehren: async () => {
        gelaufen = true;
        return { ok: true, daten: {} };
      },
    });
    expect(antwort.status).toBe(401);
    expect(gelaufen).toBe(false);
  });
});
