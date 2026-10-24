// F-07 · E03-US03 · Mahngebühr nach verspäteter Verlängerung (Befund R-07, Review & Security)
// Spec: docs/specs/F-07_E03-US03.md (AK-02.2, AK-02.3) · F-06 AK-03.4, AK-03.5 (OF-F06-3) · Testplan: docs/testing/F-07.md
// Annahme (R-07): Die Gebühr zählt alle überschrittenen Tage des Vorgangs (E04-US02-FR02), also die Tage bis zur
// verspäteten Verlängerung plus die Tage nach der neuen Fälligkeit. `mahngebuehrCents` im Ergebnis ist die
// gesamte Gebühr der Mahnung.
import { describe, expect, it } from "vitest";
import { rueckgabeErfassen } from "@/server/rueckgabe";
import { verlaengern } from "@/server/verlaengerung";
import { nutzeTestDatenbank } from "../helpers/testdb";
import { erwarteOk } from "../helpers/ergebnis";
import { gebuehrCents, grenzen, standardWert } from "../helpers/konfiguration";
import { festeUhr, plusTage } from "../helpers/uhr";
import {
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

const FAELLIG = "2026-11-01";
const VERSPAETET_VERLAENGERT = "2026-11-05"; // 4 Tage nach der Fälligkeit
const RECHTZEITIG_VERLAENGERT = "2026-11-01"; // am Fälligkeitstag

type Vorgang = { loanId: string; inventoryNumber: string; mitglied: Nutzer };

async function verliehen(): Promise<Vorgang> {
  // Verlängern darf an keiner Grenze scheitern; die Zahl selbst ist hier nicht Gegenstand
  await setzeEinstellung(t.pg, "maxVerlaengerungen", grenzen("maxVerlaengerungen").max);
  const titleId = await legeTitelAn(t.pg);
  const exemplar = await legeExemplarAn(t.pg, titleId);
  const mitglied = await legeNutzerAn(t.pg, "MITGLIED");
  const loanId = await legeAusleiheAn(t.pg, {
    copyId: exemplar.id,
    memberId: mitglied.id,
    startDate: plusTage(FAELLIG, -standardWert("leihfristTage")),
    dueDate: FAELLIG,
  });
  return { loanId, inventoryNumber: exemplar.inventoryNumber, mitglied };
}

/** Verlängert über F-06 und liefert die neue Fälligkeit. */
async function verlaengereAm(v: Vorgang, tag: string): Promise<string> {
  return erwarteOk(await verlaengern(t.kontext(sitzungFuer(v.mitglied), festeUhr(tag)), { loanId: v.loanId })).dueDate;
}

async function erfasseAm(v: Vorgang, tag: string) {
  const bibliothekar = sitzungFuer(await legeNutzerAn(t.pg, "BIBLIOTHEKAR"));
  return erwarteOk(await rueckgabeErfassen(t.kontext(bibliothekar, festeUhr(tag, "10:30")), { inventoryNumber: v.inventoryNumber }));
}

describe("E03-US03-FR02 Mahngebühr nach verspäteter Verlängerung (R-07, Querverweis E04-US02-FR02, E03-US02-FR03)", () => {
  it("AK-02.2 verspätet verlängert (Mahnung entsteht bei der Verlängerung), dann 2 Tage nach der neuen Fälligkeit zurück: Gebühr für 4 + 2 Tage", async () => {
    const T = standardWert("mahnTagessatzEuro");
    const v = await verliehen();
    const neueFaelligkeit = await verlaengereAm(v, VERSPAETET_VERLAENGERT);
    expect((await leseMahnungen(t.pg, v.loanId))[0]).toMatchObject({ created_on: VERSPAETET_VERLAENGERT, fee_cents: gebuehrCents(4, T) });

    const daten = await erfasseAm(v, plusTage(neueFaelligkeit, 2));

    const mahnungen = await leseMahnungen(t.pg, v.loanId);
    expect(mahnungen).toHaveLength(1);
    expect(mahnungen[0]).toMatchObject({ created_on: VERSPAETET_VERLAENGERT, fee_cents: gebuehrCents(6, T), settled_at: null });
    expect(daten.mahngebuehrCents).toBe(gebuehrCents(6, T));
  });

  it("AK-02.3 Mahnung des System-Jobs ohne Gebühr, dann verspätet verlängert, dann 2 Tage nach der neuen Fälligkeit zurück: Gebühr für 4 + 2 Tage", async () => {
    const T = standardWert("mahnTagessatzEuro");
    const v = await verliehen();
    const mahnungId = await legeMahnungAn(t.pg, { loanId: v.loanId, createdOn: plusTage(FAELLIG, 1), feeCents: null });
    const neueFaelligkeit = await verlaengereAm(v, VERSPAETET_VERLAENGERT);

    const daten = await erfasseAm(v, plusTage(neueFaelligkeit, 2));

    const mahnungen = await leseMahnungen(t.pg, v.loanId);
    expect(mahnungen).toHaveLength(1);
    expect(mahnungen[0]).toMatchObject({ id: mahnungId, created_on: plusTage(FAELLIG, 1), fee_cents: gebuehrCents(6, T) });
    expect(daten.mahngebuehrCents).toBe(gebuehrCents(6, T));
  });

  it("AK-02.2 verspätet verlängert, dann rechtzeitig zurück: die Gebühr bis zur Verlängerung bleibt, nichts kommt dazu", async () => {
    const T = standardWert("mahnTagessatzEuro");
    const v = await verliehen();
    const neueFaelligkeit = await verlaengereAm(v, VERSPAETET_VERLAENGERT);

    await erfasseAm(v, neueFaelligkeit);

    const mahnungen = await leseMahnungen(t.pg, v.loanId);
    expect(mahnungen).toHaveLength(1);
    expect(mahnungen[0]).toMatchObject({ fee_cents: gebuehrCents(4, T), settled_at: null });
  });

  it("AK-02.4 rechtzeitig verlängert, dann 2 Tage nach der neuen Fälligkeit zurück: neue Mahnung nur für 2 Tage", async () => {
    const T = standardWert("mahnTagessatzEuro");
    const v = await verliehen();
    const neueFaelligkeit = await verlaengereAm(v, RECHTZEITIG_VERLAENGERT);
    const rueckgabetag = plusTage(neueFaelligkeit, 2);

    const daten = await erfasseAm(v, rueckgabetag);

    const mahnungen = await leseMahnungen(t.pg, v.loanId);
    expect(mahnungen).toHaveLength(1);
    expect(mahnungen[0]).toMatchObject({ created_on: rueckgabetag, fee_cents: gebuehrCents(2, T) });
    expect(daten.mahngebuehrCents).toBe(gebuehrCents(2, T));
  });
});
