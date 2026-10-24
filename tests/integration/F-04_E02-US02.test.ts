// F-04 · E02-US02 · Exemplare mit Inventarnummer und Zustand verwalten
// Spec: docs/specs/F-04_E02-US02.md · Testplan: docs/testing/F-04.md
import { describe, expect, it } from "vitest";
import * as exemplarModul from "@/server/exemplare";
import { exemplarAnlegen, exemplarZustandAendern } from "@/server/exemplare";
import { sucheKatalog } from "@/server/katalog/suche";
import { ladeTitelDetail } from "@/server/katalog/detail";
import { ausleihen } from "@/server/ausleihe";
import { momentaufnahme, nutzeTestDatenbank, zaehle, type Sitzung } from "../helpers/testdb";
import { erwarteFehler, erwarteOk } from "../helpers/ergebnis";
import {
  leseAusleihe,
  legeAusleiheAn,
  legeExemplarAn,
  legeNutzerAn,
  legeTitelAn,
  legeVormerkungAn,
  sitzungFuer,
  zeitpunkt,
} from "../helpers/daten";

const t = nutzeTestDatenbank();

type Zustand = "GUT" | "BESCHAEDIGT" | "VERLOREN";

async function bibliothekar(): Promise<Sitzung> {
  return sitzungFuer(await legeNutzerAn(t.pg, "BIBLIOTHEKAR"));
}

async function anlegen(titleId: string, condition?: Zustand, sitzung?: Sitzung) {
  const eingabe = condition ? { titleId, condition } : { titleId };
  return erwarteOk(await exemplarAnlegen(t.kontext(sitzung ?? (await bibliothekar())), eingabe));
}

async function leseExemplar(copyId: string) {
  const { rows } = await t.pg.query<{ title_id: string; inventory_number: string; condition: string }>(
    "SELECT title_id, inventory_number, condition FROM copies WHERE id = $1",
    [copyId],
  );
  return rows[0];
}

const nummer = (inventarnummer: string) => Number(inventarnummer.slice(4));

async function verfuegbarImKatalog(titleId: string, titel: string): Promise<number> {
  const treffer = erwarteOk(await sucheKatalog(t.kontext(null), { q: titel })).treffer.find((x) => x.titleId === titleId);
  return treffer?.verfuegbareExemplare ?? -1;
}

async function verfuegbarAufDetailseite(titleId: string): Promise<number> {
  const { exemplare } = erwarteOk(await ladeTitelDetail(t.kontext(null), titleId));
  return exemplare.filter((e) => e.status === "VERFUEGBAR").length;
}

