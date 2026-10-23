// F-02 · E01-US02 · Detailseite eines Titels mit Exemplarstatus
// Spec: docs/specs/F-02_E01-US02.md · Testplan: docs/testing/F-02.md
import { describe, expect, it } from "vitest";
import { ladeTitelDetail } from "@/server/katalog/detail";
import { ausleihen } from "@/server/ausleihe";
import { momentaufnahme, nutzeTestDatenbank, type Rolle, type Sitzung } from "../helpers/testdb";
import { erwarteFehler, erwarteOk } from "../helpers/ergebnis";
import { erwarteKeinePersonendaten } from "../helpers/personendaten";
import {
  legeAusleiheAn,
  legeExemplarAn,
  legeMahnungAn,
  legeNutzerAn,
  legeTitelAn,
  legeVormerkungAn,
  sitzungFuer,
  zeitpunkt,
} from "../helpers/daten";

const t = nutzeTestDatenbank();

async function detail(titleId: string, sitzung: Sitzung | null = null) {
  return erwarteOk(await ladeTitelDetail(t.kontext(sitzung), titleId));
}

async function sitzung(rolle: Rolle): Promise<Sitzung> {
  return sitzungFuer(await legeNutzerAn(t.pg, rolle));
}

async function verleihe(copyId: string, dueDate = "2026-11-29"): Promise<string> {
  const mitglied = await legeNutzerAn(t.pg, "MITGLIED");
  return legeAusleiheAn(t.pg, { copyId, memberId: mitglied.id, startDate: "2026-11-01", dueDate });
}

/** Titel, dessen einziges Exemplar ausgeliehen ist. */
async function titelOhneVerfuegbaresExemplar(): Promise<string> {
  const titleId = await legeTitelAn(t.pg, { title: "Alles verliehen" });
  const exemplar = await legeExemplarAn(t.pg, titleId);
  await verleihe(exemplar.id);
  return titleId;
}

/** Titel mit einem verfügbaren Exemplar. */
async function titelMitVerfuegbaremExemplar(): Promise<string> {
  const titleId = await legeTitelAn(t.pg, { title: "Verfügbar" });
  await legeExemplarAn(t.pg, titleId);
  return titleId;
}

