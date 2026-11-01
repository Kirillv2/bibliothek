// F-09 · E04-US02 · Mahnungen und Gebühren verwalten
// Spec: docs/specs/F-09_E04-US02.md · Testplan: docs/testing/F-09.md
import { describe, expect, it } from "vitest";
import { ladeMahnungen, ladeMeineMahnungen, mahnungBegleichen } from "@/server/mahnungen";
import { fristpruefung } from "@/server/jobs/fristpruefung";
import { ausleihen } from "@/server/ausleihe";
import { verlaengern } from "@/server/verlaengerung";
import { rueckgabeErfassen } from "@/server/rueckgabe";
import { momentaufnahme, nutzeTestDatenbank, zaehle } from "../helpers/testdb";
import { erwarteFehler, erwarteOk } from "../helpers/ergebnis";
import { andererGueltigerWert, gebuehrCents, standardWert } from "../helpers/konfiguration";
import { festeUhr, plusTage, tageZwischen } from "../helpers/uhr";
import {
  leseBenachrichtigungen,
  leseMahnungen,
  legeAusleiheAn,
  legeExemplarAn,
  legeMahnungAn,
  legeNutzerAn,
  legeTitelAn,
  setzeEinstellung,
  sitzungFuer,
  type Nutzer,
} from "../helpers/daten";

const t = nutzeTestDatenbank();

const HEUTE = "2026-11-10";

type Vorgang = { loanId: string; titleId: string; inventoryNumber: string; mitglied: Nutzer; dueDate: string };

async function vorgang(dueDate: string, optionen: { mitglied?: Nutzer; title?: string } = {}): Promise<Vorgang> {
  const titleId = await legeTitelAn(t.pg, { title: optionen.title });
  const exemplar = await legeExemplarAn(t.pg, titleId);
  const mitglied = optionen.mitglied ?? (await legeNutzerAn(t.pg, "MITGLIED"));
  const loanId = await legeAusleiheAn(t.pg, {
    copyId: exemplar.id,
    memberId: mitglied.id,
    startDate: plusTage(dueDate, -standardWert("leihfristTage")),
    dueDate,
  });
  return { loanId, titleId, inventoryNumber: exemplar.inventoryNumber, mitglied, dueDate };
}

async function lauf(stichtag = HEUTE) {
  return erwarteOk(await fristpruefung(t.kontext(null, festeUhr(stichtag, "02:00"))));
}

async function bibliothekar(): Promise<Nutzer> {
  return legeNutzerAn(t.pg, "BIBLIOTHEKAR");
}

async function zurueck(v: Vorgang, tag: string) {
  return erwarteOk(
    await rueckgabeErfassen(t.kontext(sitzungFuer(await bibliothekar()), festeUhr(tag, "10:00")), {
      inventoryNumber: v.inventoryNumber,
    }),
  );
}

async function liste(tag = HEUTE, nurOffene?: boolean) {
  return erwarteOk(await ladeMahnungen(t.kontext(sitzungFuer(await bibliothekar()), festeUhr(tag)), nurOffene ? { nurOffene } : {}));
}

async function begleiche(dunningId: string, tag = HEUTE, bib?: Nutzer) {
  return mahnungBegleichen(t.kontext(sitzungFuer(bib ?? (await bibliothekar())), festeUhr(tag, "11:00")), { dunningId });
}

async function mahnungsId(loanId: string): Promise<string> {
  const [m] = await leseMahnungen(t.pg, loanId);
  if (!m) throw new Error("keine Mahnung");
  return m.id;
}

async function andererTitelVerfuegbar(): Promise<string> {
  const titleId = await legeTitelAn(t.pg);
  await legeExemplarAn(t.pg, titleId);
  return titleId;
}

