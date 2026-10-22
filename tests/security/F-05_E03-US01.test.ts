// F-05 · E03-US01 · Rechte-Tests Ausleihen
// Rechte-Matrix: Ausleihen nur Mitglied (OF-R1); Gast → NICHT_ANGEMELDET; Mitglieds-ID nur aus der Sitzung.
// Regeln (Limit, Mahnung) lassen sich nicht über die Eingabe umgehen (security-architektur.md 9).
import { describe, expect, it } from "vitest";
import { ausleihen } from "@/server/ausleihe";
import { momentaufnahme, nutzeTestDatenbank, zaehle, type Rolle } from "../helpers/testdb";
import { erwarteFehler, erwarteOk, type Fehlercode } from "../helpers/ergebnis";
import { standardWert } from "../helpers/konfiguration";
import { legeAusleiheAn, legeExemplarAn, legeMahnungAn, legeNutzerAn, legeTitelAn, sitzungFuer } from "../helpers/daten";

const t = nutzeTestDatenbank();

async function titelMitExemplar(): Promise<string> {
  const titleId = await legeTitelAn(t.pg);
  await legeExemplarAn(t.pg, titleId);
  return titleId;
}

describe("E03-US01-FR01 E06-US01-FR02 Rechte: Ausleihen nur für die Rolle Mitglied", () => {
  const verboten: [string, Rolle | null, Fehlercode][] = [
    ["Gast", null, "NICHT_ANGEMELDET"],
    ["Bibliothekar", "BIBLIOTHEKAR", "KEINE_BERECHTIGUNG"],
    ["Administrator", "ADMINISTRATOR", "KEINE_BERECHTIGUNG"],
  ];

  it.each(verboten)("%s: %s, keine Wirkung in der DB", async (_name, rolle, code) => {
    const titleId = await titelMitExemplar();
    const sitzung = rolle ? sitzungFuer(await legeNutzerAn(t.pg, rolle)) : null;
    const vorher = await momentaufnahme(t.pg);

    erwarteFehler(await ausleihen(t.kontext(sitzung), { titleId }), code);
    expect(await momentaufnahme(t.pg)).toBe(vorher);
  });

  it("Mitglied darf ausleihen", async () => {
    const titleId = await titelMitExemplar();

    erwarteOk(await ausleihen(t.kontext(sitzungFuer(await legeNutzerAn(t.pg, "MITGLIED"))), { titleId }));
  });

  it("Gast mit fremder Mitglieds-ID in der Eingabe: NICHT_ANGEMELDET, keine Ausleihe für dieses Mitglied", async () => {
    const titleId = await titelMitExemplar();
    const opfer = await legeNutzerAn(t.pg, "MITGLIED");
    const eingabe = { titleId, memberId: opfer.id, userId: opfer.id };

    erwarteFehler(await ausleihen(t.kontext(null), eingabe), "NICHT_ANGEMELDET");
    expect(await zaehle(t.pg, "SELECT count(*) AS n FROM loans")).toBe(0);
  });
});

describe("E03-US01-FR03 Rechte: Limit und Mahnung lassen sich nicht über die Eingabe umgehen", () => {
  it("Mitglied A leiht mit memberId von B in der Eingabe: Vorgang gehört A, nicht B", async () => {
    const titleId = await titelMitExemplar();
    const a = await legeNutzerAn(t.pg, "MITGLIED");
    const b = await legeNutzerAn(t.pg, "MITGLIED");

    const daten = erwarteOk(await ausleihen(t.kontext(sitzungFuer(a)), { titleId, memberId: b.id }));
    const { rows } = await t.pg.query<{ member_id: string }>("SELECT member_id FROM loans WHERE id = $1", [daten.loanId]);
    expect(rows[0].member_id).toBe(a.id);
  });

  it("Mitglied mit offener Mahnung kann sie nicht durch die ID eines anderen Mitglieds umgehen", async () => {
    const gesperrt = await legeNutzerAn(t.pg, "MITGLIED");
    const sauber = await legeNutzerAn(t.pg, "MITGLIED");
    const altTitel = await legeTitelAn(t.pg);
    const altExemplar = await legeExemplarAn(t.pg, altTitel);
    const loanId = await legeAusleiheAn(t.pg, { copyId: altExemplar.id, memberId: gesperrt.id, startDate: "2026-09-01", dueDate: "2026-09-29" });
    await legeMahnungAn(t.pg, { loanId, createdOn: "2026-09-30" });
    const titleId = await titelMitExemplar();
    const vorher = await momentaufnahme(t.pg);

    erwarteFehler(await ausleihen(t.kontext(sitzungFuer(gesperrt)), { titleId, memberId: sauber.id }), "OFFENE_MAHNUNG");
    expect(await momentaufnahme(t.pg)).toBe(vorher);
  });

  it("Mitglied am Limit kann das Limit nicht durch die ID eines anderen Mitglieds umgehen", async () => {
    const amLimit = await legeNutzerAn(t.pg, "MITGLIED");
    const leer = await legeNutzerAn(t.pg, "MITGLIED");
    for (let i = 0; i < standardWert("ausleihlimitProMitglied"); i++) {
      const tid = await legeTitelAn(t.pg);
      const ex = await legeExemplarAn(t.pg, tid);
      await legeAusleiheAn(t.pg, { copyId: ex.id, memberId: amLimit.id, startDate: "2026-11-01", dueDate: "2026-11-29" });
    }
    const titleId = await titelMitExemplar();

    erwarteFehler(await ausleihen(t.kontext(sitzungFuer(amLimit)), { titleId, memberId: leer.id }), "AUSLEIHLIMIT_ERREICHT");
    expect(await zaehle(t.pg, "SELECT count(*) AS n FROM loans WHERE member_id = $1", [leer.id])).toBe(0);
  });
});
