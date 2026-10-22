// F-05 · E03-US01 · Verfügbares Exemplar ausleihen
// Spec: docs/specs/F-05_E03-US01.md · Testplan: docs/testing/F-05.md
import { describe, expect, it } from "vitest";
import { ausleihen } from "@/server/ausleihe";
import { sucheKatalog } from "@/server/katalog/suche";
import { ladeTitelDetail } from "@/server/katalog/detail";
import { momentaufnahme, nutzeTestDatenbank, zaehle, type Rolle, type Sitzung } from "../helpers/testdb";
import { erwarteFehler, erwarteOk } from "../helpers/ergebnis";
import { andererGueltigerWert, grenzen, standardWert } from "../helpers/konfiguration";
import { festeUhr, plusTage } from "../helpers/uhr";
import {
  leseAusleihe,
  leseAusleihenZuExemplar,
  legeAusleiheAn,
  legeExemplarAn,
  legeMahnungAn,
  legeNutzerAn,
  legeTitelAn,
  legeVormerkungAn,
  setzeEinstellung,
  sitzungFuer,
  zeitpunkt,
  type Nutzer,
} from "../helpers/daten";

const t = nutzeTestDatenbank();

const HEUTE = "2026-11-10";

async function mitglied(): Promise<Nutzer> {
  return legeNutzerAn(t.pg, "MITGLIED");
}

async function leiheAus(nutzer: Nutzer, titleId: string, heute = HEUTE) {
  return ausleihen(t.kontext(sitzungFuer(nutzer), festeUhr(heute)), { titleId });
}

async function offeneAusleihen(memberId?: string): Promise<number> {
  return memberId
    ? zaehle(t.pg, "SELECT count(*) AS n FROM loans WHERE returned_at IS NULL AND member_id = $1", [memberId])
    : zaehle(t.pg, "SELECT count(*) AS n FROM loans WHERE returned_at IS NULL");
}

/** Legt für das Mitglied `anzahl` offene Ausleihvorgänge bei anderen Titeln an. */
async function gibOffeneAusleihen(nutzer: Nutzer, anzahl: number): Promise<void> {
  for (let i = 0; i < anzahl; i++) {
    const titleId = await legeTitelAn(t.pg);
    const exemplar = await legeExemplarAn(t.pg, titleId);
    await legeAusleiheAn(t.pg, { copyId: exemplar.id, memberId: nutzer.id, startDate: "2026-11-01", dueDate: "2026-11-29" });
  }
}

/** Abgeschlossener Ausleihvorgang mit Mahnung (offen oder beglichen). */
async function gibMahnung(nutzer: Nutzer, beglichen: boolean): Promise<void> {
  const titleId = await legeTitelAn(t.pg);
  const exemplar = await legeExemplarAn(t.pg, titleId);
  const loanId = await legeAusleiheAn(t.pg, {
    copyId: exemplar.id,
    memberId: nutzer.id,
    startDate: "2026-09-01",
    dueDate: "2026-09-29",
    returnedAt: zeitpunkt("2026-10-05"),
  });
  const bibliothekar = beglichen ? await legeNutzerAn(t.pg, "BIBLIOTHEKAR") : null;
  await legeMahnungAn(t.pg, { loanId, createdOn: "2026-09-30", feeCents: 300, beglichenVon: bibliothekar?.id ?? null });
}

async function verfuegbar(titleId: string, titel: string) {
  const treffer = erwarteOk(await sucheKatalog(t.kontext(null), { q: titel })).treffer.find((x) => x.titleId === titleId);
  const { exemplare } = erwarteOk(await ladeTitelDetail(t.kontext(null), titleId));
  return { katalog: treffer?.verfuegbareExemplare, detail: exemplare.filter((e) => e.status === "VERFUEGBAR").length };
}