describe("E04-US02-FR01 Für jeden überfälligen Vorgang eine Mahnung mit Datum und betroffenem Exemplar", () => {
  it("AK-01.1 (Querverweis E04-US01-FR03) der Job erzeugt genau eine Mahnung mit Datum = Stichtag; Exemplar über den Vorgang", async () => {
    const v = await vorgang(plusTage(HEUTE, -3), { title: "Überfällige Geschichten" });
    await lauf();

    const mahnungen = await leseMahnungen(t.pg, v.loanId);
    expect(mahnungen).toHaveLength(1);
    expect(mahnungen[0]).toMatchObject({ created_on: HEUTE, settled_at: null });
    const [eintrag] = await liste();
    expect(eintrag).toMatchObject({
      loanId: v.loanId,
      createdOn: HEUTE,
      title: "Überfällige Geschichten",
      inventoryNumber: v.inventoryNumber,
      dueDate: v.dueDate,
    });
  });

  it("AK-01.2 (NFR04) weitere Läufe und eine zweite Überschreitung ergeben keine zweite Mahnung; das Datum bleibt", async () => {
    const v = await vorgang("2026-11-05");
    await lauf("2026-11-06");
    await lauf("2026-11-07");
    const neu = erwarteOk(await verlaengern(t.kontext(sitzungFuer(v.mitglied), festeUhr("2026-11-08")), { loanId: v.loanId }));
    await lauf(plusTage(neu.dueDate, 3));

    const mahnungen = await leseMahnungen(t.pg, v.loanId);
    expect(mahnungen).toHaveLength(1);
    expect(mahnungen[0].created_on).toBe("2026-11-06");
  });

  it("AK-01.3 nicht überfällige und abgeschlossene Vorgänge bekommen durch den Job keine Mahnung", async () => {
    const faelligHeute = await vorgang(HEUTE);
    const spaeter = await vorgang(plusTage(HEUTE, 4));
    const zurueckgegeben = await vorgang(plusTage(HEUTE, -10));
    await zurueck(zurueckgegeben, plusTage(HEUTE, -10));
    await lauf();

    expect(await leseMahnungen(t.pg, faelligHeute.loanId)).toHaveLength(0);
    expect(await leseMahnungen(t.pg, spaeter.loanId)).toHaveLength(0);
    expect(await leseMahnungen(t.pg, zurueckgegeben.loanId)).toHaveLength(0);
  });

  it("AK-01.4 (Glossar 1.4, OF-F09-4) Mahnung vom Job: das Mitglied erhält genau eine Benachrichtigung MAHNUNG", async () => {
    const v = await vorgang(plusTage(HEUTE, -2));
    await lauf();
    await lauf(plusTage(HEUTE, 1));
    const mahnungen = (await leseBenachrichtigungen(t.pg, v.mitglied.id)).filter((b) => b.type === "MAHNUNG");
    expect(mahnungen).toHaveLength(1);
    expect(mahnungen[0].loan_id).toBe(v.loanId);
  });

  it("AK-01.4 (Querverweis F-06) Mahnung bei verspäteter Verlängerung: Benachrichtigung MAHNUNG", async () => {
    const v = await vorgang(plusTage(HEUTE, -2));
    erwarteOk(await verlaengern(t.kontext(sitzungFuer(v.mitglied), festeUhr(HEUTE)), { loanId: v.loanId }));
    const mahnungen = (await leseBenachrichtigungen(t.pg, v.mitglied.id)).filter((b) => b.type === "MAHNUNG");
    expect(mahnungen).toHaveLength(1);
  });

  it("AK-01.4 (Querverweis F-07) Mahnung bei verspäteter Rückgabe: Benachrichtigung MAHNUNG", async () => {
    const v = await vorgang(plusTage(HEUTE, -2));
    await zurueck(v, HEUTE);
    const mahnungen = (await leseBenachrichtigungen(t.pg, v.mitglied.id)).filter((b) => b.type === "MAHNUNG");
    expect(mahnungen).toHaveLength(1);
  });

  it("AK-01.4 Mahnung vom Job, danach verspätete Rückgabe: weiterhin nur eine Benachrichtigung MAHNUNG", async () => {
    const v = await vorgang(plusTage(HEUTE, -2));
    await lauf();
    await zurueck(v, HEUTE);
    expect((await leseBenachrichtigungen(t.pg, v.mitglied.id)).filter((b) => b.type === "MAHNUNG")).toHaveLength(1);
  });

  it("AK-01.5 Liste für den Bibliothekar: alle Felder, offene zuerst, älteste zuerst; Filter nur offene", async () => {
    const bib = await bibliothekar();
    const a = await vorgang("2026-11-01");
    const b = await vorgang("2026-11-03");
    const c = await vorgang("2026-10-20");
    await legeMahnungAn(t.pg, { loanId: a.loanId, createdOn: "2026-11-02" });
    await legeMahnungAn(t.pg, { loanId: b.loanId, createdOn: "2026-11-04" });
    await zurueck(c, "2026-10-25");
    erwarteOk(await begleiche(await mahnungsId(c.loanId), "2026-10-26", bib));

    const alle = await liste();
    expect(alle.map((m) => m.loanId)).toEqual([a.loanId, b.loanId, c.loanId]);
    expect(alle.map((m) => m.beglichen)).toEqual([false, false, true]);
    expect(alle[0]).toMatchObject({ mitgliedEmail: a.mitglied.email, ueberschritteneTage: tageZwischen("2026-11-01", HEUTE) });

    const offen = await liste(HEUTE, true);
    expect(offen.map((m) => m.loanId)).toEqual([a.loanId, b.loanId]);
  });
});

