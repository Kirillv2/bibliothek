// F-13 · E07-US01 · Rechte-Tests Dashboard, Vorgangsseite und Bestandsexport
// Rechte-Matrix: nur Bibliothekar; Administrator nicht (OF-R3). Gast → NICHT_ANGEMELDET; Mitglied, Administrator → KEINE_BERECHTIGUNG.
import { describe, expect, it } from "vitest";
import { exportiereBestandCsv, ladeDashboard, ladeVorgang } from "@/server/dashboard";
import { momentaufnahme, nutzeTestDatenbank, type Rolle } from "../helpers/testdb";
import { erwarteFehler, erwarteOk, type Fehlercode } from "../helpers/ergebnis";
import { legeAusleiheAn, legeExemplarAn, legeNutzerAn, legeTitelAn, sitzungFuer } from "../helpers/daten";
import { festeUhr } from "../helpers/uhr";

const t = nutzeTestDatenbank();

const verboten: [string, Rolle | null, Fehlercode][] = [
  ["Gast", null, "NICHT_ANGEMELDET"],
  ["Mitglied", "MITGLIED", "KEINE_BERECHTIGUNG"],
  ["Administrator", "ADMINISTRATOR", "KEINE_BERECHTIGUNG"],
];

async function vorgang() {
  const m = await legeNutzerAn(t.pg, "MITGLIED", "leiher@example.org");
  const ex = await legeExemplarAn(t.pg, await legeTitelAn(t.pg));
  const loanId = await legeAusleiheAn(t.pg, { copyId: ex.id, memberId: m.id, startDate: "2026-10-01", dueDate: "2026-10-29" });
  return { m, loanId };
}

async function kontextFuer(rolle: Rolle | null) {
  return t.kontext(rolle ? sitzungFuer(await legeNutzerAn(t.pg, rolle)) : null, festeUhr("2026-11-10"));
}

describe("E07-US01 Rechte: nur Bibliothekar", () => {
  it.each(verboten)("%s: Dashboard → %s", async (_name, rolle, code) => {
    await vorgang();
    erwarteFehler(await ladeDashboard(await kontextFuer(rolle), {}), code);
  });

  it.each(verboten)("%s: Vorgangsseite → %s", async (_name, rolle, code) => {
    const { loanId } = await vorgang();
    erwarteFehler(await ladeVorgang(await kontextFuer(rolle), loanId), code);
  });

  it.each(verboten)("%s: Bestandsexport → %s", async (_name, rolle, code) => {
    erwarteFehler(await exportiereBestandCsv(await kontextFuer(rolle)), code);
  });

  it("ein Mitglied sieht auch den eigenen Vorgang nicht über die Verwaltung", async () => {
    const { m, loanId } = await vorgang();
    erwarteFehler(await ladeVorgang(t.kontext(sitzungFuer(m), festeUhr("2026-11-10")), loanId), "KEINE_BERECHTIGUNG");
  });

  it("alle drei Funktionen lesen nur: die Datenbank bleibt unverändert", async () => {
    const { loanId } = await vorgang();
    const k = await kontextFuer("BIBLIOTHEKAR");
    const vorher = await momentaufnahme(t.pg);
    erwarteOk(await ladeDashboard(k, { sortierung: "MITGLIED", richtung: "AB" }));
    erwarteOk(await ladeVorgang(k, loanId));
    erwarteOk(await exportiereBestandCsv(k));
    expect(await momentaufnahme(t.pg)).toBe(vorher);
  });

  it("Sortierangabe wird nie als SQL ausgeführt", async () => {
    await vorgang();
    const k = await kontextFuer("BIBLIOTHEKAR");
    erwarteOk(await ladeDashboard(k, { sortierung: "due_date; DELETE FROM loans; --", richtung: "AB" } as never));
    const { rows } = await t.pg.query<{ n: number }>("SELECT count(*)::int AS n FROM loans");
    expect(rows[0].n).toBe(1);
  });
});
