// F-07 · E03-US03 · Rückgabe erfassen
// Spec: docs/specs/F-07_E03-US03.md · Testplan: docs/testing/F-07.md
import { describe, expect, it } from "vitest";
import { rueckgabeErfassen } from "@/server/rueckgabe";
import { ausleihen } from "@/server/ausleihe";
import { ladeMeineAusleihen } from "@/server/verlaengerung";
import { sucheKatalog } from "@/server/katalog/suche";
import { ladeTitelDetail } from "@/server/katalog/detail";
import { momentaufnahme, nutzeTestDatenbank, zaehle, type Sitzung } from "../helpers/testdb";
import { erwarteFehler, erwarteOk } from "../helpers/ergebnis";
import { andererGueltigerWert, gebuehrCents, standardWert } from "../helpers/konfiguration";
import { festeUhr, plusTage } from "../helpers/uhr";
import {
  leseAusleihe,
  leseMahnungen,
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
  type Zustand,
} from "../helpers/daten";

const t = nutzeTestDatenbank();

const HEUTE = "2026-11-10";

type Vorgang = { loanId: string; titleId: string; copyId: string; inventoryNumber: string; mitglied: Nutzer; dueDate: string };

/** Offener Ausleihvorgang; Standard: fällig am HEUTE + 5. */
async function verliehen(optionen: { dueDate?: string; titleId?: string; title?: string; condition?: Zustand } = {}): Promise<Vorgang> {
  const titleId = optionen.titleId ?? (await legeTitelAn(t.pg, { title: optionen.title }));
  const exemplar = await legeExemplarAn(t.pg, titleId, { condition: optionen.condition });
  const mitglied = await legeNutzerAn(t.pg, "MITGLIED");
  const dueDate = optionen.dueDate ?? plusTage(HEUTE, 5);
  const loanId = await legeAusleiheAn(t.pg, {
    copyId: exemplar.id,
    memberId: mitglied.id,
    startDate: plusTage(dueDate, -standardWert("leihfristTage")),
    dueDate,
  });
  return { loanId, titleId, copyId: exemplar.id, inventoryNumber: exemplar.inventoryNumber, mitglied, dueDate };
}

async function bibliothekar(): Promise<Sitzung> {
  return sitzungFuer(await legeNutzerAn(t.pg, "BIBLIOTHEKAR"));
}

async function erfasse(inventoryNumber: string, heute = HEUTE, uhrzeit = "10:30", sitzung?: Sitzung) {
  return rueckgabeErfassen(t.kontext(sitzung ?? (await bibliothekar()), festeUhr(heute, uhrzeit)), { inventoryNumber });
}

async function vormerkung(titleId: string, status: "WARTEND" | "ABHOLBEREIT" | "ABGELAUFEN", tag: string, copyId?: string) {
  const mitglied = await legeNutzerAn(t.pg, "MITGLIED");
  const id = await legeVormerkungAn(t.pg, {
    titleId,
    memberId: mitglied.id,
    status,
    createdAt: zeitpunkt(tag),
    copyId: copyId ?? null,
    pickupDeadline: status === "WARTEND" ? null : plusTage(tag, 3),
  });
  return { id, mitglied };
}

type VormerkungZeile = { status: string; copy_id: string | null; pickup_deadline: string | null };

async function leseVormerkung(id: string): Promise<VormerkungZeile> {
  const { rows } = await t.pg.query<VormerkungZeile>(
    "SELECT status, copy_id, pickup_deadline::text AS pickup_deadline FROM reservations WHERE id = $1",
    [id],
  );
  return rows[0];
}

async function statusAufDetailseite(titleId: string, inventoryNumber: string) {
  const { exemplare } = erwarteOk(await ladeTitelDetail(t.kontext(null), titleId));
  return exemplare.find((e) => e.inventoryNumber === inventoryNumber)?.status;
}

async function verfuegbarImKatalog(titleId: string, titel: string) {
  return erwarteOk(await sucheKatalog(t.kontext(null), { q: titel })).treffer.find((x) => x.titleId === titleId)?.verfuegbareExemplare;
}