describe("E01-US02-FR01 Metadaten und Liste der Exemplare mit Status", () => {
  it("AK-01.1 zeigt alle Metadaten des Titels", async () => {
    const titleId = await legeTitelAn(t.pg, {
      title: "Der Process",
      author: "Franz Kafka",
      category: "Roman",
      isbn: "978-3-16-148410-0",
      description: "Josef K. wird verhaftet.",
      publicationYear: 1925,
    });

    expect(await detail(titleId)).toMatchObject({
      titleId,
      title: "Der Process",
      author: "Franz Kafka",
      category: "Roman",
      isbn: "978-3-16-148410-0",
      description: "Josef K. wird verhaftet.",
      publicationYear: 1925,
    });
  });

  it("AK-01.1 fehlende optionale Felder sind kein Fehler", async () => {
    const titleId = await legeTitelAn(t.pg, { title: "Nur Pflichtfelder", isbn: null, description: null, publicationYear: null });

    const daten = await detail(titleId);
    expect(daten.title).toBe("Nur Pflichtfelder");
    expect(daten.isbn ?? null).toBeNull();
    expect(daten.description ?? null).toBeNull();
    expect(daten.publicationYear ?? null).toBeNull();
    expect(daten.exemplare).toEqual([]);
  });

  it("AK-01.2 zeigt jedes Exemplar mit Inventarnummer und Status", async () => {
    const titleId = await legeTitelAn(t.pg);
    const a = await legeExemplarAn(t.pg, titleId, { inventoryNumber: "INV-900001" });
    const b = await legeExemplarAn(t.pg, titleId, { inventoryNumber: "INV-900002" });
    await verleihe(b.id, "2026-11-05");
    const fremd = await legeTitelAn(t.pg);
    await legeExemplarAn(t.pg, fremd, { inventoryNumber: "INV-900003" });

    const { exemplare } = await detail(titleId);
    expect(exemplare.map((e) => [e.inventoryNumber, e.status])).toEqual([
      [a.inventoryNumber, "VERFUEGBAR"],
      [b.inventoryNumber, "AUSGELIEHEN"],
    ]);
  });

  it("AK-01.3 Exemplar ohne offenen Ausleihvorgang und ohne Zuordnung ist verfügbar", async () => {
    const titleId = await legeTitelAn(t.pg);
    await legeExemplarAn(t.pg, titleId);

    const [exemplar] = (await detail(titleId)).exemplare;
    expect(exemplar.status).toBe("VERFUEGBAR");
    expect(exemplar.faelligAm).toBeUndefined();
  });

  it("AK-01.3 nach abgeschlossenem Ausleihvorgang ist das Exemplar wieder verfügbar", async () => {
    const titleId = await legeTitelAn(t.pg);
    const exemplar = await legeExemplarAn(t.pg, titleId);
    const mitglied = await legeNutzerAn(t.pg, "MITGLIED");
    await legeAusleiheAn(t.pg, {
      copyId: exemplar.id,
      memberId: mitglied.id,
      startDate: "2026-10-01",
      dueDate: "2026-10-29",
      returnedAt: zeitpunkt("2026-10-20"),
    });

    expect((await detail(titleId)).exemplare[0].status).toBe("VERFUEGBAR");
  });

  it("AK-01.4 Exemplar mit offenem Ausleihvorgang: ausgeliehen bis zur Fälligkeit", async () => {
    const titleId = await legeTitelAn(t.pg);
    const exemplar = await legeExemplarAn(t.pg, titleId);
    await verleihe(exemplar.id, "2026-11-05");

    const [daten] = (await detail(titleId)).exemplare;
    expect(daten).toMatchObject({ inventoryNumber: exemplar.inventoryNumber, status: "AUSGELIEHEN", faelligAm: "2026-11-05" });
  });

  it("AK-01.5 (Querverweis E03-US03-FR03, E05-US01) Exemplar einer abholbereiten Vormerkung ist vorgemerkt", async () => {
    const titleId = await legeTitelAn(t.pg);
    const exemplar = await legeExemplarAn(t.pg, titleId);
    const mitglied = await legeNutzerAn(t.pg, "MITGLIED");
    await legeVormerkungAn(t.pg, {
      titleId,
      memberId: mitglied.id,
      status: "ABHOLBEREIT",
      createdAt: zeitpunkt("2026-11-01"),
      copyId: exemplar.id,
      pickupDeadline: "2026-11-13",
    });

    expect((await detail(titleId)).exemplare[0].status).toBe("VORGEMERKT");
  });

  it("AK-01.5 eine abgelaufene Vormerkung mit Exemplar macht es nicht zu „vorgemerkt“", async () => {
    const titleId = await legeTitelAn(t.pg);
    const exemplar = await legeExemplarAn(t.pg, titleId);
    const mitglied = await legeNutzerAn(t.pg, "MITGLIED");
    await legeVormerkungAn(t.pg, {
      titleId,
      memberId: mitglied.id,
      status: "ABGELAUFEN",
      createdAt: zeitpunkt("2026-10-01"),
      copyId: exemplar.id,
      pickupDeadline: "2026-10-10",
    });

    expect((await detail(titleId)).exemplare[0].status).toBe("VERFUEGBAR");
  });

  it("AK-01.5 eine wartende Vormerkung ohne Exemplar ändert den Status der Exemplare nicht", async () => {
    const titleId = await legeTitelAn(t.pg);
    const exemplar = await legeExemplarAn(t.pg, titleId);
    await verleihe(exemplar.id, "2026-11-20");
    const mitglied = await legeNutzerAn(t.pg, "MITGLIED");
    await legeVormerkungAn(t.pg, { titleId, memberId: mitglied.id, status: "WARTEND", createdAt: zeitpunkt("2026-11-02") });

    expect((await detail(titleId)).exemplare[0]).toMatchObject({ status: "AUSGELIEHEN", faelligAm: "2026-11-20" });
  });

  it("AK-01.6 verlorenes Exemplar ist „nicht verfügbar“ (GESPERRT) und bleibt in der Liste", async () => {
    const titleId = await legeTitelAn(t.pg);
    const gut = await legeExemplarAn(t.pg, titleId, { inventoryNumber: "INV-900010" });
    const verloren = await legeExemplarAn(t.pg, titleId, { inventoryNumber: "INV-900011", condition: "VERLOREN" });

    const { exemplare } = await detail(titleId);
    expect(exemplare.map((e) => [e.inventoryNumber, e.status])).toEqual([
      [gut.inventoryNumber, "VERFUEGBAR"],
      [verloren.inventoryNumber, "GESPERRT"],
    ]);
  });

  it("AK-01.6 beschädigtes Exemplar ist verfügbar (OF-D2)", async () => {
    const titleId = await legeTitelAn(t.pg);
    await legeExemplarAn(t.pg, titleId, { condition: "BESCHAEDIGT" });

    expect((await detail(titleId)).exemplare[0].status).toBe("VERFUEGBAR");
  });

  it("AK-01.7 die Detailseite enthält keine Personendaten", async () => {
    const titleId = await legeTitelAn(t.pg);
    const a = await legeExemplarAn(t.pg, titleId);
    const b = await legeExemplarAn(t.pg, titleId);
    const ausleiher = await legeNutzerAn(t.pg, "MITGLIED");
    const vormerker = await legeNutzerAn(t.pg, "MITGLIED");
    const wartend = await legeNutzerAn(t.pg, "MITGLIED");
    await legeAusleiheAn(t.pg, { copyId: a.id, memberId: ausleiher.id, startDate: "2026-11-01", dueDate: "2026-11-29" });
    await legeVormerkungAn(t.pg, {
      titleId,
      memberId: vormerker.id,
      status: "ABHOLBEREIT",
      createdAt: zeitpunkt("2026-11-01"),
      copyId: b.id,
      pickupDeadline: "2026-11-13",
    });
    await legeVormerkungAn(t.pg, { titleId, memberId: wartend.id, status: "WARTEND", createdAt: zeitpunkt("2026-11-03") });

    erwarteKeinePersonendaten(await detail(titleId), [ausleiher, vormerker, wartend]);
  });

  it("AK-01.8 unbekannte Titel-ID: NICHT_GEFUNDEN", async () => {
    erwarteFehler(await ladeTitelDetail(t.kontext(null), "00000000-0000-4000-8000-000000000000"), "NICHT_GEFUNDEN");
  });

  it("AK-01.8 eine ID in falschem Format ergibt ebenfalls NICHT_GEFUNDEN (kein Absturz)", async () => {
    erwarteFehler(await ladeTitelDetail(t.kontext(null), "kein-gueltiger-wert"), "NICHT_GEFUNDEN");
  });

  it.each([
    ["Gast", null],
    ["Mitglied", "MITGLIED"],
  ] as const)("AK-01.9 archivierter Titel ist für %s NICHT_GEFUNDEN", async (_name, rolle) => {
    const titleId = await legeTitelAn(t.pg, { archiviert: true });
    await legeExemplarAn(t.pg, titleId);
    const s = rolle ? await sitzung(rolle) : null;

    erwarteFehler(await ladeTitelDetail(t.kontext(s), titleId), "NICHT_GEFUNDEN");
  });

  it("AK-01.10 die Exemplare sind nach Inventarnummer sortiert", async () => {
    const titleId = await legeTitelAn(t.pg);
    await legeExemplarAn(t.pg, titleId, { inventoryNumber: "INV-900030" });
    await legeExemplarAn(t.pg, titleId, { inventoryNumber: "INV-900010" });
    await legeExemplarAn(t.pg, titleId, { inventoryNumber: "INV-900020" });

    const nummern = (await detail(titleId)).exemplare.map((e) => e.inventoryNumber);
    expect(nummern).toEqual(["INV-900010", "INV-900020", "INV-900030"]);
  });
});