describe("E03-US01-FR01 System wählt ein verfügbares Exemplar und erzeugt den Ausleihvorgang", () => {
  it("AK-01.1 es entsteht genau ein offener Ausleihvorgang für ein vorher verfügbares Exemplar des Titels", async () => {
    const titleId = await legeTitelAn(t.pg);
    const exemplar = await legeExemplarAn(t.pg, titleId);
    const nutzer = await mitglied();

    const daten = erwarteOk(await leiheAus(nutzer, titleId));
    const vorgaenge = await leseAusleihenZuExemplar(t.pg, exemplar.id);
    expect(vorgaenge).toHaveLength(1);
    expect(vorgaenge[0]).toMatchObject({ id: daten.loanId, member_id: nutzer.id, returned_at: null, renewal_count: 0 });
    expect(await offeneAusleihen()).toBe(1);
  });

  it("AK-01.2 die Eingabe ist nur die Titel-ID; ein mitgeschicktes Exemplar wird ignoriert", async () => {
    const titleId = await legeTitelAn(t.pg);
    const kleinste = await legeExemplarAn(t.pg, titleId, { inventoryNumber: "INV-900001" });
    const gewuenscht = await legeExemplarAn(t.pg, titleId, { inventoryNumber: "INV-900002" });
    const nutzer = await mitglied();
    const eingabe = { titleId, copyId: gewuenscht.id, inventoryNumber: gewuenscht.inventoryNumber };

    const daten = erwarteOk(await ausleihen(t.kontext(sitzungFuer(nutzer), festeUhr(HEUTE)), eingabe));
    expect(daten.inventoryNumber).toBe(kleinste.inventoryNumber);
    expect((await leseAusleihe(t.pg, daten.loanId))?.copy_id).toBe(kleinste.id);
  });

  it("AK-01.3 das Startdatum ist heute (laut Uhr)", async () => {
    const titleId = await legeTitelAn(t.pg);
    await legeExemplarAn(t.pg, titleId);

    const daten = erwarteOk(await leiheAus(await mitglied(), titleId, "2026-12-03"));
    expect(daten.startDate).toBe("2026-12-03");
    expect((await leseAusleihe(t.pg, daten.loanId))?.start_date).toBe("2026-12-03");
  });

  it.each(["2026-11-10", "2026-12-20", "2027-02-27", "2027-03-25", "2027-10-28"])(
    "AK-01.4 Fälligkeit = Startdatum + leihfristTage Kalendertage (Start %s)",
    async (heute) => {
      const L = standardWert("leihfristTage");
      const titleId = await legeTitelAn(t.pg);
      await legeExemplarAn(t.pg, titleId);

      const daten = erwarteOk(await leiheAus(await mitglied(), titleId, heute));
      expect(daten.dueDate).toBe(plusTage(heute, L));
    },
  );

  it("AK-01.5 bei mehreren verfügbaren Exemplaren wird das mit der kleinsten Inventarnummer gewählt", async () => {
    const titleId = await legeTitelAn(t.pg);
    await legeExemplarAn(t.pg, titleId, { inventoryNumber: "INV-900030" });
    const kleinste = await legeExemplarAn(t.pg, titleId, { inventoryNumber: "INV-900010" });
    await legeExemplarAn(t.pg, titleId, { inventoryNumber: "INV-900020" });

    const daten = erwarteOk(await leiheAus(await mitglied(), titleId));
    expect(daten.inventoryNumber).toBe("INV-900010");
    expect((await leseAusleihe(t.pg, daten.loanId))?.copy_id).toBe(kleinste.id);
  });

  it("AK-01.5 nacheinander werden die Exemplare in Reihenfolge der Inventarnummer vergeben", async () => {
    const titleId = await legeTitelAn(t.pg);
    await legeExemplarAn(t.pg, titleId, { inventoryNumber: "INV-900002" });
    await legeExemplarAn(t.pg, titleId, { inventoryNumber: "INV-900001" });

    expect(erwarteOk(await leiheAus(await mitglied(), titleId)).inventoryNumber).toBe("INV-900001");
    expect(erwarteOk(await leiheAus(await mitglied(), titleId)).inventoryNumber).toBe("INV-900002");
    erwarteFehler(await leiheAus(await mitglied(), titleId), "KEIN_EXEMPLAR_VERFUEGBAR");
  });

  it("AK-01.6 ausgeliehene, vorgemerkte und verlorene Exemplare werden nicht gewählt", async () => {
    const titleId = await legeTitelAn(t.pg);
    const andere = await mitglied();
    const ausgeliehen = await legeExemplarAn(t.pg, titleId, { inventoryNumber: "INV-900001" });
    await legeAusleiheAn(t.pg, { copyId: ausgeliehen.id, memberId: andere.id, startDate: "2026-11-01", dueDate: "2026-11-29" });
    const vorgemerkt = await legeExemplarAn(t.pg, titleId, { inventoryNumber: "INV-900002" });
    await legeVormerkungAn(t.pg, {
      titleId,
      memberId: andere.id,
      status: "ABHOLBEREIT",
      createdAt: zeitpunkt("2026-11-02"),
      copyId: vorgemerkt.id,
      pickupDeadline: "2026-11-12",
    });
    await legeExemplarAn(t.pg, titleId, { inventoryNumber: "INV-900003", condition: "VERLOREN" });
    const frei = await legeExemplarAn(t.pg, titleId, { inventoryNumber: "INV-900004", condition: "BESCHAEDIGT" });

    const daten = erwarteOk(await leiheAus(await mitglied(), titleId));
    expect(daten.inventoryNumber).toBe(frei.inventoryNumber);
  });

  it("AK-01.7 kein Exemplar verfügbar: KEIN_EXEMPLAR_VERFUEGBAR, kein Ausleihvorgang", async () => {
    const titleId = await legeTitelAn(t.pg);
    const andere = await mitglied();
    const ausgeliehen = await legeExemplarAn(t.pg, titleId);
    await legeAusleiheAn(t.pg, { copyId: ausgeliehen.id, memberId: andere.id, startDate: "2026-11-01", dueDate: "2026-11-29" });
    await legeExemplarAn(t.pg, titleId, { condition: "VERLOREN" });
    const nutzer = await mitglied();
    const vorher = await momentaufnahme(t.pg);

    erwarteFehler(await leiheAus(nutzer, titleId), "KEIN_EXEMPLAR_VERFUEGBAR");
    expect(await momentaufnahme(t.pg)).toBe(vorher);
  });

  it("AK-01.7 Titel ohne Exemplare: KEIN_EXEMPLAR_VERFUEGBAR", async () => {
    const titleId = await legeTitelAn(t.pg);

    erwarteFehler(await leiheAus(await mitglied(), titleId), "KEIN_EXEMPLAR_VERFUEGBAR");
  });

  it("AK-01.8 bei Erfolg liefert das Ergebnis Inventarnummer, Startdatum und Fälligkeit", async () => {
    const titleId = await legeTitelAn(t.pg);
    const exemplar = await legeExemplarAn(t.pg, titleId);

    const daten = erwarteOk(await leiheAus(await mitglied(), titleId));
    expect(daten).toMatchObject({
      loanId: expect.any(String),
      inventoryNumber: exemplar.inventoryNumber,
      startDate: HEUTE,
      dueDate: plusTage(HEUTE, standardWert("leihfristTage")),
    });
  });
});