describe("E03-US03-FR01 Ausleihvorgang abschließen und Rückgabedatum setzen", () => {
  it("AK-01.1 der Vorgang ist abgeschlossen, Rückgabedatum = Zeitpunkt der Erfassung", async () => {
    const v = await verliehen();
    const uhr = festeUhr(HEUTE, "10:30");

    const daten = erwarteOk(await rueckgabeErfassen(t.kontext(await bibliothekar(), uhr), { inventoryNumber: v.inventoryNumber }));
    expect(daten.loanId).toBe(v.loanId);
    expect(new Date(daten.returnedAt).toISOString()).toBe(uhr.jetzt().toISOString());
    const zeile = await leseAusleihe(t.pg, v.loanId);
    expect(zeile?.returned_at?.toISOString()).toBe(uhr.jetzt().toISOString());
  });

  it("AK-01.1 nur der Vorgang zu dieser Inventarnummer wird abgeschlossen", async () => {
    const v = await verliehen();
    const anderer = await verliehen({ titleId: v.titleId });

    erwarteOk(await erfasse(v.inventoryNumber));
    expect((await leseAusleihe(t.pg, anderer.loanId))?.returned_at).toBeNull();
  });

  it("AK-01.2 (Querverweis F-06) danach fehlt der Vorgang in „Meine Ausleihen“", async () => {
    const v = await verliehen();
    const sitzung = sitzungFuer(v.mitglied);
    expect(erwarteOk(await ladeMeineAusleihen(t.kontext(sitzung))).map((x) => x.loanId)).toEqual([v.loanId]);

    erwarteOk(await erfasse(v.inventoryNumber));
    expect(erwarteOk(await ladeMeineAusleihen(t.kontext(sitzung)))).toEqual([]);
  });

  it("AK-01.2 (Querverweis F-05) danach zählt der Vorgang nicht mehr zum Ausleihlimit", async () => {
    const N = standardWert("ausleihlimitProMitglied");
    await setzeEinstellung(t.pg, "ausleihlimitProMitglied", N);
    const erster = await verliehen();
    for (let i = 1; i < N; i++) {
      const titleId = await legeTitelAn(t.pg);
      const ex = await legeExemplarAn(t.pg, titleId);
      await legeAusleiheAn(t.pg, { copyId: ex.id, memberId: erster.mitglied.id, startDate: "2026-11-01", dueDate: "2026-11-29" });
    }
    const neu = await legeTitelAn(t.pg);
    await legeExemplarAn(t.pg, neu);
    const mitglied = sitzungFuer(erster.mitglied);
    erwarteFehler(await ausleihen(t.kontext(mitglied, festeUhr(HEUTE)), { titleId: neu }), "AUSLEIHLIMIT_ERREICHT");

    erwarteOk(await erfasse(erster.inventoryNumber));
    erwarteOk(await ausleihen(t.kontext(mitglied, festeUhr(HEUTE)), { titleId: neu }));
  });

  it("AK-01.3 (Querverweis E02-US02-FR03, F-01, F-02) ohne Vormerkung ist das Exemplar danach verfügbar, Anzahl +1", async () => {
    const v = await verliehen({ title: "Kommt zurück" });
    await legeExemplarAn(t.pg, v.titleId);
    const vorher = await verfuegbarImKatalog(v.titleId, "Kommt zurück");

    const daten = erwarteOk(await erfasse(v.inventoryNumber));
    expect(daten.zugeordneteVormerkungId ?? null).toBeNull();
    expect(await statusAufDetailseite(v.titleId, v.inventoryNumber)).toBe("VERFUEGBAR");
    expect(await verfuegbarImKatalog(v.titleId, "Kommt zurück")).toBe(Number(vorher) + 1);
  });

  it("AK-01.4 Inventarnummer ohne offenen Ausleihvorgang: NICHT_GEFUNDEN, nichts geändert", async () => {
    const titleId = await legeTitelAn(t.pg);
    const frei = await legeExemplarAn(t.pg, titleId);
    const sitzung = await bibliothekar();
    const vorher = await momentaufnahme(t.pg);

    erwarteFehler(await erfasse(frei.inventoryNumber, HEUTE, "10:30", sitzung), "NICHT_GEFUNDEN");
    expect(await momentaufnahme(t.pg)).toBe(vorher);
  });

  it("AK-01.4 unbekannte Inventarnummer: NICHT_GEFUNDEN, nichts geändert", async () => {
    await verliehen();
    const sitzung = await bibliothekar();
    const vorher = await momentaufnahme(t.pg);

    erwarteFehler(await erfasse("INV-999998", HEUTE, "10:30", sitzung), "NICHT_GEFUNDEN");
    expect(await momentaufnahme(t.pg)).toBe(vorher);
  });

  it("AK-01.5 zweite Erfassung für dasselbe Exemplar: NICHT_GEFUNDEN, das erste Rückgabedatum bleibt", async () => {
    const v = await verliehen();
    const sitzung = await bibliothekar();
    const ersteUhr = festeUhr(HEUTE, "10:30");
    erwarteOk(await rueckgabeErfassen(t.kontext(sitzung, ersteUhr), { inventoryNumber: v.inventoryNumber }));

    erwarteFehler(await erfasse(v.inventoryNumber, plusTage(HEUTE, 1), "09:00", sitzung), "NICHT_GEFUNDEN");
    expect((await leseAusleihe(t.pg, v.loanId))?.returned_at?.toISOString()).toBe(ersteUhr.jetzt().toISOString());
  });

  it("AK-01.6 das Ergebnis nennt den Vorgang, die Mahngebühr und die Zuordnung an eine Vormerkung", async () => {
    const v = await verliehen({ dueDate: plusTage(HEUTE, -2) });
    const a = await vormerkung(v.titleId, "WARTEND", "2026-11-01");

    const daten = erwarteOk(await erfasse(v.inventoryNumber));
    expect(daten).toMatchObject({
      loanId: v.loanId,
      mahngebuehrCents: gebuehrCents(2, standardWert("mahnTagessatzEuro")),
      zugeordneteVormerkungId: a.id,
    });
  });

  it("AK-01.4 eine leere Inventarnummer ist ungültig (VALIDIERUNG laut schnittstellen.md)", async () => {
    const felder = erwarteFehler(await erfasse("   "), "VALIDIERUNG");
    expect(Object.keys(felder)).toContain("inventoryNumber");
  });
});