describe("E04-US02-FR02 Gebühr = überschrittene Tage × konfigurierbarer Tagessatz", () => {
  it("AK-02.1 laufende Überschreitung: k Tage und Gebühr k × T", async () => {
    const T = standardWert("mahnTagessatzEuro");
    const v = await vorgang(plusTage(HEUTE, -4));
    await lauf();
    const [m] = await liste();
    expect(m).toMatchObject({ loanId: v.loanId, ueberschritteneTage: 4, gebuehrCents: gebuehrCents(4, T) });
  });

  it("AK-02.2 die angezeigte Gebühr wächst täglich, solange die Überschreitung läuft", async () => {
    const T = standardWert("mahnTagessatzEuro");
    await vorgang(plusTage(HEUTE, -4));
    await lauf();
    const [morgen] = await liste(plusTage(HEUTE, 1));
    expect(morgen).toMatchObject({ ueberschritteneTage: 5, gebuehrCents: gebuehrCents(5, T) });
  });

  it("AK-02.3 (Querverweis E03-US03-FR02) nach der Rückgabe steht die Gebühr fest", async () => {
    const T = standardWert("mahnTagessatzEuro");
    const v = await vorgang(plusTage(HEUTE, -4));
    await lauf();
    await zurueck(v, HEUTE);
    const [spaeter] = await liste(plusTage(HEUTE, 10));
    expect(spaeter.gebuehrCents).toBe(gebuehrCents(4, T));
    expect((await leseMahnungen(t.pg, v.loanId))[0].fee_cents).toBe(gebuehrCents(4, T));
  });

  it("AK-02.4 (OF-F09-1) nach verspäteter Verlängerung zählen frühere und laufende Überschreitung zusammen", async () => {
    const T = standardWert("mahnTagessatzEuro");
    const v = await vorgang("2026-11-05");
    await lauf("2026-11-07");
    const neu = erwarteOk(await verlaengern(t.kontext(sitzungFuer(v.mitglied), festeUhr("2026-11-08")), { loanId: v.loanId }));
    const tag = plusTage(neu.dueDate, 2);
    await lauf(tag);

    const [m] = await liste(tag);
    expect(m.gebuehrCents).toBe(gebuehrCents(3, T) + gebuehrCents(2, T));
  });

  it("AK-02.5 (Querverweis E06-US02-FR02) ein anderer Tagessatz gilt für neu abgerechnete Tage; Festgehaltenes bleibt", async () => {
    const T = standardWert("mahnTagessatzEuro");
    const T2 = andererGueltigerWert("mahnTagessatzEuro", T);
    const fest = await vorgang(plusTage(HEUTE, -3));
    await zurueck(fest, HEUTE);
    await setzeEinstellung(t.pg, "mahnTagessatzEuro", T2);
    const laufend = await vorgang(plusTage(HEUTE, -2));
    await lauf();

    const alle = await liste();
    expect(alle.find((m) => m.loanId === fest.loanId)?.gebuehrCents).toBe(gebuehrCents(3, T));
    expect(alle.find((m) => m.loanId === laufend.loanId)?.gebuehrCents).toBe(gebuehrCents(2, T2));
  });

  it("AK-02.6 (OF-R4) das Mitglied sieht eigene Mahnungen mit Datum, Titel, Inventarnummer, Gebühr, Status; keine fremden", async () => {
    const T = standardWert("mahnTagessatzEuro");
    const v = await vorgang(plusTage(HEUTE, -2), { title: "Meine späte Rückgabe" });
    const fremd = await vorgang(plusTage(HEUTE, -2));
    await lauf();

    const meine = erwarteOk(await ladeMeineMahnungen(t.kontext(sitzungFuer(v.mitglied), festeUhr(HEUTE))));
    expect(meine).toHaveLength(1);
    expect(meine[0]).toMatchObject({
      createdOn: HEUTE,
      title: "Meine späte Rückgabe",
      inventoryNumber: v.inventoryNumber,
      gebuehrCents: gebuehrCents(2, T),
      beglichen: false,
    });
    expect(JSON.stringify(meine)).not.toContain(fremd.inventoryNumber);
    expect(JSON.stringify(meine)).not.toContain(v.mitglied.email);
  });
});

