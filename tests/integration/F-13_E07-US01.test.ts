// F-13 · E07-US01 · Dashboard mit Kennzahlen und Bestandsexport (Spec docs/specs/F-13_E07-US01.md)
// Vertrag: `ladeDashboard(k, { sortierung?, richtung? })`, `ladeVorgang(k, loanId)`, `exportiereBestandCsv(k)` aus `@/server/dashboard`.
import { describe, expect, it } from "vitest";
import { exportiereBestandCsv, ladeDashboard, ladeVorgang } from "@/server/dashboard";
import { rueckgabeErfassen } from "@/server/rueckgabe";
import { nutzeTestDatenbank } from "../helpers/testdb";
import { erwarteFehler, erwarteOk } from "../helpers/ergebnis";
import {
  legeAusleiheAn,
  legeExemplarAn,
  legeMahnungAn,
  legeNutzerAn,
  legeTitelAn,
  legeVormerkungAn,
  sitzungFuer,
  zeitpunkt,
  type Nutzer,
} from "../helpers/daten";
import { gebuehrCents, standardWert } from "../helpers/konfiguration";
import { festeUhr, plusTage, tageZwischen } from "../helpers/uhr";

const t = nutzeTestDatenbank();
const H = "2026-11-10";

async function kontext(heute = H) {
  return t.kontext(sitzungFuer(await legeNutzerAn(t.pg, "BIBLIOTHEKAR")), festeUhr(heute));
}

/** Offener Vorgang mit Fälligkeit `dueDate` für ein Mitglied (neu oder gegeben). */
async function offenerVorgang(dueDate: string, optionen: { mitglied?: Nutzer; title?: string } = {}) {
  const mitglied = optionen.mitglied ?? (await legeNutzerAn(t.pg, "MITGLIED"));
  const titleId = await legeTitelAn(t.pg, { title: optionen.title });
  const ex = await legeExemplarAn(t.pg, titleId);
  const loanId = await legeAusleiheAn(t.pg, { copyId: ex.id, memberId: mitglied.id, startDate: plusTage(dueDate, -28), dueDate });
  return { loanId, mitglied, titleId, ex };
}

describe("E07-US01-FR01 Kennzahlen", () => {
  it("AK-01.4 ohne Daten alle drei Kennzahlen 0, leere Liste", async () => {
    const d = erwarteOk(await ladeDashboard(await kontext(), {}));
    expect(d.kennzahlen).toEqual({ offeneAusleihen: 0, ueberfaellig: 0, aktiveVormerkungen: 0 });
    expect(d.ueberfaellige).toEqual([]);
  });

  it("AK-01.1 offene Ausleihen = Vorgänge ohne Rückgabedatum", async () => {
    await offenerVorgang(plusTage(H, 5));
    await offenerVorgang(plusTage(H, -3));
    const m = await legeNutzerAn(t.pg, "MITGLIED");
    const ex = await legeExemplarAn(t.pg, await legeTitelAn(t.pg));
    await legeAusleiheAn(t.pg, { copyId: ex.id, memberId: m.id, startDate: "2026-10-01", dueDate: "2026-10-29", returnedAt: zeitpunkt("2026-10-20") });
    expect(erwarteOk(await ladeDashboard(await kontext(), {})).kennzahlen.offeneAusleihen).toBe(2);
  });

  it("AK-01.2 (OF-F13-1, OF-Z2) überfällig = offen und Fälligkeit vor heute; am Fälligkeitstag noch nicht", async () => {
    await offenerVorgang(plusTage(H, -1));
    await offenerVorgang(plusTage(H, -10));
    await offenerVorgang(H);
    await offenerVorgang(plusTage(H, 1));
    // zurückgegeben trotz alter Fälligkeit: zählt nicht
    const m = await legeNutzerAn(t.pg, "MITGLIED");
    const ex = await legeExemplarAn(t.pg, await legeTitelAn(t.pg));
    await legeAusleiheAn(t.pg, { copyId: ex.id, memberId: m.id, startDate: "2026-10-01", dueDate: "2026-10-29", returnedAt: zeitpunkt("2026-11-02") });
    const d = erwarteOk(await ladeDashboard(await kontext(), {}));
    expect(d.kennzahlen.ueberfaellig).toBe(2);
    expect(d.ueberfaellige).toHaveLength(2);
  });

  it("AK-01.3 aktive Vormerkungen = wartend oder abholbereit", async () => {
    const titleId = await legeTitelAn(t.pg);
    const ex = await legeExemplarAn(t.pg, titleId);
    const status = ["WARTEND", "WARTEND", "ABHOLBEREIT", "ABGEHOLT", "ABGELAUFEN"] as const;
    for (const [i, s] of status.entries()) {
      await legeVormerkungAn(t.pg, {
        titleId,
        memberId: (await legeNutzerAn(t.pg, "MITGLIED")).id,
        createdAt: zeitpunkt("2026-11-01", `0${i}:00`),
        status: s,
        copyId: s === "ABHOLBEREIT" ? ex.id : null,
        pickupDeadline: s === "ABHOLBEREIT" ? plusTage(H, 2) : null,
      });
    }
    expect(erwarteOk(await ladeDashboard(await kontext(), {})).kennzahlen.aktiveVormerkungen).toBe(3);
  });

  it("AK-01.5 nach einer Rückgabe sind die Zahlen sofort aktuell", async () => {
    const { ex } = await offenerVorgang(plusTage(H, -2));
    const k = await kontext();
    expect(erwarteOk(await ladeDashboard(k, {})).kennzahlen).toMatchObject({ offeneAusleihen: 1, ueberfaellig: 1 });
    erwarteOk(await rueckgabeErfassen(k, { inventoryNumber: ex.inventoryNumber }));
    expect(erwarteOk(await ladeDashboard(k, {})).kennzahlen).toMatchObject({ offeneAusleihen: 0, ueberfaellig: 0 });
  });
});