describe("E03-US03-FR02 Mahngebühr bei Rückgabe nach der Fälligkeit", () => {
  it.each([
    ["am Fälligkeitstag", 0],
    ["einen Tag vorher", -1],
  ])("AK-02.1 Rückgabe %s: keine Mahngebühr, keine Mahnung", async (_wann, versatz) => {
    const v = await verliehen({ dueDate: HEUTE });

    const daten = erwarteOk(await erfasse(v.inventoryNumber, plusTage(HEUTE, versatz)));
    expect(daten.mahngebuehrCents ?? 0).toBe(0);
    expect(await leseMahnungen(t.pg, v.loanId)).toEqual([]);
  });

  it.each([1, 3, 12])("AK-02.2 (Querverweis E04-US02-FR02) Rückgabe %i Tage nach der Fälligkeit: Gebühr = Tage × Tagessatz", async (k) => {
    const T = standardWert("mahnTagessatzEuro");
    await setzeEinstellung(t.pg, "mahnTagessatzEuro", T);
    const v = await verliehen({ dueDate: plusTage(HEUTE, -k) });

    const daten = erwarteOk(await erfasse(v.inventoryNumber));
    expect(daten.mahngebuehrCents).toBe(gebuehrCents(k, T));
    const mahnungen = await leseMahnungen(t.pg, v.loanId);
    expect(mahnungen).toHaveLength(1);
    expect(mahnungen[0].fee_cents).toBe(gebuehrCents(k, T));
  });

  it("AK-02.2 die Gebühr folgt dem gesetzten Tagessatz", async () => {
    const T = andererGueltigerWert("mahnTagessatzEuro", standardWert("mahnTagessatzEuro"));
    await setzeEinstellung(t.pg, "mahnTagessatzEuro", T);
    const v = await verliehen({ dueDate: plusTage(HEUTE, -4) });

    expect(erwarteOk(await erfasse(v.inventoryNumber)).mahngebuehrCents).toBe(gebuehrCents(4, T));
  });

  it("AK-02.3 eine bestehende Mahnung bekommt die Gebühr; es entsteht keine zweite", async () => {
    const T = standardWert("mahnTagessatzEuro");
    const v = await verliehen({ dueDate: plusTage(HEUTE, -6) });
    const mahnungId = await legeMahnungAn(t.pg, { loanId: v.loanId, createdOn: plusTage(HEUTE, -5), feeCents: null });

    erwarteOk(await erfasse(v.inventoryNumber));
    const mahnungen = await leseMahnungen(t.pg, v.loanId);
    expect(mahnungen).toHaveLength(1);
    expect(mahnungen[0]).toMatchObject({ id: mahnungId, created_on: plusTage(HEUTE, -5), fee_cents: gebuehrCents(6, T) });
  });

  it("AK-02.4 (Querverweis E04-US02-FR01) ohne bestehende Mahnung entsteht eine mit Datum, Vorgang und Gebühr (OF-F07-1)", async () => {
    const T = standardWert("mahnTagessatzEuro");
    const v = await verliehen({ dueDate: plusTage(HEUTE, -3) });

    erwarteOk(await erfasse(v.inventoryNumber));
    const mahnungen = await leseMahnungen(t.pg, v.loanId);
    expect(mahnungen).toHaveLength(1);
    expect(mahnungen[0]).toMatchObject({ loan_id: v.loanId, created_on: HEUTE, fee_cents: gebuehrCents(3, T), settled_at: null });
  });

  it("AK-02.5 (Querverweis E04-US02-FR03, F-05) die Mahnung bleibt offen; das Mitglied kann nicht ausleihen", async () => {
    const v = await verliehen({ dueDate: plusTage(HEUTE, -3) });
    const anderer = await legeTitelAn(t.pg);
    await legeExemplarAn(t.pg, anderer);

    erwarteOk(await erfasse(v.inventoryNumber));
    expect((await leseMahnungen(t.pg, v.loanId))[0].settled_at).toBeNull();
    erwarteFehler(await ausleihen(t.kontext(sitzungFuer(v.mitglied), festeUhr(HEUTE)), { titleId: anderer }), "OFFENE_MAHNUNG");
  });

  it("AK-02.5 eine bereits beglichene Mahnung wird durch die Rückgabe nicht wieder geöffnet", async () => {
    const v = await verliehen({ dueDate: plusTage(HEUTE, -3) });
    const bib = await legeNutzerAn(t.pg, "BIBLIOTHEKAR");
    await legeMahnungAn(t.pg, { loanId: v.loanId, createdOn: plusTage(HEUTE, -2), feeCents: 100, beglichenVon: bib.id });

    erwarteOk(await erfasse(v.inventoryNumber));
    const mahnungen = await leseMahnungen(t.pg, v.loanId);
    expect(mahnungen).toHaveLength(1);
    expect(mahnungen[0].settled_at).not.toBeNull();
  });
});