describe("E03-US01-FR02 Konfigurierbare Leihfrist", () => {
  it("AK-02.1 die Fälligkeit nutzt den gesetzten Wert L", async () => {
    const L = andererGueltigerWert("leihfristTage", standardWert("leihfristTage"));
    await setzeEinstellung(t.pg, "leihfristTage", L);
    const titleId = await legeTitelAn(t.pg);
    await legeExemplarAn(t.pg, titleId);

    expect(erwarteOk(await leiheAus(await mitglied(), titleId)).dueDate).toBe(plusTage(HEUTE, L));
  });

  it("AK-02.2 eine geänderte Leihfrist gilt für neue Ausleihen, bestehende bleiben unverändert (OF-F05-2)", async () => {
    const L = standardWert("leihfristTage");
    const L2 = andererGueltigerWert("leihfristTage", L);
    await setzeEinstellung(t.pg, "leihfristTage", L);
    const titleId = await legeTitelAn(t.pg);
    await legeExemplarAn(t.pg, titleId);
    await legeExemplarAn(t.pg, titleId);
    const erste = erwarteOk(await leiheAus(await mitglied(), titleId, HEUTE));

    await setzeEinstellung(t.pg, "leihfristTage", L2);
    const zweite = erwarteOk(await leiheAus(await mitglied(), titleId, "2026-11-11"));

    expect(zweite.dueDate).toBe(plusTage("2026-11-11", L2));
    expect((await leseAusleihe(t.pg, erste.loanId))?.due_date).toBe(plusTage(HEUTE, L));
  });

  it("AK-02.3 ohne Eintrag in system_settings gilt der Standard aus config/system.defaults.json", async () => {
    expect(await zaehle(t.pg, "SELECT count(*) AS n FROM system_settings")).toBe(0);
    const titleId = await legeTitelAn(t.pg);
    await legeExemplarAn(t.pg, titleId);

    expect(erwarteOk(await leiheAus(await mitglied(), titleId)).dueDate).toBe(plusTage(HEUTE, standardWert("leihfristTage")));
  });

  it("AK-02.4 (Querverweis E04-US01) die gespeicherte Fälligkeit due_date ist die gelieferte Fälligkeit", async () => {
    const titleId = await legeTitelAn(t.pg);
    await legeExemplarAn(t.pg, titleId);

    const daten = erwarteOk(await leiheAus(await mitglied(), titleId));
    expect((await leseAusleihe(t.pg, daten.loanId))?.due_date).toBe(daten.dueDate);
  });

  it("AK-02.5 kein fester Wert: die Fälligkeit folgt der kleinsten und der größten erlaubten Leihfrist", async () => {
    const { min, max } = grenzen("leihfristTage");
    const titleId = await legeTitelAn(t.pg);
    await legeExemplarAn(t.pg, titleId);
    await legeExemplarAn(t.pg, titleId);

    await setzeEinstellung(t.pg, "leihfristTage", min);
    expect(erwarteOk(await leiheAus(await mitglied(), titleId)).dueDate).toBe(plusTage(HEUTE, min));
    await setzeEinstellung(t.pg, "leihfristTage", max);
    expect(erwarteOk(await leiheAus(await mitglied(), titleId)).dueDate).toBe(plusTage(HEUTE, max));
  });
});

