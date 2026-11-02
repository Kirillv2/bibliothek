// F-09 · E04-US02 · Rechte-Tests Mahnungen
// Rechte-Matrix: alle Mahnungen ansehen und begleichen nur Bibliothekar (Administrator nicht, OF-R3);
// eigene Mahnungen sieht nur das Mitglied selbst (OF-R4). Gast → NICHT_ANGEMELDET.
import { describe, expect, it } from "vitest";
import { ladeMahnungen, ladeMeineMahnungen, mahnungBegleichen } from "@/server/mahnungen";
import { momentaufnahme, nutzeTestDatenbank, type Rolle } from "../helpers/testdb";
import { erwarteFehler, erwarteOk, type Fehlercode } from "../helpers/ergebnis";
import { festeUhr } from "../helpers/uhr";
import { legeAusleiheAn, legeExemplarAn, legeMahnungAn, legeNutzerAn, legeTitelAn, sitzungFuer, type Nutzer } from "../helpers/daten";

const t = nutzeTestDatenbank();
const HEUTE = "2026-11-10";

/** Abgeschlossener, verspätet zurückgegebener Vorgang mit offener Mahnung. */
async function mahnungFuer(mitglied?: Nutzer) {
  const titleId = await legeTitelAn(t.pg);
  const exemplar = await legeExemplarAn(t.pg, titleId);
  const nutzer = mitglied ?? (await legeNutzerAn(t.pg, "MITGLIED"));
  const loanId = await legeAusleiheAn(t.pg, {
    copyId: exemplar.id,
    memberId: nutzer.id,
    startDate: "2026-10-01",
    dueDate: "2026-10-29",
    returnedAt: new Date("2026-11-02T10:00:00Z"),
  });
  const dunningId = await legeMahnungAn(t.pg, { loanId, createdOn: "2026-11-02", feeCents: 200 });
  return { dunningId, nutzer, inventoryNumber: exemplar.inventoryNumber };
}

const verboten: [string, Rolle | null, Fehlercode][] = [
  ["Gast", null, "NICHT_ANGEMELDET"],
  ["Mitglied", "MITGLIED", "KEINE_BERECHTIGUNG"],
  ["Administrator", "ADMINISTRATOR", "KEINE_BERECHTIGUNG"],
];

describe("E04-US02-FR03 Rechte: Mahnungen ansehen und begleichen nur Bibliothekar", () => {
  it.each(verboten)("%s: Liste → %s", async (_name, rolle, code) => {
    await mahnungFuer();
    const sitzung = rolle ? sitzungFuer(await legeNutzerAn(t.pg, rolle)) : null;
    erwarteFehler(await ladeMahnungen(t.kontext(sitzung, festeUhr(HEUTE)), {}), code);
  });

  it.each(verboten)("%s: begleichen → %s, nichts ändert sich", async (_name, rolle, code) => {
    const { dunningId } = await mahnungFuer();
    const sitzung = rolle ? sitzungFuer(await legeNutzerAn(t.pg, rolle)) : null;
    const vorher = await momentaufnahme(t.pg);
    erwarteFehler(await mahnungBegleichen(t.kontext(sitzung, festeUhr(HEUTE)), { dunningId }), code);
    expect(await momentaufnahme(t.pg)).toBe(vorher);
  });

  it("Mitglied kann auch die eigene Mahnung nicht selbst begleichen", async () => {
    const mitglied = await legeNutzerAn(t.pg, "MITGLIED");
    const { dunningId } = await mahnungFuer(mitglied);
    const vorher = await momentaufnahme(t.pg);
    erwarteFehler(await mahnungBegleichen(t.kontext(sitzungFuer(mitglied), festeUhr(HEUTE)), { dunningId }), "KEINE_BERECHTIGUNG");
    expect(await momentaufnahme(t.pg)).toBe(vorher);
  });

  it("Bibliothekar darf beide Aktionen", async () => {
    const { dunningId } = await mahnungFuer();
    const bib = sitzungFuer(await legeNutzerAn(t.pg, "BIBLIOTHEKAR"));
    expect(erwarteOk(await ladeMahnungen(t.kontext(bib, festeUhr(HEUTE)), {}))).toHaveLength(1);
    erwarteOk(await mahnungBegleichen(t.kontext(bib, festeUhr(HEUTE)), { dunningId }));
  });

  it("die ID des Bibliothekars kommt aus der Sitzung, nicht aus der Eingabe", async () => {
    const { dunningId } = await mahnungFuer();
    const bib = await legeNutzerAn(t.pg, "BIBLIOTHEKAR");
    const anderer = await legeNutzerAn(t.pg, "BIBLIOTHEKAR");
    erwarteOk(
      await mahnungBegleichen(t.kontext(sitzungFuer(bib), festeUhr(HEUTE)), { dunningId, settledById: anderer.id, userId: anderer.id }),
    );
    const { rows } = await t.pg.query<{ settled_by_id: string }>("SELECT settled_by_id FROM dunnings WHERE id = $1", [dunningId]);
    expect(rows[0].settled_by_id).toBe(bib.id);
  });
});

describe("E04-US02-FR02 Rechte: eigene Mahnungen nur für das Mitglied selbst (OF-R4)", () => {
  it("Gast → NICHT_ANGEMELDET; Bibliothekar und Administrator → KEINE_BERECHTIGUNG", async () => {
    erwarteFehler(await ladeMeineMahnungen(t.kontext(null)), "NICHT_ANGEMELDET");
    for (const rolle of ["BIBLIOTHEKAR", "ADMINISTRATOR"] as const) {
      erwarteFehler(await ladeMeineMahnungen(t.kontext(sitzungFuer(await legeNutzerAn(t.pg, rolle)))), "KEINE_BERECHTIGUNG");
    }
  });

  it("Mitglied A sieht keine Mahnung von Mitglied B", async () => {
    const a = await legeNutzerAn(t.pg, "MITGLIED");
    const b = await mahnungFuer();
    expect(erwarteOk(await ladeMeineMahnungen(t.kontext(sitzungFuer(a), festeUhr(HEUTE))))).toEqual([]);
    expect(erwarteOk(await ladeMeineMahnungen(t.kontext(sitzungFuer(b.nutzer), festeUhr(HEUTE))))).toHaveLength(1);
  });
});