describe("E03-US03-FR03 Zuordnung an die nächste Vormerkung statt frei verfügbar", () => {
  it("AK-03.1 (Querverweis E05-US01-FR02) das Exemplar geht an die früheste wartende Vormerkung (A vor B)", async () => {
    const v = await verliehen();
    const b = await vormerkung(v.titleId, "WARTEND", "2026-11-03");
    const a = await vormerkung(v.titleId, "WARTEND", "2026-11-01");

    const daten = erwarteOk(await erfasse(v.inventoryNumber));
    expect(daten.zugeordneteVormerkungId).toBe(a.id);
    expect(await leseVormerkung(a.id)).toMatchObject({ status: "ABHOLBEREIT", copy_id: v.copyId });
    expect(await leseVormerkung(b.id)).toMatchObject({ status: "WARTEND", copy_id: null });
  });

  it("AK-03.1 bei gleichem Tag entscheidet die Uhrzeit der Vormerkung", async () => {
    const v = await verliehen();
    const spaeter = await legeVormerkungAn(t.pg, {
      titleId: v.titleId,
      memberId: (await legeNutzerAn(t.pg, "MITGLIED")).id,
      status: "WARTEND",
      createdAt: zeitpunkt("2026-11-02", "15:00"),
    });
    const frueher = await legeVormerkungAn(t.pg, {
      titleId: v.titleId,
      memberId: (await legeNutzerAn(t.pg, "MITGLIED")).id,
      status: "WARTEND",
      createdAt: zeitpunkt("2026-11-02", "09:00"),
    });

    expect(erwarteOk(await erfasse(v.inventoryNumber)).zugeordneteVormerkungId).toBe(frueher);
    expect((await leseVormerkung(spaeter)).status).toBe("WARTEND");
  });

  it("AK-03.1 Vormerkungen für andere Titel werden nicht bedient", async () => {
    const v = await verliehen();
    const anderer = await legeTitelAn(t.pg);
    const fremd = await vormerkung(anderer, "WARTEND", "2026-10-01");

    expect(erwarteOk(await erfasse(v.inventoryNumber)).zugeordneteVormerkungId ?? null).toBeNull();
    expect((await leseVormerkung(fremd.id)).status).toBe("WARTEND");
  });

  it("AK-03.2 (Querverweis F-01, F-02) das zugeordnete Exemplar ist vorgemerkt; die Anzahl verfügbarer Exemplare ändert sich nicht", async () => {
    const v = await verliehen({ title: "Warteschlange" });
    await legeExemplarAn(t.pg, v.titleId, { condition: "VERLOREN" });
    await vormerkung(v.titleId, "WARTEND", "2026-11-01");
    const vorher = await verfuegbarImKatalog(v.titleId, "Warteschlange");

    erwarteOk(await erfasse(v.inventoryNumber));
    expect(await statusAufDetailseite(v.titleId, v.inventoryNumber)).toBe("VORGEMERKT");
    expect(await verfuegbarImKatalog(v.titleId, "Warteschlange")).toBe(vorher);
  });

  it("AK-03.3 (Querverweis E05-US01-FR03) die Abholfrist endet abholfristVormerkungTage nach dem Rückgabetag", async () => {
    const tage = standardWert("abholfristVormerkungTage");
    const v = await verliehen();
    const a = await vormerkung(v.titleId, "WARTEND", "2026-11-01");

    erwarteOk(await erfasse(v.inventoryNumber));
    expect((await leseVormerkung(a.id)).pickup_deadline).toBe(plusTage(HEUTE, tage));
  });

  it("AK-03.3 die Abholfrist folgt dem gesetzten Wert", async () => {
    const tage = andererGueltigerWert("abholfristVormerkungTage", standardWert("abholfristVormerkungTage"));
    await setzeEinstellung(t.pg, "abholfristVormerkungTage", tage);
    const v = await verliehen();
    const a = await vormerkung(v.titleId, "WARTEND", "2026-11-01");

    erwarteOk(await erfasse(v.inventoryNumber, "2026-12-30"));
    expect((await leseVormerkung(a.id)).pickup_deadline).toBe(plusTage("2026-12-30", tage));
  });

  it("AK-03.4 (Querverweis E05-US01-FR03) für A wird eine Benachrichtigung „abholbereit“ angelegt, für B nicht (OF-D8)", async () => {
    const v = await verliehen();
    const a = await vormerkung(v.titleId, "WARTEND", "2026-11-01");
    const b = await vormerkung(v.titleId, "WARTEND", "2026-11-02");

    erwarteOk(await erfasse(v.inventoryNumber));
    const { rows } = await t.pg.query<{ user_id: string; type: string; reservation_id: string | null }>(
      "SELECT user_id, type, reservation_id FROM notifications",
    );
    expect(rows).toEqual([{ user_id: a.mitglied.id, type: "ABHOLBEREIT", reservation_id: a.id }]);
    expect(rows.some((r) => r.user_id === b.mitglied.id)).toBe(false);
  });

  it("AK-03.5 nach der Rückgabe kann kein anderes Mitglied das zugeordnete Exemplar ausleihen", async () => {
    const v = await verliehen();
    await vormerkung(v.titleId, "WARTEND", "2026-11-01");
    const dritter = await legeNutzerAn(t.pg, "MITGLIED");

    erwarteOk(await erfasse(v.inventoryNumber));
    erwarteFehler(await ausleihen(t.kontext(sitzungFuer(dritter), festeUhr(HEUTE)), { titleId: v.titleId }), "KEIN_EXEMPLAR_VERFUEGBAR");
    expect(await zaehle(t.pg, "SELECT count(*) AS n FROM loans WHERE copy_id = $1 AND returned_at IS NULL", [v.copyId])).toBe(0);
  });

  it("AK-03.5 Rückgabe, Abschluss und Zuordnung hängen zusammen: alle drei Änderungen sind sichtbar oder keine", async () => {
    const v = await verliehen({ dueDate: plusTage(HEUTE, -1) });
    const a = await vormerkung(v.titleId, "WARTEND", "2026-11-01");

    erwarteOk(await erfasse(v.inventoryNumber));
    const vorgang = await leseAusleihe(t.pg, v.loanId);
    const zuordnung = await leseVormerkung(a.id);
    expect(vorgang?.returned_at).not.toBeNull();
    expect(zuordnung).toMatchObject({ status: "ABHOLBEREIT", copy_id: v.copyId });
    expect(await leseMahnungen(t.pg, v.loanId)).toHaveLength(1);
  });

  it("AK-03.6 ein verlorenes Exemplar wird normal zurückgenommen, aber keiner Vormerkung zugeordnet und ist nicht verfügbar (OF-F07-5)", async () => {
    const v = await verliehen({ condition: "VERLOREN", title: "Verloren zurück" });
    const a = await vormerkung(v.titleId, "WARTEND", "2026-11-01");

    const daten = erwarteOk(await erfasse(v.inventoryNumber));
    expect(daten.zugeordneteVormerkungId ?? null).toBeNull();
    expect((await leseAusleihe(t.pg, v.loanId))?.returned_at).not.toBeNull();
    expect(await leseVormerkung(a.id)).toMatchObject({ status: "WARTEND", copy_id: null });
    const { rows } = await t.pg.query<{ condition: string }>("SELECT condition FROM copies WHERE id = $1", [v.copyId]);
    expect(rows[0].condition).toBe("VERLOREN");
    expect(await statusAufDetailseite(v.titleId, v.inventoryNumber)).toBe("GESPERRT");
    expect(await zaehle(t.pg, "SELECT count(*) AS n FROM notifications")).toBe(0);
  });

  it("AK-03.7 nur abholbereite oder abgelaufene Vormerkungen: das Exemplar wird frei verfügbar", async () => {
    const v = await verliehen({ title: "Ohne Wartende" });
    const anderes = await legeExemplarAn(t.pg, v.titleId);
    const abholbereit = await vormerkung(v.titleId, "ABHOLBEREIT", "2026-11-01", anderes.id);
    const abgelaufen = await vormerkung(v.titleId, "ABGELAUFEN", "2026-10-01");

    const daten = erwarteOk(await erfasse(v.inventoryNumber));
    expect(daten.zugeordneteVormerkungId ?? null).toBeNull();
    expect(await statusAufDetailseite(v.titleId, v.inventoryNumber)).toBe("VERFUEGBAR");
    expect(await leseVormerkung(abholbereit.id)).toMatchObject({ status: "ABHOLBEREIT", copy_id: anderes.id });
    expect((await leseVormerkung(abgelaufen.id)).status).toBe("ABGELAUFEN");
  });

  it("NFR06 nach der Rückgabe ohne Vormerkung kann das Exemplar genau einem neuen Vorgang zugeordnet werden", async () => {
    const v = await verliehen();
    erwarteOk(await erfasse(v.inventoryNumber));
    const a = await legeNutzerAn(t.pg, "MITGLIED");
    const b = await legeNutzerAn(t.pg, "MITGLIED");

    const ergebnisse = await Promise.all(
      [a, b].map((n) => ausleihen(t.kontext(sitzungFuer(n), festeUhr(HEUTE)), { titleId: v.titleId })),
    );
    expect(ergebnisse.filter((e) => e.ok)).toHaveLength(1);
    expect(await zaehle(t.pg, "SELECT count(*) AS n FROM loans WHERE copy_id = $1 AND returned_at IS NULL", [v.copyId])).toBe(1);
  });
});