describe("E03-US01-FR03 Ausleihlimit und offene Mahnung", () => {
  async function titelMitExemplar(): Promise<string> {
    const titleId = await legeTitelAn(t.pg);
    await legeExemplarAn(t.pg, titleId);
    return titleId;
  }

  it("AK-03.1 mit N − 1 offenen Ausleihen gelingt die Ausleihe", async () => {
    const N = standardWert("ausleihlimitProMitglied");
    await setzeEinstellung(t.pg, "ausleihlimitProMitglied", N);
    const nutzer = await mitglied();
    await gibOffeneAusleihen(nutzer, N - 1);

    erwarteOk(await leiheAus(nutzer, await titelMitExemplar()));
    expect(await offeneAusleihen(nutzer.id)).toBe(N);
  });

  it("AK-03.2 mit N offenen Ausleihen: AUSLEIHLIMIT_ERREICHT, kein Ausleihvorgang", async () => {
    const N = standardWert("ausleihlimitProMitglied");
    await setzeEinstellung(t.pg, "ausleihlimitProMitglied", N);
    const nutzer = await mitglied();
    await gibOffeneAusleihen(nutzer, N);
    const titleId = await titelMitExemplar();
    const vorher = await momentaufnahme(t.pg);

    erwarteFehler(await leiheAus(nutzer, titleId), "AUSLEIHLIMIT_ERREICHT");
    expect(await momentaufnahme(t.pg)).toBe(vorher);
  });

  it("AK-03.2 das Limit folgt dem gesetzten Wert (anderer gültiger Wert)", async () => {
    const N = andererGueltigerWert("ausleihlimitProMitglied", standardWert("ausleihlimitProMitglied"));
    await setzeEinstellung(t.pg, "ausleihlimitProMitglied", N);
    const nutzer = await mitglied();
    await gibOffeneAusleihen(nutzer, N - 1);

    erwarteOk(await leiheAus(nutzer, await titelMitExemplar()));
    erwarteFehler(await leiheAus(nutzer, await titelMitExemplar()), "AUSLEIHLIMIT_ERREICHT");
  });

  it("AK-03.3 abgeschlossene Ausleihvorgänge zählen nicht zum Limit", async () => {
    const N = standardWert("ausleihlimitProMitglied");
    await setzeEinstellung(t.pg, "ausleihlimitProMitglied", N);
    const nutzer = await mitglied();
    await gibOffeneAusleihen(nutzer, N - 1);
    for (let i = 0; i < N; i++) {
      const titleId = await legeTitelAn(t.pg);
      const exemplar = await legeExemplarAn(t.pg, titleId);
      await legeAusleiheAn(t.pg, {
        copyId: exemplar.id,
        memberId: nutzer.id,
        startDate: "2026-10-01",
        dueDate: "2026-10-29",
        returnedAt: zeitpunkt("2026-10-15"),
      });
    }

    erwarteOk(await leiheAus(nutzer, await titelMitExemplar()));
  });

  it("AK-03.4 Ausleihen anderer Mitglieder zählen nicht zum Limit", async () => {
    const N = standardWert("ausleihlimitProMitglied");
    await setzeEinstellung(t.pg, "ausleihlimitProMitglied", N);
    const andere = await mitglied();
    await gibOffeneAusleihen(andere, N);
    const nutzer = await mitglied();
    await gibOffeneAusleihen(nutzer, N - 1);

    erwarteOk(await leiheAus(nutzer, await titelMitExemplar()));
  });

  it("AK-03.5 (Querverweis E04-US02-FR03) offene Mahnung: OFFENE_MAHNUNG, kein Ausleihvorgang", async () => {
    const nutzer = await mitglied();
    await gibMahnung(nutzer, false);
    const titleId = await titelMitExemplar();
    const vorher = await momentaufnahme(t.pg);

    erwarteFehler(await leiheAus(nutzer, titleId), "OFFENE_MAHNUNG");
    expect(await momentaufnahme(t.pg)).toBe(vorher);
  });

  it("AK-03.5 auch eine offene Mahnung zu einem noch offenen Ausleihvorgang sperrt", async () => {
    const nutzer = await mitglied();
    const alt = await legeTitelAn(t.pg);
    const exemplar = await legeExemplarAn(t.pg, alt);
    const loanId = await legeAusleiheAn(t.pg, { copyId: exemplar.id, memberId: nutzer.id, startDate: "2026-09-01", dueDate: "2026-09-29" });
    await legeMahnungAn(t.pg, { loanId, createdOn: "2026-09-30" });

    erwarteFehler(await leiheAus(nutzer, await titelMitExemplar()), "OFFENE_MAHNUNG");
  });

  it("AK-03.5 eine offene Mahnung eines anderen Mitglieds sperrt nicht", async () => {
    await gibMahnung(await mitglied(), false);

    erwarteOk(await leiheAus(await mitglied(), await titelMitExemplar()));
  });

  it("AK-03.6 ein überfälliger Vorgang ohne Mahnung sperrt nicht (OF-F05-4)", async () => {
    const nutzer = await mitglied();
    const alt = await legeTitelAn(t.pg);
    const exemplar = await legeExemplarAn(t.pg, alt);
    await legeAusleiheAn(t.pg, { copyId: exemplar.id, memberId: nutzer.id, startDate: "2026-09-01", dueDate: "2026-09-29" });

    erwarteOk(await leiheAus(nutzer, await titelMitExemplar(), HEUTE));
  });

  it("AK-03.7 (Querverweis E04-US02-FR03) eine beglichene Mahnung sperrt nicht mehr", async () => {
    const nutzer = await mitglied();
    await gibMahnung(nutzer, true);

    erwarteOk(await leiheAus(nutzer, await titelMitExemplar()));
  });
});

