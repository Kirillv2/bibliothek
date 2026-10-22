// F-06 · E03-US02 · Rechte-Tests Meine Ausleihen und Verlängern
// Rechte-Matrix: nur Mitglied, nur eigene Daten (👤). Mitglied A sieht und verlängert Vorgänge von B nicht.
// Bibliothekar und Administrator: KEINE_BERECHTIGUNG (OF-R1). Gast: NICHT_ANGEMELDET.
import { describe, expect, it } from "vitest";
import { ladeMeineAusleihen, verlaengern } from "@/server/verlaengerung";
import { momentaufnahme, nutzeTestDatenbank, type Rolle } from "../helpers/testdb";
import { erwarteFehler, erwarteOk, type Fehlercode } from "../helpers/ergebnis";
import { legeAusleiheAn, legeExemplarAn, legeNutzerAn, legeTitelAn, sitzungFuer, type Nutzer } from "../helpers/daten";

const t = nutzeTestDatenbank();

async function ausleiheVon(nutzer: Nutzer): Promise<string> {
  const titleId = await legeTitelAn(t.pg);
  const exemplar = await legeExemplarAn(t.pg, titleId);
  return legeAusleiheAn(t.pg, { copyId: exemplar.id, memberId: nutzer.id, startDate: "2026-11-01", dueDate: "2026-11-29" });
}

const verboten: [string, Rolle | null, Fehlercode][] = [
  ["Gast", null, "NICHT_ANGEMELDET"],
  ["Bibliothekar", "BIBLIOTHEKAR", "KEINE_BERECHTIGUNG"],
  ["Administrator", "ADMINISTRATOR", "KEINE_BERECHTIGUNG"],
];

describe("E03-US02-FR01 Rechte: eigene Ausleihen nur für das angemeldete Mitglied", () => {
  it.each(verboten)("%s: %s beim Laden von „Meine Ausleihen“", async (_name, rolle, code) => {
    await ausleiheVon(await legeNutzerAn(t.pg, "MITGLIED"));
    const sitzung = rolle ? sitzungFuer(await legeNutzerAn(t.pg, rolle)) : null;

    erwarteFehler(await ladeMeineAusleihen(t.kontext(sitzung)), code);
  });

  it("Mitglied A sieht keine Vorgänge von Mitglied B", async () => {
    const a = await legeNutzerAn(t.pg, "MITGLIED");
    const b = await legeNutzerAn(t.pg, "MITGLIED");
    const eigene = await ausleiheVon(a);
    const fremde = await ausleiheVon(b);

    const liste = erwarteOk(await ladeMeineAusleihen(t.kontext(sitzungFuer(a))));
    expect(liste.map((x) => x.loanId)).toEqual([eigene]);
    expect(JSON.stringify(liste)).not.toContain(fremde);
    expect(JSON.stringify(liste)).not.toContain(b.id);
  });
});

describe("E03-US02-FR02 Rechte: verlängern nur eigene Vorgänge", () => {
  it.each(verboten)("%s: %s, Vorgang unverändert", async (_name, rolle, code) => {
    const loanId = await ausleiheVon(await legeNutzerAn(t.pg, "MITGLIED"));
    const sitzung = rolle ? sitzungFuer(await legeNutzerAn(t.pg, rolle)) : null;
    const vorher = await momentaufnahme(t.pg);

    erwarteFehler(await verlaengern(t.kontext(sitzung), { loanId }), code);
    expect(await momentaufnahme(t.pg)).toBe(vorher);
  });

  it("Mitglied A verlängert einen Vorgang von B: NICHT_GEFUNDEN (verrät nicht, dass es ihn gibt), unverändert", async () => {
    const a = await legeNutzerAn(t.pg, "MITGLIED");
    const b = await legeNutzerAn(t.pg, "MITGLIED");
    const loanVonB = await ausleiheVon(b);
    const vorher = await momentaufnahme(t.pg);

    const fremd = await verlaengern(t.kontext(sitzungFuer(a)), { loanId: loanVonB });
    const unbekannt = await verlaengern(t.kontext(sitzungFuer(a)), { loanId: "00000000-0000-4000-8000-000000000000" });
    erwarteFehler(fremd, "NICHT_GEFUNDEN");
    expect(fremd).toEqual(unbekannt);
    expect(await momentaufnahme(t.pg)).toBe(vorher);
  });

  it("eine memberId in der Eingabe öffnet keinen fremden Vorgang", async () => {
    const a = await legeNutzerAn(t.pg, "MITGLIED");
    const b = await legeNutzerAn(t.pg, "MITGLIED");
    const loanVonB = await ausleiheVon(b);
    const eingabe = { loanId: loanVonB, memberId: b.id, userId: b.id };

    erwarteFehler(await verlaengern(t.kontext(sitzungFuer(a)), eingabe), "NICHT_GEFUNDEN");
  });

  it("Mitglied darf den eigenen Vorgang verlängern", async () => {
    const a = await legeNutzerAn(t.pg, "MITGLIED");
    const loanId = await ausleiheVon(a);

    erwarteOk(await verlaengern(t.kontext(sitzungFuer(a)), { loanId }));
  });
});
