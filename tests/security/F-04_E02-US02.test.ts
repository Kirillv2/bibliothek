// F-04 · E02-US02 · Rechte-Tests Exemplare
// Rechte-Matrix: Exemplare anlegen und Zustand ändern nur Bibliothekar (Administrator nicht, OF-R3).
import { describe, expect, it } from "vitest";
import { exemplarAnlegen, exemplarZustandAendern } from "@/server/exemplare";
import { momentaufnahme, nutzeTestDatenbank, type Kontext, type Rolle } from "../helpers/testdb";
import { erwarteFehler, erwarteOk, type Fehlercode } from "../helpers/ergebnis";
import { legeExemplarAn, legeNutzerAn, legeTitelAn, sitzungFuer } from "../helpers/daten";

const t = nutzeTestDatenbank();

type Fall = { name: string; ausfuehren: (k: Kontext, ids: { titleId: string; copyId: string }) => Promise<unknown> };

const AKTIONEN: Fall[] = [
  { name: "exemplarAnlegen", ausfuehren: (k, { titleId }) => exemplarAnlegen(k, { titleId }) },
  { name: "exemplarZustandAendern", ausfuehren: (k, { copyId }) => exemplarZustandAendern(k, { copyId, condition: "VERLOREN" }) },
];

const VERBOTEN: [string, Rolle | null, Fehlercode][] = [
  ["Gast", null, "NICHT_ANGEMELDET"],
  ["Mitglied", "MITGLIED", "KEINE_BERECHTIGUNG"],
  ["Administrator", "ADMINISTRATOR", "KEINE_BERECHTIGUNG"],
];

describe("E02-US02-FR01 E02-US02-FR02 Rechte: Exemplarpflege nur durch Bibliothekar", () => {
  for (const aktion of AKTIONEN) {
    it.each(VERBOTEN)(`${aktion.name} als %s: %s… ohne Wirkung`, async (_name, rolle, code) => {
      const titleId = await legeTitelAn(t.pg);
      const { id: copyId } = await legeExemplarAn(t.pg, titleId);
      const sitzung = rolle ? sitzungFuer(await legeNutzerAn(t.pg, rolle)) : null;
      const vorher = await momentaufnahme(t.pg);

      const ergebnis = (await aktion.ausfuehren(t.kontext(sitzung), { titleId, copyId })) as Parameters<typeof erwarteFehler>[0];
      erwarteFehler(ergebnis, code);
      expect(await momentaufnahme(t.pg)).toBe(vorher);
    });
  }

  it("Bibliothekar darf Exemplare anlegen und den Zustand ändern", async () => {
    const titleId = await legeTitelAn(t.pg);
    const k = t.kontext(sitzungFuer(await legeNutzerAn(t.pg, "BIBLIOTHEKAR")));

    const { copyId } = erwarteOk(await exemplarAnlegen(k, { titleId }));
    erwarteOk(await exemplarZustandAendern(k, { copyId, condition: "BESCHAEDIGT" }));
  });
});