describe("E03-US01-FR04 Zahl verfügbarer Exemplare sinkt um eins", () => {
  it("AK-04.1 (Querverweis E02-US02-FR03, F-01, F-02) nach der Ausleihe k − 1 verfügbare Exemplare in Katalog und Detailseite", async () => {
    const titleId = await legeTitelAn(t.pg, { title: "Drei Stück" });
    for (let i = 0; i < 3; i++) await legeExemplarAn(t.pg, titleId);
    const vorher = await verfuegbar(titleId, "Drei Stück");
    expect(vorher).toEqual({ katalog: 3, detail: 3 });

    erwarteOk(await leiheAus(await mitglied(), titleId));
    expect(await verfuegbar(titleId, "Drei Stück")).toEqual({ katalog: 2, detail: 2 });
  });

  it("AK-04.2 (Querverweis F-01, F-02) bei abgelehnter Ausleihe bleibt die Anzahl unverändert", async () => {
    const titleId = await legeTitelAn(t.pg, { title: "Bleibt" });
    for (let i = 0; i < 2; i++) await legeExemplarAn(t.pg, titleId);
    const gesperrt = await mitglied();
    await gibMahnung(gesperrt, false);
    const amLimit = await mitglied();
    await gibOffeneAusleihen(amLimit, standardWert("ausleihlimitProMitglied"));
    const vorher = await verfuegbar(titleId, "Bleibt");

    erwarteFehler(await leiheAus(gesperrt, titleId), "OFFENE_MAHNUNG");
    erwarteFehler(await leiheAus(amLimit, titleId), "AUSLEIHLIMIT_ERREICHT");
    expect(await verfuegbar(titleId, "Bleibt")).toEqual(vorher);
  });
});