describe("E02-US02-FR01 Eindeutige Inventarnummer beim Anlegen", () => {
  it("AK-01.1 ein neues Exemplar bekommt automatisch eine Nummer INV- + sechs Ziffern und gehört zum Titel", async () => {
    const titleId = await legeTitelAn(t.pg);

    const { copyId, inventoryNumber } = await anlegen(titleId);
    expect(inventoryNumber).toMatch(/^INV-\d{6}$/);
    expect(await leseExemplar(copyId)).toMatchObject({ title_id: titleId, inventory_number: inventoryNumber });
  });

  it("AK-01.1 Nummern werden fortlaufend vergeben, auch über Titel hinweg", async () => {
    const a = await legeTitelAn(t.pg);
    const b = await legeTitelAn(t.pg);
    const sitzung = await bibliothekar();

    const erste = await anlegen(a, undefined, sitzung);
    const zweite = await anlegen(b, undefined, sitzung);
    const dritte = await anlegen(a, undefined, sitzung);
    expect(nummer(zweite.inventoryNumber)).toBe(nummer(erste.inventoryNumber) + 1);
    expect(nummer(dritte.inventoryNumber)).toBe(nummer(zweite.inventoryNumber) + 1);
  });

  it("AK-01.2 alle Exemplare haben unterschiedliche Inventarnummern", async () => {
    const sitzung = await bibliothekar();
    const titel = [await legeTitelAn(t.pg), await legeTitelAn(t.pg), await legeTitelAn(t.pg)];
    const nummern: string[] = [];
    for (let i = 0; i < 12; i++) nummern.push((await anlegen(titel[i % 3], undefined, sitzung)).inventoryNumber);

    expect(new Set(nummern).size).toBe(nummern.length);
  });

  it("AK-01.3 gleichzeitig angelegte Exemplare erhalten unterschiedliche Nummern", async () => {
    const titleId = await legeTitelAn(t.pg);
    const sitzung = await bibliothekar();

    const ergebnisse = await Promise.all(
      Array.from({ length: 10 }, () => exemplarAnlegen(t.kontext(sitzung), { titleId })),
    );
    const nummern = ergebnisse.map((e) => erwarteOk(e).inventoryNumber);
    expect(new Set(nummern).size).toBe(10);
    expect(await zaehle(t.pg, "SELECT count(DISTINCT inventory_number) AS n FROM copies")).toBe(10);
  });

  it("AK-01.3 die Datenbank verhindert doppelte Inventarnummern (eindeutiger Index)", async () => {
    const titleId = await legeTitelAn(t.pg);
    await legeExemplarAn(t.pg, titleId, { inventoryNumber: "INV-900500" });

    await expect(legeExemplarAn(t.pg, titleId, { inventoryNumber: "INV-900500" })).rejects.toThrow();
  });

  it("AK-01.4 eine mitgeschickte Inventarnummer wird ignoriert", async () => {
    const titleId = await legeTitelAn(t.pg);
    const eingabe = { titleId, inventoryNumber: "INV-999999" };

    const { copyId, inventoryNumber } = erwarteOk(await exemplarAnlegen(t.kontext(await bibliothekar()), eingabe));
    expect(inventoryNumber).not.toBe("INV-999999");
    expect((await leseExemplar(copyId)).inventory_number).toBe(inventoryNumber);
    expect(await zaehle(t.pg, "SELECT count(*) AS n FROM copies WHERE inventory_number = 'INV-999999'")).toBe(0);
  });

  it("AK-01.5 unbekannte Titel-ID: NICHT_GEFUNDEN, nichts angelegt", async () => {
    const sitzung = await bibliothekar();

    const ergebnis = await exemplarAnlegen(t.kontext(sitzung), { titleId: "00000000-0000-4000-8000-000000000000" });
    erwarteFehler(ergebnis, "NICHT_GEFUNDEN");
    expect(await zaehle(t.pg, "SELECT count(*) AS n FROM copies")).toBe(0);
  });

  it("AK-01.6 archivierter Titel: TITEL_ARCHIVIERT, nichts angelegt (OF-F04-2)", async () => {
    const titleId = await legeTitelAn(t.pg, { archiviert: true });
    const sitzung = await bibliothekar();
    const vorher = await momentaufnahme(t.pg);

    erwarteFehler(await exemplarAnlegen(t.kontext(sitzung), { titleId }), "TITEL_ARCHIVIERT");
    expect(await momentaufnahme(t.pg)).toBe(vorher);
  });

  it("AK-01.7 es gibt keine Funktion zum Löschen von Exemplaren (OF-F04-3)", () => {
    const namen = Object.keys(exemplarModul);
    expect(namen.filter((n) => /loesch|lösch|entfern|delete|remove/i.test(n))).toEqual([]);
  });

  it("AK-01.7 die Inventarnummer bleibt dem Exemplar dauerhaft zugeordnet, auch nach Zustandsänderungen", async () => {
    const titleId = await legeTitelAn(t.pg);
    const sitzung = await bibliothekar();
    const { copyId, inventoryNumber } = await anlegen(titleId, undefined, sitzung);

    erwarteOk(await exemplarZustandAendern(t.kontext(sitzung), { copyId, condition: "VERLOREN" }));
    erwarteOk(await exemplarZustandAendern(t.kontext(sitzung), { copyId, condition: "GUT" }));
    expect((await leseExemplar(copyId)).inventory_number).toBe(inventoryNumber);
  });
});

