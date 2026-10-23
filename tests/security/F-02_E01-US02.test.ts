// F-02 · E01-US02 · Rechte-Tests Detailseite
// Rechte-Matrix: Detailseite für alle Rollen inkl. Gast; „Ausleihen“ nur Mitglied; „Vormerken“ Mitglied und Gast.
// Öffentliche Antworten ohne Personendaten (security-architektur.md 4.3), auch für Bibliothekar und Administrator.
import { describe, expect, it } from "vitest";
import { ladeTitelDetail } from "@/server/katalog/detail";
import { nutzeTestDatenbank, type Rolle } from "../helpers/testdb";
import { erwarteFehler, erwarteOk } from "../helpers/ergebnis";
import { erwarteKeinePersonendaten } from "../helpers/personendaten";
import {
  legeAusleiheAn,
  legeExemplarAn,
  legeNutzerAn,
  legeTitelAn,
  legeVormerkungAn,
  sitzungFuer,
  zeitpunkt,
} from "../helpers/daten";

const t = nutzeTestDatenbank();

const ROLLEN: (Rolle | null)[] = [null, "MITGLIED", "BIBLIOTHEKAR", "ADMINISTRATOR"];
const name = (rolle: Rolle | null) => rolle ?? "GAST";

async function sitzungFuerRolle(rolle: Rolle | null) {
  return rolle ? sitzungFuer(await legeNutzerAn(t.pg, rolle)) : null;
}

describe("E01-US02-FR01 Rechte: Detailseite für alle Rollen, ohne Personendaten (AK-01.7)", () => {
  it.each(ROLLEN.map((r) => [name(r), r] as const))("%s sieht die Detailseite ohne Personendaten", async (_n, rolle) => {
    const titleId = await legeTitelAn(t.pg);
    const a = await legeExemplarAn(t.pg, titleId);
    await legeExemplarAn(t.pg, titleId);
    const ausleiher = await legeNutzerAn(t.pg, "MITGLIED");
    const vormerker = await legeNutzerAn(t.pg, "MITGLIED");
    await legeAusleiheAn(t.pg, { copyId: a.id, memberId: ausleiher.id, startDate: "2026-11-01", dueDate: "2026-11-29" });
    await legeVormerkungAn(t.pg, { titleId, memberId: vormerker.id, status: "WARTEND", createdAt: zeitpunkt("2026-11-02") });

    const daten = erwarteOk(await ladeTitelDetail(t.kontext(await sitzungFuerRolle(rolle)), titleId));
    expect(daten.exemplare).toHaveLength(2);
    erwarteKeinePersonendaten(daten, [ausleiher, vormerker]);
  });

  it("archivierter und unbekannter Titel liefern für Gast und Mitglied dieselbe Antwort (AK-01.8, AK-01.9)", async () => {
    const archiviert = await legeTitelAn(t.pg, { archiviert: true });
    const mitglied = sitzungFuer(await legeNutzerAn(t.pg, "MITGLIED"));

    for (const s of [null, mitglied]) {
      const a = await ladeTitelDetail(t.kontext(s), archiviert);
      const b = await ladeTitelDetail(t.kontext(s), "00000000-0000-4000-8000-000000000000");
      erwarteFehler(a, "NICHT_GEFUNDEN");
      expect(a).toEqual(b);
    }
  });
});

describe("E01-US02-FR02 Rechte: „Ausleihen“ nur für die Rolle Mitglied (OF-R1)", () => {
  it.each(ROLLEN.map((r) => [name(r), r, r === "MITGLIED"] as const))(
    "%s: ausleihen angeboten = %s",
    async (_n, rolle, erwartet) => {
      const titleId = await legeTitelAn(t.pg);
      await legeExemplarAn(t.pg, titleId);

      const daten = erwarteOk(await ladeTitelDetail(t.kontext(await sitzungFuerRolle(rolle)), titleId));
      expect(daten.aktionen.ausleihen).toBe(erwartet);
    },
  );
});

describe("E01-US02-FR03 Rechte: „Vormerken“ für Mitglied und Gast, nicht für Bibliothekar und Administrator (OF-R1, OF-R2)", () => {
  it.each(ROLLEN.map((r) => [name(r), r, r === null || r === "MITGLIED"] as const))(
    "%s: vormerken angeboten = %s",
    async (_n, rolle, erwartet) => {
      const titleId = await legeTitelAn(t.pg);
      const exemplar = await legeExemplarAn(t.pg, titleId);
      const ausleiher = await legeNutzerAn(t.pg, "MITGLIED");
      await legeAusleiheAn(t.pg, { copyId: exemplar.id, memberId: ausleiher.id, startDate: "2026-11-01", dueDate: "2026-11-29" });

      const daten = erwarteOk(await ladeTitelDetail(t.kontext(await sitzungFuerRolle(rolle)), titleId));
      expect(daten.aktionen.vormerken).toBe(erwartet);
    },
  );
});