describe("E01-US02-FR02 Aktion „Ausleihen“ für angemeldete Mitglieder bei verfügbarem Exemplar", () => {
  it("AK-02.1 Mitglied und mindestens ein verfügbares Exemplar: „Ausleihen“ wird angeboten", async () => {
    const titleId = await titelMitVerfuegbaremExemplar();

    expect((await detail(titleId, await sitzung("MITGLIED"))).aktionen.ausleihen).toBe(true);
  });

  it("AK-02.1 auch wenn nur eines von mehreren Exemplaren verfügbar ist", async () => {
    const titleId = await legeTitelAn(t.pg);
    const verliehen = await legeExemplarAn(t.pg, titleId);
    await verleihe(verliehen.id);
    await legeExemplarAn(t.pg, titleId, { condition: "VERLOREN" });
    await legeExemplarAn(t.pg, titleId, { condition: "BESCHAEDIGT" });

    expect((await detail(titleId, await sitzung("MITGLIED"))).aktionen.ausleihen).toBe(true);
  });

  it("AK-02.2 Gast: „Ausleihen“ wird nicht angeboten", async () => {
    const titleId = await titelMitVerfuegbaremExemplar();

    expect((await detail(titleId, null)).aktionen.ausleihen).toBe(false);
  });

  it.each(["BIBLIOTHEKAR", "ADMINISTRATOR"] as const)(
    "AK-02.3 %s: „Ausleihen“ wird nicht angeboten (OF-R1)",
    async (rolle) => {
      const titleId = await titelMitVerfuegbaremExemplar();

      expect((await detail(titleId, await sitzung(rolle))).aktionen.ausleihen).toBe(false);
    },
  );

  it("AK-02.4 kein verfügbares Exemplar: „Ausleihen“ wird nicht angeboten", async () => {
    const titleId = await titelOhneVerfuegbaresExemplar();

    expect((await detail(titleId, await sitzung("MITGLIED"))).aktionen.ausleihen).toBe(false);
  });

  it("AK-02.4 nur verlorene Exemplare oder gar keine: „Ausleihen“ wird nicht angeboten", async () => {
    const nurVerloren = await legeTitelAn(t.pg);
    await legeExemplarAn(t.pg, nurVerloren, { condition: "VERLOREN" });
    const ohne = await legeTitelAn(t.pg);
    const mitglied = await sitzung("MITGLIED");

    expect((await detail(nurVerloren, mitglied)).aktionen.ausleihen).toBe(false);
    expect((await detail(ohne, mitglied)).aktionen.ausleihen).toBe(false);
  });

  it("AK-02.5 (Querverweis E03-US01, F-05) Ausleihen von der Detailseite: Erfolg mit Fälligkeit, danach Status ausgeliehen", async () => {
    const titleId = await titelMitVerfuegbaremExemplar();
    const mitglied = await sitzung("MITGLIED");

    const ergebnis = erwarteOk(await ausleihen(t.kontext(mitglied), { titleId }));
    const [exemplar] = (await detail(titleId, mitglied)).exemplare;
    expect(exemplar).toMatchObject({
      inventoryNumber: ergebnis.inventoryNumber,
      status: "AUSGELIEHEN",
      faelligAm: ergebnis.dueDate,
    });
  });

  it("AK-02.5 (Querverweis E03-US01, F-05) Ausleihen von der Detailseite: Fehlergrund wird geliefert", async () => {
    const titleId = await titelMitVerfuegbaremExemplar();
    const mitglied = await legeNutzerAn(t.pg, "MITGLIED");
    const altTitel = await legeTitelAn(t.pg);
    const altExemplar = await legeExemplarAn(t.pg, altTitel);
    const loanId = await legeAusleiheAn(t.pg, {
      copyId: altExemplar.id,
      memberId: mitglied.id,
      startDate: "2026-09-01",
      dueDate: "2026-09-29",
      returnedAt: zeitpunkt("2026-10-05"),
    });
    await legeMahnungAn(t.pg, { loanId, createdOn: "2026-09-30", feeCents: 100 });

    erwarteFehler(await ausleihen(t.kontext(sitzungFuer(mitglied)), { titleId }), "OFFENE_MAHNUNG");
  });
});