describe("E04-US02-FR03 Offene Mahnung sperrt Ausleihen, bis sie als beglichen markiert wird", () => {
  it("AK-03.1 (Querverweis E03-US01-FR03) offene Mahnung → OFFENE_MAHNUNG, kein Vorgang", async () => {
    const v = await vorgang(plusTage(HEUTE, -1));
    await lauf();
    const titleId = await andererTitelVerfuegbar();
    erwarteFehler(await ausleihen(t.kontext(sitzungFuer(v.mitglied)), { titleId }), "OFFENE_MAHNUNG");
    expect(await zaehle(t.pg, "SELECT count(*) AS n FROM loans WHERE member_id = $1", [v.mitglied.id])).toBe(1);
  });

  it("AK-03.2 nach Rückgabe beglichen: Zeitpunkt und Bibliothekar gespeichert, Mitglied kann wieder ausleihen", async () => {
    const v = await vorgang(plusTage(HEUTE, -3));
    await lauf();
    await zurueck(v, HEUTE);
    const bib = await bibliothekar();

    const daten = erwarteOk(await begleiche(await mahnungsId(v.loanId), HEUTE, bib));
    expect(daten).toMatchObject({ gebuehrCents: gebuehrCents(3, standardWert("mahnTagessatzEuro")) });
    const { rows } = await t.pg.query<{ settled_at: Date | null; settled_by_id: string | null }>(
      "SELECT settled_at, settled_by_id FROM dunnings WHERE loan_id = $1",
      [v.loanId],
    );
    expect(rows[0].settled_at).not.toBeNull();
    expect(rows[0].settled_by_id).toBe(bib.id);

    const titleId = await andererTitelVerfuegbar();
    erwarteOk(await ausleihen(t.kontext(sitzungFuer(v.mitglied)), { titleId }));
  });

  it("AK-03.3 mehrere offene Mahnungen: erst wenn alle beglichen sind, ist Ausleihen wieder möglich", async () => {
    const mitglied = await legeNutzerAn(t.pg, "MITGLIED");
    const a = await vorgang(plusTage(HEUTE, -3), { mitglied });
    const b = await vorgang(plusTage(HEUTE, -2), { mitglied });
    await lauf();
    await zurueck(a, HEUTE);
    await zurueck(b, HEUTE);
    const titleId = await andererTitelVerfuegbar();

    erwarteOk(await begleiche(await mahnungsId(a.loanId)));
    erwarteFehler(await ausleihen(t.kontext(sitzungFuer(mitglied)), { titleId }), "OFFENE_MAHNUNG");
    erwarteOk(await begleiche(await mahnungsId(b.loanId)));
    erwarteOk(await ausleihen(t.kontext(sitzungFuer(mitglied)), { titleId }));
  });

  it("AK-03.4 (OF-F09-2) solange die Überschreitung läuft, kann nicht beglichen werden", async () => {
    const v = await vorgang(plusTage(HEUTE, -3));
    await lauf();
    const bib = await bibliothekar();
    const id = await mahnungsId(v.loanId);
    const vorher = await momentaufnahme(t.pg);
    erwarteFehler(await begleiche(id, HEUTE, bib), "UEBERSCHREITUNG_LAEUFT");
    expect(await momentaufnahme(t.pg)).toBe(vorher);
  });

  it("AK-03.4 nach verspäteter Verlängerung (nicht mehr überfällig) kann beglichen werden", async () => {
    const v = await vorgang(plusTage(HEUTE, -3));
    await lauf();
    erwarteOk(await verlaengern(t.kontext(sitzungFuer(v.mitglied), festeUhr(HEUTE)), { loanId: v.loanId }));
    erwarteOk(await begleiche(await mahnungsId(v.loanId)));
  });

  it("AK-03.5 schon beglichen → MAHNUNG_BEGLICHEN; unbekannte ID → NICHT_GEFUNDEN; nichts ändert sich", async () => {
    const v = await vorgang(plusTage(HEUTE, -3));
    await zurueck(v, HEUTE);
    const id = await mahnungsId(v.loanId);
    const bib = await bibliothekar();
    erwarteOk(await begleiche(id, HEUTE, bib));
    const vorher = await momentaufnahme(t.pg);

    erwarteFehler(await begleiche(id, HEUTE, bib), "MAHNUNG_BEGLICHEN");
    erwarteFehler(await begleiche("00000000-0000-4000-8000-000000000000", HEUTE, bib), "NICHT_GEFUNDEN");
    erwarteFehler(await begleiche("keine-uuid", HEUTE, bib), "NICHT_GEFUNDEN");
    expect(await momentaufnahme(t.pg)).toBe(vorher);
  });

  it("AK-03.6 (OF-F09-3) beglichen nach verspäteter Verlängerung, wieder überfällig → Job öffnet dieselbe Mahnung", async () => {
    const v = await vorgang("2026-11-05");
    await lauf("2026-11-07");
    const neu = erwarteOk(await verlaengern(t.kontext(sitzungFuer(v.mitglied), festeUhr("2026-11-08")), { loanId: v.loanId }));
    const id = await mahnungsId(v.loanId);
    erwarteOk(await begleiche(id, "2026-11-08"));

    await lauf(plusTage(neu.dueDate, 1));
    const mahnungen = await leseMahnungen(t.pg, v.loanId);
    expect(mahnungen).toHaveLength(1);
    expect(mahnungen[0]).toMatchObject({ id, settled_at: null });
    const titleId = await andererTitelVerfuegbar();
    erwarteFehler(await ausleihen(t.kontext(sitzungFuer(v.mitglied), festeUhr(plusTage(neu.dueDate, 1))), { titleId }), "OFFENE_MAHNUNG");
  });

  it("AK-03.6 beglichen nach verspäteter Verlängerung, verspätete Rückgabe ohne Job → Mahnung wieder offen, Gebühr kommt hinzu", async () => {
    const T = standardWert("mahnTagessatzEuro");
    const v = await vorgang("2026-11-05");
    const neu = erwarteOk(await verlaengern(t.kontext(sitzungFuer(v.mitglied), festeUhr("2026-11-08")), { loanId: v.loanId }));
    const id = await mahnungsId(v.loanId);
    erwarteOk(await begleiche(id, "2026-11-08"));

    await zurueck(v, plusTage(neu.dueDate, 2));
    const [m] = await leseMahnungen(t.pg, v.loanId);
    expect(m).toMatchObject({ id, settled_at: null, fee_cents: gebuehrCents(3, T) + gebuehrCents(2, T) });
  });

  it("AK-03.6 beglichen nach verspäteter Verlängerung, zweite verspätete Verlängerung → Mahnung wieder offen", async () => {
    const T = standardWert("mahnTagessatzEuro");
    const v = await vorgang("2026-11-05");
    const neu = erwarteOk(await verlaengern(t.kontext(sitzungFuer(v.mitglied), festeUhr("2026-11-08")), { loanId: v.loanId }));
    const id = await mahnungsId(v.loanId);
    erwarteOk(await begleiche(id, "2026-11-08"));

    erwarteOk(await verlaengern(t.kontext(sitzungFuer(v.mitglied), festeUhr(plusTage(neu.dueDate, 1))), { loanId: v.loanId }));
    const [m] = await leseMahnungen(t.pg, v.loanId);
    expect(m).toMatchObject({ id, settled_at: null, fee_cents: gebuehrCents(3, T) + gebuehrCents(1, T) });
  });
});