describe("E03-US01-FR01 Zusätzlich aus Querverweisen und NFRs", () => {
  it("AK-05.1 (E06-US01-FR02, NFR03) Gast: NICHT_ANGEMELDET, kein Ausleihvorgang", async () => {
    const titleId = await legeTitelAn(t.pg);
    await legeExemplarAn(t.pg, titleId);
    const vorher = await momentaufnahme(t.pg);

    erwarteFehler(await ausleihen(t.kontext(null), { titleId }), "NICHT_ANGEMELDET");
    expect(await momentaufnahme(t.pg)).toBe(vorher);
  });

  it("AK-05.2 (NFR06) zwei Mitglieder leihen gleichzeitig das letzte Exemplar: genau ein Vorgang, die andere Anfrage KEIN_EXEMPLAR_VERFUEGBAR", async () => {
    const titleId = await legeTitelAn(t.pg);
    const exemplar = await legeExemplarAn(t.pg, titleId);
    const a = await mitglied();
    const b = await mitglied();

    const ergebnisse = await Promise.all([leiheAus(a, titleId), leiheAus(b, titleId)]);
    const erfolge = ergebnisse.filter((e) => e.ok);
    const fehler = ergebnisse.filter((e) => !e.ok);
    expect(erfolge).toHaveLength(1);
    expect(fehler).toHaveLength(1);
    erwarteFehler(fehler[0], "KEIN_EXEMPLAR_VERFUEGBAR");
    expect((await leseAusleihenZuExemplar(t.pg, exemplar.id)).filter((v) => v.returned_at === null)).toHaveLength(1);
  });

  it("AK-05.2 (NFR06) viele gleichzeitige Anfragen auf zwei Exemplare: genau zwei Vorgänge", async () => {
    const titleId = await legeTitelAn(t.pg);
    await legeExemplarAn(t.pg, titleId);
    await legeExemplarAn(t.pg, titleId);
    const nutzer = await Promise.all(Array.from({ length: 6 }, () => mitglied()));

    const ergebnisse = await Promise.all(nutzer.map((n) => leiheAus(n, titleId)));
    expect(ergebnisse.filter((e) => e.ok)).toHaveLength(2);
    for (const e of ergebnisse.filter((x) => !x.ok)) erwarteFehler(e, "KEIN_EXEMPLAR_VERFUEGBAR");
    expect(await offeneAusleihen()).toBe(2);
  });

  it("AK-05.3 (NFR06) die Datenbank verhindert einen zweiten offenen Ausleihvorgang zum selben Exemplar", async () => {
    const titleId = await legeTitelAn(t.pg);
    const exemplar = await legeExemplarAn(t.pg, titleId);
    const a = await mitglied();
    const b = await mitglied();
    await legeAusleiheAn(t.pg, { copyId: exemplar.id, memberId: a.id, startDate: "2026-11-01", dueDate: "2026-11-29" });

    await expect(
      legeAusleiheAn(t.pg, { copyId: exemplar.id, memberId: b.id, startDate: "2026-11-02", dueDate: "2026-11-30" }),
    ).rejects.toThrow();
  });

  it("AK-05.3 (NFR06) abgeschlossene Vorgänge zum selben Exemplar sind erlaubt", async () => {
    const titleId = await legeTitelAn(t.pg);
    const exemplar = await legeExemplarAn(t.pg, titleId);
    const a = await mitglied();
    await legeAusleiheAn(t.pg, {
      copyId: exemplar.id,
      memberId: a.id,
      startDate: "2026-10-01",
      dueDate: "2026-10-29",
      returnedAt: zeitpunkt("2026-10-10"),
    });
    await legeAusleiheAn(t.pg, {
      copyId: exemplar.id,
      memberId: a.id,
      startDate: "2026-10-11",
      dueDate: "2026-11-08",
      returnedAt: zeitpunkt("2026-10-20"),
    });

    erwarteOk(await leiheAus(await mitglied(), titleId));
    expect(await leseAusleihenZuExemplar(t.pg, exemplar.id)).toHaveLength(3);
  });

  it.each(["BIBLIOTHEKAR", "ADMINISTRATOR"] as const)("AK-05.4 %s: KEINE_BERECHTIGUNG, kein Ausleihvorgang (OF-R1)", async (rolle) => {
    const titleId = await legeTitelAn(t.pg);
    await legeExemplarAn(t.pg, titleId);
    const nutzer = await legeNutzerAn(t.pg, rolle);
    const vorher = await momentaufnahme(t.pg);

    erwarteFehler(await ausleihen(t.kontext(sitzungFuer(nutzer)), { titleId }), "KEINE_BERECHTIGUNG");
    expect(await momentaufnahme(t.pg)).toBe(vorher);
  });

  it("AK-05.5 archivierter Titel: NICHT_GEFUNDEN, kein Ausleihvorgang (OF-D4)", async () => {
    const titleId = await legeTitelAn(t.pg, { archiviert: true });
    await legeExemplarAn(t.pg, titleId);

    erwarteFehler(await leiheAus(await mitglied(), titleId), "NICHT_GEFUNDEN");
    expect(await offeneAusleihen()).toBe(0);
  });

  it("AK-05.5 unbekannter Titel: NICHT_GEFUNDEN", async () => {
    erwarteFehler(await leiheAus(await mitglied(), "00000000-0000-4000-8000-000000000000"), "NICHT_GEFUNDEN");
  });

  it("AK-05.6 (OF-S1) offene Mahnung kommt vor Ausleihlimit und fehlendem Exemplar", async () => {
    const nutzer = await mitglied();
    await gibMahnung(nutzer, false);
    await gibOffeneAusleihen(nutzer, standardWert("ausleihlimitProMitglied"));
    const titleId = await legeTitelAn(t.pg); // ohne Exemplar

    erwarteFehler(await leiheAus(nutzer, titleId), "OFFENE_MAHNUNG");
  });

  it("AK-05.6 (OF-S1) Ausleihlimit kommt vor fehlendem Exemplar", async () => {
    const nutzer = await mitglied();
    await gibOffeneAusleihen(nutzer, standardWert("ausleihlimitProMitglied"));
    const titleId = await legeTitelAn(t.pg); // ohne Exemplar

    erwarteFehler(await leiheAus(nutzer, titleId), "AUSLEIHLIMIT_ERREICHT");
  });

  it("AK-05.6 (OF-S1) Titel existiert/aktiv kommt vor offener Mahnung", async () => {
    const nutzer = await mitglied();
    await gibMahnung(nutzer, false);
    const titleId = await legeTitelAn(t.pg, { archiviert: true });

    erwarteFehler(await leiheAus(nutzer, titleId), "NICHT_GEFUNDEN");
  });

  it("AK-05.6 (OF-S1) Rolle kommt vor Titelprüfung", async () => {
    const bibliothekar = await legeNutzerAn(t.pg, "BIBLIOTHEKAR");

    const ergebnis = await ausleihen(t.kontext(sitzungFuer(bibliothekar)), { titleId: "00000000-0000-4000-8000-000000000000" });
    erwarteFehler(ergebnis, "KEINE_BERECHTIGUNG");
  });

  it("AK-05.7 derselbe Titel darf mehrfach gleichzeitig ausgeliehen werden (OF-F05-5)", async () => {
    const titleId = await legeTitelAn(t.pg);
    await legeExemplarAn(t.pg, titleId);
    await legeExemplarAn(t.pg, titleId);
    const nutzer = await mitglied();

    const erste = erwarteOk(await leiheAus(nutzer, titleId));
    const zweite = erwarteOk(await leiheAus(nutzer, titleId));
    expect(zweite.inventoryNumber).not.toBe(erste.inventoryNumber);
    expect(await offeneAusleihen(nutzer.id)).toBe(2);
  });

  it("AK-05.8 die Mitglieds-ID kommt aus der Sitzung, auch wenn die Anfrage eine andere enthält", async () => {
    const titleId = await legeTitelAn(t.pg);
    await legeExemplarAn(t.pg, titleId);
    const angemeldet = await mitglied();
    const fremd = await mitglied();
    const eingabe = { titleId, memberId: fremd.id, userId: fremd.id };
    const sitzung: Sitzung = sitzungFuer(angemeldet);

    const daten = erwarteOk(await ausleihen(t.kontext(sitzung, festeUhr(HEUTE)), eingabe));
    expect((await leseAusleihe(t.pg, daten.loanId))?.member_id).toBe(angemeldet.id);
    expect(await offeneAusleihen(fremd.id)).toBe(0);
  });

  it("AK-05.8 eine Rolle in der Anfrage wird ignoriert", async () => {
    const titleId = await legeTitelAn(t.pg);
    await legeExemplarAn(t.pg, titleId);
    const bibliothekar = await legeNutzerAn(t.pg, "BIBLIOTHEKAR");
    const eingabe = { titleId, role: "MITGLIED" as Rolle };

    erwarteFehler(await ausleihen(t.kontext(sitzungFuer(bibliothekar)), eingabe), "KEINE_BERECHTIGUNG");
    expect(await offeneAusleihen()).toBe(0);
  });
});