describe("E02-US02-FR02 Zustand gut, beschädigt, verloren; verloren ist nicht ausleihbar", () => {
  it("AK-02.1 ohne Angabe hat ein neues Exemplar den Zustand GUT", async () => {
    const titleId = await legeTitelAn(t.pg);

    const { copyId } = await anlegen(titleId);
    expect((await leseExemplar(copyId)).condition).toBe("GUT");
  });

  it.each(["GUT", "BESCHAEDIGT", "VERLOREN"] as const)("AK-02.1 ein Exemplar kann mit Zustand %s angelegt werden", async (zustand) => {
    const titleId = await legeTitelAn(t.pg);

    const { copyId } = await anlegen(titleId, zustand);
    expect((await leseExemplar(copyId)).condition).toBe(zustand);
  });

  it("AK-02.1 ein unbekannter Zustand beim Anlegen: VALIDIERUNG, nichts angelegt", async () => {
    const titleId = await legeTitelAn(t.pg);
    const sitzung = await bibliothekar();
    const eingabe = { titleId, condition: "KAPUTT" } as unknown as Parameters<typeof exemplarAnlegen>[1];

    const felder = erwarteFehler(await exemplarAnlegen(t.kontext(sitzung), eingabe), "VALIDIERUNG");
    expect(Object.keys(felder)).toContain("condition");
    expect(await zaehle(t.pg, "SELECT count(*) AS n FROM copies")).toBe(0);
  });

  it("AK-02.2 (Querverweis F-02) ein geänderter Zustand wird gespeichert und wirkt auf der Detailseite", async () => {
    const titleId = await legeTitelAn(t.pg);
    const sitzung = await bibliothekar();
    const { copyId } = await anlegen(titleId, undefined, sitzung);

    const daten = erwarteOk(await exemplarZustandAendern(t.kontext(sitzung), { copyId, condition: "VERLOREN" }));
    expect(daten).toMatchObject({ copyId, condition: "VERLOREN" });
    expect((await leseExemplar(copyId)).condition).toBe("VERLOREN");
    expect(erwarteOk(await ladeTitelDetail(t.kontext(null), titleId)).exemplare[0].status).toBe("GESPERRT");

    erwarteOk(await exemplarZustandAendern(t.kontext(sitzung), { copyId, condition: "BESCHAEDIGT" }));
    expect((await leseExemplar(copyId)).condition).toBe("BESCHAEDIGT");
    expect(erwarteOk(await ladeTitelDetail(t.kontext(null), titleId)).exemplare[0].status).toBe("VERFUEGBAR");
  });

  it.each(["KAPUTT", "", "verloren gegangen"])("AK-02.3 unbekannter Zustandswert „%s“: VALIDIERUNG, Zustand unverändert", async (wert) => {
    const titleId = await legeTitelAn(t.pg);
    const sitzung = await bibliothekar();
    const { copyId } = await anlegen(titleId, undefined, sitzung);
    const eingabe = { copyId, condition: wert } as unknown as Parameters<typeof exemplarZustandAendern>[1];

    const felder = erwarteFehler(await exemplarZustandAendern(t.kontext(sitzung), eingabe), "VALIDIERUNG");
    expect(Object.keys(felder)).toContain("condition");
    expect((await leseExemplar(copyId)).condition).toBe("GUT");
  });

  it("AK-02.3 unbekanntes Exemplar: NICHT_GEFUNDEN", async () => {
    const ergebnis = await exemplarZustandAendern(t.kontext(await bibliothekar()), {
      copyId: "00000000-0000-4000-8000-000000000000",
      condition: "VERLOREN",
    });

    erwarteFehler(ergebnis, "NICHT_GEFUNDEN");
  });

  it("AK-02.4 (Querverweis E03-US01-FR01, F-05) ein verlorenes Exemplar wird beim Ausleihen nicht gewählt: KEIN_EXEMPLAR_VERFUEGBAR", async () => {
    const titleId = await legeTitelAn(t.pg);
    const anderes = await legeNutzerAn(t.pg, "MITGLIED");
    const verliehen = await legeExemplarAn(t.pg, titleId);
    await legeAusleiheAn(t.pg, { copyId: verliehen.id, memberId: anderes.id, startDate: "2026-11-01", dueDate: "2026-11-29" });
    const sitzung = await bibliothekar();
    const { copyId } = await anlegen(titleId, undefined, sitzung);
    erwarteOk(await exemplarZustandAendern(t.kontext(sitzung), { copyId, condition: "VERLOREN" }));
    const mitglied = sitzungFuer(await legeNutzerAn(t.pg, "MITGLIED"));

    erwarteFehler(await ausleihen(t.kontext(mitglied), { titleId }), "KEIN_EXEMPLAR_VERFUEGBAR");
    expect(await zaehle(t.pg, "SELECT count(*) AS n FROM loans WHERE copy_id = $1", [copyId])).toBe(0);
  });

  it("AK-02.5 (Querverweis F-01, F-02) ein verlorenes Exemplar ist gesperrt und zählt nicht als verfügbar", async () => {
    const titleId = await legeTitelAn(t.pg, { title: "Mit Verlust" });
    const sitzung = await bibliothekar();
    await anlegen(titleId, "GUT", sitzung);
    const { copyId } = await anlegen(titleId, "GUT", sitzung);
    erwarteOk(await exemplarZustandAendern(t.kontext(sitzung), { copyId, condition: "VERLOREN" }));

    const { exemplare } = erwarteOk(await ladeTitelDetail(t.kontext(null), titleId));
    expect(exemplare.map((e) => e.status).sort()).toEqual(["GESPERRT", "VERFUEGBAR"]);
    expect(await verfuegbarImKatalog(titleId, "Mit Verlust")).toBe(1);
  });

  it("AK-02.6 (Querverweis F-01, F-05) ein beschädigtes Exemplar zählt als verfügbar und ist ausleihbar (OF-D2)", async () => {
    const titleId = await legeTitelAn(t.pg, { title: "Beschädigt" });
    const { copyId } = await anlegen(titleId, "BESCHAEDIGT");

    expect(await verfuegbarImKatalog(titleId, "Beschädigt")).toBe(1);
    const mitglied = sitzungFuer(await legeNutzerAn(t.pg, "MITGLIED"));
    const ausleihe = erwarteOk(await ausleihen(t.kontext(mitglied), { titleId }));
    expect((await leseAusleihe(t.pg, ausleihe.loanId))?.copy_id).toBe(copyId);
  });

  it("AK-02.7 ein ausgeliehenes Exemplar kann auf VERLOREN gesetzt werden; der Ausleihvorgang bleibt offen (OF-F04-1)", async () => {
    const titleId = await legeTitelAn(t.pg);
    const sitzung = await bibliothekar();
    const { copyId } = await anlegen(titleId, undefined, sitzung);
    const mitglied = await legeNutzerAn(t.pg, "MITGLIED");
    const loanId = await legeAusleiheAn(t.pg, { copyId, memberId: mitglied.id, startDate: "2026-11-01", dueDate: "2026-11-29" });
    const vorgangVorher = await leseAusleihe(t.pg, loanId);

    erwarteOk(await exemplarZustandAendern(t.kontext(sitzung), { copyId, condition: "VERLOREN" }));
    expect((await leseExemplar(copyId)).condition).toBe("VERLOREN");
    expect(await leseAusleihe(t.pg, loanId)).toEqual(vorgangVorher);
  });
});