describe("E07-US01-FR02 Liste überfälliger Ausleihen", () => {
  async function dreiUeberfaellige() {
    const b = await legeNutzerAn(t.pg, "MITGLIED", "b@example.org");
    const a = await legeNutzerAn(t.pg, "MITGLIED", "a@example.org");
    const v1 = await offenerVorgang(plusTage(H, -2), { mitglied: b, title: "Erster" });
    const v2 = await offenerVorgang(plusTage(H, -9), { mitglied: b, title: "Zweiter" });
    const v3 = await offenerVorgang(plusTage(H, -5), { mitglied: a, title: "Dritter" });
    return { v1, v2, v3 };
  }

  it("AK-02.1 je Eintrag: Vorgang, Mitglied, Titel, Inventarnummer, Fälligkeit, überschrittene Tage", async () => {
    const { loanId, ex } = await offenerVorgang(plusTage(H, -4), { title: "Der Prozess", mitglied: await legeNutzerAn(t.pg, "MITGLIED", "leser@example.org") });
    const [eintrag] = erwarteOk(await ladeDashboard(await kontext(), {})).ueberfaellige;
    expect(eintrag).toEqual({
      loanId,
      mitgliedEmail: "leser@example.org",
      title: "Der Prozess",
      inventoryNumber: ex.inventoryNumber,
      dueDate: plusTage(H, -4),
      ueberschritteneTage: tageZwischen(plusTage(H, -4), H),
    });
  });

  it("AK-02.2 (OF-F13-2) ohne Angabe: Fälligkeit aufsteigend", async () => {
    const { v1, v2, v3 } = await dreiUeberfaellige();
    const ids = erwarteOk(await ladeDashboard(await kontext(), {})).ueberfaellige.map((e) => e.loanId);
    expect(ids).toEqual([v2.loanId, v3.loanId, v1.loanId]);
  });

  it("AK-02.2 Fälligkeit auf- und absteigend", async () => {
    const { v1, v2, v3 } = await dreiUeberfaellige();
    const k = await kontext();
    const auf = erwarteOk(await ladeDashboard(k, { sortierung: "FAELLIGKEIT", richtung: "AUF" })).ueberfaellige.map((e) => e.loanId);
    const ab = erwarteOk(await ladeDashboard(k, { sortierung: "FAELLIGKEIT", richtung: "AB" })).ueberfaellige.map((e) => e.loanId);
    expect(auf).toEqual([v2.loanId, v3.loanId, v1.loanId]);
    expect(ab).toEqual([v1.loanId, v3.loanId, v2.loanId]);
  });

  it("AK-02.2 gleiche Fälligkeit: nach Mitglied", async () => {
    const z = await legeNutzerAn(t.pg, "MITGLIED", "z@example.org");
    const a = await legeNutzerAn(t.pg, "MITGLIED", "a@example.org");
    const vz = await offenerVorgang(plusTage(H, -3), { mitglied: z });
    const va = await offenerVorgang(plusTage(H, -3), { mitglied: a });
    expect(erwarteOk(await ladeDashboard(await kontext(), {})).ueberfaellige.map((e) => e.loanId)).toEqual([va.loanId, vz.loanId]);
  });

  it("AK-02.3 nach Mitglied auf- und absteigend; gleiches Mitglied nach Fälligkeit aufsteigend", async () => {
    const { v1, v2, v3 } = await dreiUeberfaellige();
    const k = await kontext();
    const auf = erwarteOk(await ladeDashboard(k, { sortierung: "MITGLIED", richtung: "AUF" })).ueberfaellige.map((e) => e.loanId);
    const ab = erwarteOk(await ladeDashboard(k, { sortierung: "MITGLIED", richtung: "AB" })).ueberfaellige.map((e) => e.loanId);
    expect(auf).toEqual([v3.loanId, v2.loanId, v1.loanId]);
    expect(ab).toEqual([v2.loanId, v1.loanId, v3.loanId]);
  });

  it.each([
    { sortierung: "TITEL", richtung: "AUF" },
    { sortierung: "FAELLIGKEIT", richtung: "SEITWAERTS" },
    { sortierung: "1; DROP TABLE loans", richtung: "AB" },
    { sortierung: null, richtung: undefined },
  ])("AK-02.6 ungültige Sortierangabe %j → Standardsortierung, kein Fehler", async (anfrage) => {
    const { v1, v2, v3 } = await dreiUeberfaellige();
    const d = erwarteOk(await ladeDashboard(await kontext(), anfrage as { sortierung?: "FAELLIGKEIT" }));
    expect(d.ueberfaellige.map((e) => e.loanId)).toEqual([v2.loanId, v3.loanId, v1.loanId]);
  });

  it("AK-02.4 (OF-F13-3) Vorgangsseite mit allen Angaben und der Mahnung", async () => {
    const mitglied = await legeNutzerAn(t.pg, "MITGLIED", "vorgang@example.org");
    const titleId = await legeTitelAn(t.pg, { title: "Effi Briest" });
    const ex = await legeExemplarAn(t.pg, titleId);
    const dueDate = plusTage(H, -6);
    const loanId = await legeAusleiheAn(t.pg, { copyId: ex.id, memberId: mitglied.id, startDate: "2026-10-01", dueDate, renewalCount: 1 });
    await t.pg.query("UPDATE loans SET overdue_since = $1 WHERE id = $2", [plusTage(dueDate, 1), loanId]);
    const dunningId = await legeMahnungAn(t.pg, { loanId, createdOn: plusTage(dueDate, 1), feeCents: null });

    const v = erwarteOk(await ladeVorgang(await kontext(), loanId));
    expect(v).toEqual({
      loanId,
      title: "Effi Briest",
      inventoryNumber: ex.inventoryNumber,
      mitgliedEmail: "vorgang@example.org",
      startDate: "2026-10-01",
      dueDate,
      renewalCount: 1,
      overdueSince: plusTage(dueDate, 1),
      returnedAt: null,
      mahnung: {
        dunningId,
        createdOn: plusTage(dueDate, 1),
        gebuehrCents: gebuehrCents(tageZwischen(dueDate, H), standardWert("mahnTagessatzEuro")),
        beglichen: false,
      },
    });
  });

  it("AK-02.4 abgeschlossener Vorgang ohne Mahnung: Rückgabezeitpunkt, keine Mahnung", async () => {
    const m = await legeNutzerAn(t.pg, "MITGLIED");
    const ex = await legeExemplarAn(t.pg, await legeTitelAn(t.pg));
    const zurueck = zeitpunkt("2026-10-20", "10:00");
    const loanId = await legeAusleiheAn(t.pg, { copyId: ex.id, memberId: m.id, startDate: "2026-10-01", dueDate: "2026-10-29", returnedAt: zurueck });
    const v = erwarteOk(await ladeVorgang(await kontext(), loanId));
    expect(v.returnedAt).toBe(zurueck.toISOString());
    expect(v.overdueSince).toBeNull();
    expect(v.mahnung).toBeUndefined();
  });

  it.each(["00000000-0000-4000-8000-0000000000bb", "keine-uuid", ""])("AK-02.5 unbekannte Vorgangs-ID %j → NICHT_GEFUNDEN", async (loanId) => {
    erwarteFehler(await ladeVorgang(await kontext(), loanId), "NICHT_GEFUNDEN");
  });
});