describe("E01-US02-FR03 Aktion „Vormerken“, wenn kein Exemplar verfügbar ist", () => {
  it("AK-03.1 kein verfügbares Exemplar: Mitglied bekommt „Vormerken“ angeboten", async () => {
    const titleId = await titelOhneVerfuegbaresExemplar();

    expect((await detail(titleId, await sitzung("MITGLIED"))).aktionen.vormerken).toBe(true);
  });

  it("AK-03.1 auch bei einem Titel ohne Exemplare oder nur mit verlorenen Exemplaren", async () => {
    const ohne = await legeTitelAn(t.pg);
    const nurVerloren = await legeTitelAn(t.pg);
    await legeExemplarAn(t.pg, nurVerloren, { condition: "VERLOREN" });
    const mitglied = await sitzung("MITGLIED");

    expect((await detail(ohne, mitglied)).aktionen.vormerken).toBe(true);
    expect((await detail(nurVerloren, mitglied)).aktionen.vormerken).toBe(true);
  });

  it("AK-03.2 mindestens ein verfügbares Exemplar: „Vormerken“ wird nicht angeboten", async () => {
    const titleId = await titelMitVerfuegbaremExemplar();

    expect((await detail(titleId, await sitzung("MITGLIED"))).aktionen.vormerken).toBe(false);
    expect((await detail(titleId, null)).aktionen.vormerken).toBe(false);
  });

  it("AK-03.3 (Querverweis E06-US01-FR02) Gast sieht „Vormerken“; das Laden der Seite legt keine Vormerkung an", async () => {
    const titleId = await titelOhneVerfuegbaresExemplar();
    const vorher = await momentaufnahme(t.pg);

    expect((await detail(titleId, null)).aktionen.vormerken).toBe(true);
    expect(await momentaufnahme(t.pg)).toBe(vorher);
  });

  it("AK-03.4 (Querverweis E05-US01) „Vormerken“ ist sichtbar, „Ausleihen“ nicht, wenn kein Exemplar verfügbar ist", async () => {
    const titleId = await titelOhneVerfuegbaresExemplar();

    expect((await detail(titleId, await sitzung("MITGLIED"))).aktionen).toEqual({ ausleihen: false, vormerken: true });
  });

  it.each(["BIBLIOTHEKAR", "ADMINISTRATOR"] as const)(
    "AK-03.5 %s bekommt „Vormerken“ nicht angeboten (OF-R1)",
    async (rolle) => {
      const titleId = await titelOhneVerfuegbaresExemplar();

      expect((await detail(titleId, await sitzung(rolle))).aktionen.vormerken).toBe(false);
    },
  );
});