describe("E02-US02-FR03 Anzahl verfügbarer Exemplare ergibt sich automatisch", () => {
  async function titelMitAllenLagen(titel: string) {
    const titleId = await legeTitelAn(t.pg, { title: titel });
    const mitglied = await legeNutzerAn(t.pg, "MITGLIED");
    const anderes = await legeNutzerAn(t.pg, "MITGLIED");
    await legeExemplarAn(t.pg, titleId); // verfügbar
    await legeExemplarAn(t.pg, titleId, { condition: "BESCHAEDIGT" }); // verfügbar
    const ausgeliehen = await legeExemplarAn(t.pg, titleId);
    const loanId = await legeAusleiheAn(t.pg, {
      copyId: ausgeliehen.id,
      memberId: mitglied.id,
      startDate: "2026-11-01",
      dueDate: "2026-11-29",
    });
    const vorgemerkt = await legeExemplarAn(t.pg, titleId);
    await legeVormerkungAn(t.pg, {
      titleId,
      memberId: anderes.id,
      status: "ABHOLBEREIT",
      createdAt: zeitpunkt("2026-11-02"),
      copyId: vorgemerkt.id,
      pickupDeadline: "2026-11-12",
    });
    await legeExemplarAn(t.pg, titleId, { condition: "VERLOREN" });
    return { titleId, loanId };
  }

  it("AK-03.1 (Querverweis F-01, F-02) gezählt werden nur Exemplare, die weder ausgeliehen, vorgemerkt noch gesperrt sind", async () => {
    const { titleId } = await titelMitAllenLagen("Alle Lagen");

    expect(await verfuegbarImKatalog(titleId, "Alle Lagen")).toBe(2);
    expect(await verfuegbarAufDetailseite(titleId)).toBe(2);
  });

  it("AK-03.2 nach Abschluss eines Ausleihvorgangs steigt die Anzahl um eins, ohne gepflegte Zahl", async () => {
    const { titleId, loanId } = await titelMitAllenLagen("Rückgabe");
    const vorher = await verfuegbarImKatalog(titleId, "Rückgabe");

    // nur der Ausleihvorgang wird abgeschlossen, keine Zahl wird geändert
    await t.pg.query("UPDATE loans SET returned_at = $2 WHERE id = $1", [loanId, zeitpunkt("2026-11-10")]);

    expect(await verfuegbarImKatalog(titleId, "Rückgabe")).toBe(vorher + 1);
    expect(await verfuegbarAufDetailseite(titleId)).toBe(vorher + 1);
  });

  it("AK-03.3 ein neues Exemplar im Zustand GUT erhöht die Anzahl um eins", async () => {
    const { titleId } = await titelMitAllenLagen("Zuwachs");
    const vorher = await verfuegbarImKatalog(titleId, "Zuwachs");

    await anlegen(titleId, "GUT");
    expect(await verfuegbarImKatalog(titleId, "Zuwachs")).toBe(vorher + 1);
  });

  it("AK-03.3 ein neues Exemplar im Zustand VERLOREN erhöht die Anzahl nicht", async () => {
    const { titleId } = await titelMitAllenLagen("Kein Zuwachs");
    const vorher = await verfuegbarImKatalog(titleId, "Kein Zuwachs");

    await anlegen(titleId, "VERLOREN");
    expect(await verfuegbarImKatalog(titleId, "Kein Zuwachs")).toBe(vorher);
  });

  it("AK-03.3 ein verlorenes Exemplar, das wieder auf GUT gesetzt wird, zählt wieder", async () => {
    const titleId = await legeTitelAn(t.pg, { title: "Wiedergefunden" });
    const sitzung = await bibliothekar();
    const { copyId } = await anlegen(titleId, "VERLOREN", sitzung);
    expect(await verfuegbarImKatalog(titleId, "Wiedergefunden")).toBe(0);

    erwarteOk(await exemplarZustandAendern(t.kontext(sitzung), { copyId, condition: "GUT" }));
    expect(await verfuegbarImKatalog(titleId, "Wiedergefunden")).toBe(1);
  });

  it("AK-03.4 (Querverweis E01-US01-FR03) Katalog und Detailseite zählen für jeden Titel gleich", async () => {
    await titelMitAllenLagen("Vergleich A");
    const b = await legeTitelAn(t.pg, { title: "Vergleich B" });
    await legeExemplarAn(t.pg, b, { condition: "VERLOREN" });
    await legeTitelAn(t.pg, { title: "Vergleich C" });
    const d = await legeTitelAn(t.pg, { title: "Vergleich D" });
    for (let i = 0; i < 3; i++) await legeExemplarAn(t.pg, d);

    const { treffer } = erwarteOk(await sucheKatalog(t.kontext(null), { q: "Vergleich" }));
    expect(treffer).toHaveLength(4);
    for (const x of treffer) {
      expect(x.verfuegbareExemplare, x.title).toBe(await verfuegbarAufDetailseite(x.titleId));
    }
  });
});