describe("E07-US01-FR03 Bestand exportieren", () => {
  function zeilenDes(inhalt: string): string[] {
    expect(inhalt.startsWith("﻿")).toBe(true);
    expect(inhalt.endsWith("\r\n")).toBe(true);
    return inhalt.slice(1, -2).split("\r\n");
  }

  it("AK-03.1 Kopfzeile und je aktivem Titel eine Zeile, nach Titel sortiert", async () => {
    const b = await legeTitelAn(t.pg, { title: "Buddenbrooks", author: "Thomas Mann", category: "Roman", isbn: "9783596294312" });
    await legeExemplarAn(t.pg, b);
    await legeExemplarAn(t.pg, b);
    await legeTitelAn(t.pg, { title: "Alpha", author: "A", category: "Sachbuch", isbn: null });
    const { inhalt } = erwarteOk(await exportiereBestandCsv(await kontext()));
    expect(zeilenDes(inhalt)).toEqual([
      "Titel;Autor;Kategorie;ISBN;Exemplare gesamt;Exemplare verfügbar",
      "Alpha;A;Sachbuch;;0;0",
      "Buddenbrooks;Thomas Mann;Roman;9783596294312;2;2",
    ]);
  });

  it("AK-03.2 (Querverweis E02-US02-FR03) verfügbar wie im Katalog; gesamt mit verlorenen", async () => {
    const titleId = await legeTitelAn(t.pg, { title: "Bestand" });
    const m = await legeNutzerAn(t.pg, "MITGLIED");
    await legeExemplarAn(t.pg, titleId); // verfügbar
    const ausgeliehen = await legeExemplarAn(t.pg, titleId);
    await legeAusleiheAn(t.pg, { copyId: ausgeliehen.id, memberId: m.id, startDate: "2026-11-01", dueDate: "2026-11-29" });
    const vorgemerkt = await legeExemplarAn(t.pg, titleId);
    await legeVormerkungAn(t.pg, { titleId, memberId: m.id, createdAt: zeitpunkt("2026-11-01"), status: "ABHOLBEREIT", copyId: vorgemerkt.id, pickupDeadline: plusTage(H, 2) });
    await legeExemplarAn(t.pg, titleId, { condition: "VERLOREN" });
    await legeExemplarAn(t.pg, titleId, { condition: "BESCHAEDIGT" }); // verfügbar
    const { inhalt } = erwarteOk(await exportiereBestandCsv(await kontext()));
    expect(zeilenDes(inhalt)[1]).toBe("Bestand;Autorin Test;Testkategorie;;5;2");
  });

  it("AK-03.3 archivierte Titel fehlen; Titel ohne Exemplare mit 0/0", async () => {
    await legeTitelAn(t.pg, { title: "Archiviert", archiviert: true });
    await legeTitelAn(t.pg, { title: "Leer" });
    const z = zeilenDes(erwarteOk(await exportiereBestandCsv(await kontext())).inhalt);
    expect(z).toHaveLength(2);
    expect(z[1]).toBe("Leer;Autorin Test;Testkategorie;;0;0");
  });

  it("AK-03.4 Felder mit Semikolon und Anführungszeichen stehen in Anführungszeichen", async () => {
    await legeTitelAn(t.pg, { title: 'Krieg; und "Frieden"', author: "Tolstoi" });
    const z = zeilenDes(erwarteOk(await exportiereBestandCsv(await kontext())).inhalt);
    expect(z[1]).toBe('"Krieg; und ""Frieden""";Tolstoi;Testkategorie;;0;0');
  });

  it("AK-03.5 (Security-Architektur 6) CSV-Injection wird entschärft", async () => {
    await legeTitelAn(t.pg, { title: "=HYPERLINK(1)", author: "@Autor", category: "+Kat" });
    const z = zeilenDes(erwarteOk(await exportiereBestandCsv(await kontext())).inhalt);
    expect(z[1]).toBe("'=HYPERLINK(1);'@Autor;'+Kat;;0;0");
  });

  it("AK-03.6 keine Personendaten im Export", async () => {
    const titleId = await legeTitelAn(t.pg);
    const ex = await legeExemplarAn(t.pg, titleId);
    const m = await legeNutzerAn(t.pg, "MITGLIED", "geheim@example.org");
    await legeAusleiheAn(t.pg, { copyId: ex.id, memberId: m.id, startDate: "2026-11-01", dueDate: "2026-11-29" });
    const { inhalt } = erwarteOk(await exportiereBestandCsv(await kontext()));
    expect(inhalt).not.toContain("geheim@example.org");
    expect(inhalt).not.toContain(m.id);
  });

  it("AK-03.7 Dateiname bestand-JJJJ-MM-TT.csv mit heutigem Datum", async () => {
    expect(erwarteOk(await exportiereBestandCsv(await kontext("2026-12-03"))).dateiname).toBe("bestand-2026-12-03.csv");
  });
});
