// F-03 · E02-US01 · Rechte-Tests Titel pflegen
// Rechte-Matrix: Titel anlegen, bearbeiten, archivieren nur Bibliothekar (Administrator nicht, OF-R3).
// Gast → NICHT_ANGEMELDET, Mitglied und Administrator → KEINE_BERECHTIGUNG, jeweils ohne Wirkung in der DB.
import { describe, expect, it } from "vitest";
import { ladeVerwaltungsliste, titelAnlegen, titelArchivieren, titelBearbeiten } from "@/server/titel";
import { momentaufnahme, nutzeTestDatenbank, type Kontext, type Rolle } from "../helpers/testdb";
import { erwarteFehler, erwarteOk, type Fehlercode } from "../helpers/ergebnis";
import { legeNutzerAn, legeTitelAn, sitzungFuer } from "../helpers/daten";

const t = nutzeTestDatenbank();

type Fall = { name: string; ausfuehren: (k: Kontext, titleId: string) => Promise<unknown> };

const AKTIONEN: Fall[] = [
  { name: "titelAnlegen", ausfuehren: (k) => titelAnlegen(k, { title: "Neu", author: "A", category: "K" }) },
  { name: "titelBearbeiten", ausfuehren: (k, titleId) => titelBearbeiten(k, { titleId, title: "Geändert", author: "A", category: "K" }) },
  { name: "titelArchivieren", ausfuehren: (k, titleId) => titelArchivieren(k, { titleId }) },
  { name: "ladeVerwaltungsliste", ausfuehren: (k) => ladeVerwaltungsliste(k) },
];

const VERBOTEN: [string, Rolle | null, Fehlercode][] = [
  ["Gast", null, "NICHT_ANGEMELDET"],
  ["Mitglied", "MITGLIED", "KEINE_BERECHTIGUNG"],
  ["Administrator", "ADMINISTRATOR", "KEINE_BERECHTIGUNG"],
];

describe("E02-US01-FR01 E02-US01-FR02 E02-US01-FR03 Rechte: Titelpflege nur durch Bibliothekar", () => {
  for (const aktion of AKTIONEN) {
    it.each(VERBOTEN)(`${aktion.name} als %s: %s… ohne Wirkung`, async (_name, rolle, code) => {
      const titleId = await legeTitelAn(t.pg, { title: "Bestand" });
      const sitzung = rolle ? sitzungFuer(await legeNutzerAn(t.pg, rolle)) : null;
      const vorher = await momentaufnahme(t.pg);

      const ergebnis = (await aktion.ausfuehren(t.kontext(sitzung), titleId)) as Parameters<typeof erwarteFehler>[0];
      erwarteFehler(ergebnis, code);
      expect(await momentaufnahme(t.pg)).toBe(vorher);
    });
  }

  it("Bibliothekar darf anlegen, bearbeiten, archivieren und die Verwaltungsliste sehen", async () => {
    const k = t.kontext(sitzungFuer(await legeNutzerAn(t.pg, "BIBLIOTHEKAR")));

    const { titleId } = erwarteOk(await titelAnlegen(k, { title: "Neu", author: "A", category: "K" }));
    erwarteOk(await titelBearbeiten(k, { titleId, title: "Geändert", author: "A", category: "K" }));
    erwarteOk(await titelArchivieren(k, { titleId }));
    expect(erwarteOk(await ladeVerwaltungsliste(k)).map((x) => x.titleId)).toContain(titleId);
  });

  it("eine Rolle in der Eingabe wird ignoriert: Mitglied mit role BIBLIOTHEKAR in der Eingabe bleibt ohne Recht", async () => {
    const mitglied = sitzungFuer(await legeNutzerAn(t.pg, "MITGLIED"));
    const vorher = await momentaufnahme(t.pg);
    const eingabe = { title: "Neu", author: "A", category: "K", role: "BIBLIOTHEKAR" };

    erwarteFehler(await titelAnlegen(t.kontext(mitglied), eingabe), "KEINE_BERECHTIGUNG");
    expect(await momentaufnahme(t.pg)).toBe(vorher);
  });
});
