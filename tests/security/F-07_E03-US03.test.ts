// F-07 · E03-US03 · Rechte-Tests Rückgabe erfassen
// Rechte-Matrix: Rückgabe erfassen nur Bibliothekar (Administrator nicht, OF-R3). Ein Mitglied kann keine
// Rückgabe buchen, auch nicht für den eigenen Vorgang. Gast → NICHT_ANGEMELDET. Vorgang bleibt jeweils offen.
import { describe, expect, it } from "vitest";
import { rueckgabeErfassen } from "@/server/rueckgabe";
import { momentaufnahme, nutzeTestDatenbank, type Rolle } from "../helpers/testdb";
import { erwarteFehler, erwarteOk, type Fehlercode } from "../helpers/ergebnis";
import { leseAusleihe, legeAusleiheAn, legeExemplarAn, legeNutzerAn, legeTitelAn, sitzungFuer, type Nutzer } from "../helpers/daten";

const t = nutzeTestDatenbank();

async function offenerVorgang(mitglied?: Nutzer) {
  const titleId = await legeTitelAn(t.pg);
  const exemplar = await legeExemplarAn(t.pg, titleId);
  const nutzer = mitglied ?? (await legeNutzerAn(t.pg, "MITGLIED"));
  const loanId = await legeAusleiheAn(t.pg, { copyId: exemplar.id, memberId: nutzer.id, startDate: "2026-10-01", dueDate: "2026-10-29" });
  return { loanId, inventoryNumber: exemplar.inventoryNumber };
}

describe("E03-US03-FR01 Rechte: Rückgabe erfassen nur durch Bibliothekar", () => {
  const verboten: [string, Rolle | null, Fehlercode][] = [
    ["Gast", null, "NICHT_ANGEMELDET"],
    ["Mitglied", "MITGLIED", "KEINE_BERECHTIGUNG"],
    ["Administrator", "ADMINISTRATOR", "KEINE_BERECHTIGUNG"],
  ];

  it.each(verboten)("%s: %s, Vorgang bleibt offen, keine Mahnung", async (_name, rolle, code) => {
    const { loanId, inventoryNumber } = await offenerVorgang();
    const sitzung = rolle ? sitzungFuer(await legeNutzerAn(t.pg, rolle)) : null;
    const vorher = await momentaufnahme(t.pg);

    erwarteFehler(await rueckgabeErfassen(t.kontext(sitzung), { inventoryNumber }), code);
    expect(await momentaufnahme(t.pg)).toBe(vorher);
    expect((await leseAusleihe(t.pg, loanId))?.returned_at).toBeNull();
  });

  it("Mitglied kann auch den eigenen Vorgang nicht selbst zurückbuchen (ADR 009: erfassen darf nur der Bibliothekar)", async () => {
    const mitglied = await legeNutzerAn(t.pg, "MITGLIED");
    const { loanId, inventoryNumber } = await offenerVorgang(mitglied);
    const vorher = await momentaufnahme(t.pg);

    erwarteFehler(await rueckgabeErfassen(t.kontext(sitzungFuer(mitglied)), { inventoryNumber }), "KEINE_BERECHTIGUNG");
    expect(await momentaufnahme(t.pg)).toBe(vorher);
    expect((await leseAusleihe(t.pg, loanId))?.returned_at).toBeNull();
  });

  it("Bibliothekar darf die Rückgabe erfassen", async () => {
    const { loanId, inventoryNumber } = await offenerVorgang();

    erwarteOk(await rueckgabeErfassen(t.kontext(sitzungFuer(await legeNutzerAn(t.pg, "BIBLIOTHEKAR"))), { inventoryNumber }));
    expect((await leseAusleihe(t.pg, loanId))?.returned_at).not.toBeNull();
  });

  it("Inventarnummer mit SQL-Sonderzeichen ändert nichts", async () => {
    await offenerVorgang();
    const sitzung = sitzungFuer(await legeNutzerAn(t.pg, "BIBLIOTHEKAR"));
    const vorher = await momentaufnahme(t.pg);

    const ergebnis = await rueckgabeErfassen(t.kontext(sitzung), { inventoryNumber: "' OR '1'='1" });
    expect(ergebnis.ok).toBe(false);
    expect(await momentaufnahme(t.pg)).toBe(vorher);
  });
});
