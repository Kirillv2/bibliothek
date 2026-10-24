// F-06 · E03-US02 · Eigene Ausleihen einsehen und verlängern
// Spec: docs/specs/F-06_E03-US02.md · Testplan: docs/testing/F-06.md
import { describe, expect, it } from "vitest";
import { ladeMeineAusleihen, verlaengern } from "@/server/verlaengerung";
import { momentaufnahme, nutzeTestDatenbank, zaehle } from "../helpers/testdb";
import { erwarteFehler, erwarteOk } from "../helpers/ergebnis";
import { gebuehrCents, grenzen, standardWert } from "../helpers/konfiguration";
import { festeUhr, plusTage, tageZwischen } from "../helpers/uhr";
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
} from "../helpers/daten";

const t = nutzeTestDatenbank();

const HEUTE = "2026-11-10";
const L = standardWert("leihfristTage");

type Ausleihe = { loanId: string; titleId: string; copyId: string; inventoryNumber: string; dueDate: string };

/** Offener Ausleihvorgang des Mitglieds; Standard: fällig in 10 Tagen ab HEUTE. */
async function leiheAn(
  nutzer: Nutzer,
  optionen: { title?: string; dueDate?: string; renewalCount?: number; returned?: boolean; titleId?: string } = {},
): Promise<Ausleihe> {
  const titleId = optionen.titleId ?? (await legeTitelAn(t.pg, { title: optionen.title }));
  const exemplar = await legeExemplarAn(t.pg, titleId);
  const dueDate = optionen.dueDate ?? plusTage(HEUTE, 10);
  const loanId = await legeAusleiheAn(t.pg, {
    copyId: exemplar.id,
    memberId: nutzer.id,
    startDate: plusTage(dueDate, -L),
    dueDate,
    renewalCount: optionen.renewalCount ?? 0,
    returnedAt: optionen.returned ? zeitpunkt(HEUTE, "09:00") : null,
  });
  return { loanId, titleId, copyId: exemplar.id, inventoryNumber: exemplar.inventoryNumber, dueDate };
}

async function mitglied(): Promise<Nutzer> {
  return legeNutzerAn(t.pg, "MITGLIED");
}

async function verlaengere(nutzer: Nutzer, loanId: string, heute = HEUTE) {
  return verlaengern(t.kontext(sitzungFuer(nutzer), festeUhr(heute)), { loanId });
}

async function meineAusleihen(nutzer: Nutzer, heute = HEUTE) {
  return erwarteOk(await ladeMeineAusleihen(t.kontext(sitzungFuer(nutzer), festeUhr(heute))));
}

describe("E03-US02-FR01 Offene Ausleihen mit Titel, Inventarnummer und Fälligkeit", () => {
  it("AK-01.1 zeigt jeden offenen Vorgang mit Titel, Inventarnummer und Fälligkeit", async () => {
    const nutzer = await mitglied();
    const a = await leiheAn(nutzer, { title: "Erster Titel", dueDate: "2026-11-20" });
    const b = await leiheAn(nutzer, { title: "Zweiter Titel", dueDate: "2026-12-01", renewalCount: 1 });

    const liste = await meineAusleihen(nutzer);
    expect(liste).toHaveLength(2);
    expect(liste).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ loanId: a.loanId, title: "Erster Titel", inventoryNumber: a.inventoryNumber, dueDate: "2026-11-20", renewalCount: 0 }),
        expect.objectContaining({ loanId: b.loanId, title: "Zweiter Titel", inventoryNumber: b.inventoryNumber, dueDate: "2026-12-01", renewalCount: 1 }),
      ]),
    );
  });

  it("AK-01.2 abgeschlossene Vorgänge erscheinen nicht", async () => {
    const nutzer = await mitglied();
    const offen = await leiheAn(nutzer);
    await leiheAn(nutzer, { returned: true });

    expect((await meineAusleihen(nutzer)).map((x) => x.loanId)).toEqual([offen.loanId]);
  });

  it("AK-01.3 Vorgänge anderer Mitglieder erscheinen nicht", async () => {
    const nutzer = await mitglied();
    const andere = await mitglied();
    const eigene = await leiheAn(nutzer);
    await leiheAn(andere);
    await leiheAn(andere);

    expect((await meineAusleihen(nutzer)).map((x) => x.loanId)).toEqual([eigene.loanId]);
  });

  it("AK-01.4 (OF-F03-5) angezeigt wird der aktuelle Titel, auch nach einer Bearbeitung", async () => {
    const nutzer = await mitglied();
    const ausleihe = await leiheAn(nutzer, { title: "Alter Name" });
    await t.pg.query("UPDATE titles SET title = 'Neuer Name', updated_at = now() WHERE id = $1", [ausleihe.titleId]);

    expect((await meineAusleihen(nutzer))[0].title).toBe("Neuer Name");
  });

  it("AK-01.5 ohne offene Vorgänge ist die Liste leer (die Seite zeigt dann einen Hinweis)", async () => {
    const nutzer = await mitglied();
    await leiheAn(nutzer, { returned: true });

    expect(await meineAusleihen(nutzer)).toEqual([]);
  });

  it("AK-01.6 (E06-US01-FR02) Gast: NICHT_ANGEMELDET", async () => {
    await leiheAn(await mitglied());

    erwarteFehler(await ladeMeineAusleihen(t.kontext(null)), "NICHT_ANGEMELDET");
  });
});

describe("E03-US02-FR02 Verlängerung ohne Vormerkung und unter der Höchstzahl", () => {
  it("AK-02.1 offener eigener Vorgang ohne Vormerkung: Verlängerung gelingt, renewalCount steigt um eins", async () => {
    const nutzer = await mitglied();
    const ausleihe = await leiheAn(nutzer, { renewalCount: 0 });

    const daten = erwarteOk(await verlaengere(nutzer, ausleihe.loanId));
    expect(daten).toMatchObject({ loanId: ausleihe.loanId, renewalCount: 1 });
    expect((await leseAusleihe(t.pg, ausleihe.loanId))?.renewal_count).toBe(1);
  });

  it("AK-02.1 bis zur Höchstzahl sind wiederholte Verlängerungen möglich", async () => {
    const M = standardWert("maxVerlaengerungen");
    await setzeEinstellung(t.pg, "maxVerlaengerungen", M);
    const nutzer = await mitglied();
    const ausleihe = await leiheAn(nutzer);

    for (let i = 1; i <= M; i++) {
      expect(erwarteOk(await verlaengere(nutzer, ausleihe.loanId)).renewalCount).toBe(i);
    }
    erwarteFehler(await verlaengere(nutzer, ausleihe.loanId), "MAX_VERLAENGERUNGEN_ERREICHT");
  });

  it("AK-02.2 renewalCount = maxVerlaengerungen: MAX_VERLAENGERUNGEN_ERREICHT, Vorgang unverändert", async () => {
    const M = standardWert("maxVerlaengerungen");
    await setzeEinstellung(t.pg, "maxVerlaengerungen", M);
    const nutzer = await mitglied();
    const ausleihe = await leiheAn(nutzer, { renewalCount: M });
    const vorher = await momentaufnahme(t.pg);

    erwarteFehler(await verlaengere(nutzer, ausleihe.loanId), "MAX_VERLAENGERUNGEN_ERREICHT");
    expect(await momentaufnahme(t.pg)).toBe(vorher);
  });

  it("AK-02.3 maxVerlaengerungen = 0: keine Verlängerung möglich", async () => {
    expect(grenzen("maxVerlaengerungen").min).toBeLessThanOrEqual(0);
    await setzeEinstellung(t.pg, "maxVerlaengerungen", 0);
    const nutzer = await mitglied();
    const ausleihe = await leiheAn(nutzer, { renewalCount: 0 });

    erwarteFehler(await verlaengere(nutzer, ausleihe.loanId), "MAX_VERLAENGERUNGEN_ERREICHT");
    expect((await leseAusleihe(t.pg, ausleihe.loanId))?.renewal_count).toBe(0);
  });

  it("AK-02.4 (Querverweis E05-US01-FR02) wartende Vormerkung für den Titel: VORMERKUNG_VORHANDEN, Vorgang unverändert", async () => {
    const nutzer = await mitglied();
    const ausleihe = await leiheAn(nutzer);
    await legeVormerkungAn(t.pg, { titleId: ausleihe.titleId, memberId: (await mitglied()).id, status: "WARTEND", createdAt: zeitpunkt("2026-11-05") });
    const vorher = await momentaufnahme(t.pg);

    erwarteFehler(await verlaengere(nutzer, ausleihe.loanId), "VORMERKUNG_VORHANDEN");
    expect(await momentaufnahme(t.pg)).toBe(vorher);
  });

  it("AK-02.4 (OF-F06-1) die Vormerkung gilt je Titel, auch wenn ein anderes Exemplar des Titels verfügbar wäre", async () => {
    const nutzer = await mitglied();
    const ausleihe = await leiheAn(nutzer);
    await legeExemplarAn(t.pg, ausleihe.titleId);
    await legeVormerkungAn(t.pg, { titleId: ausleihe.titleId, memberId: (await mitglied()).id, status: "WARTEND", createdAt: zeitpunkt("2026-11-05") });

    erwarteFehler(await verlaengere(nutzer, ausleihe.loanId), "VORMERKUNG_VORHANDEN");
  });

  it("AK-02.5 nur abholbereite (anderem Exemplar zugeordnete) oder abgelaufene Vormerkungen blockieren nicht", async () => {
    const nutzer = await mitglied();
    const ausleihe = await leiheAn(nutzer);
    const anderes = await legeExemplarAn(t.pg, ausleihe.titleId);
    await legeVormerkungAn(t.pg, {
      titleId: ausleihe.titleId,
      memberId: (await mitglied()).id,
      status: "ABHOLBEREIT",
      createdAt: zeitpunkt("2026-11-01"),
      copyId: anderes.id,
      pickupDeadline: "2026-11-12",
    });
    await legeVormerkungAn(t.pg, {
      titleId: ausleihe.titleId,
      memberId: (await mitglied()).id,
      status: "ABGELAUFEN",
      createdAt: zeitpunkt("2026-10-01"),
      copyId: anderes.id,
      pickupDeadline: "2026-10-10",
    });

    erwarteOk(await verlaengere(nutzer, ausleihe.loanId));
  });

  it("AK-02.5 Vormerkungen für einen anderen Titel blockieren nicht", async () => {
    const nutzer = await mitglied();
    const ausleihe = await leiheAn(nutzer);
    const anderer = await legeTitelAn(t.pg);
    await legeVormerkungAn(t.pg, { titleId: anderer, memberId: (await mitglied()).id, status: "WARTEND", createdAt: zeitpunkt("2026-11-05") });

    erwarteOk(await verlaengere(nutzer, ausleihe.loanId));
  });

  it("AK-02.6 Vorgang eines anderen Mitglieds: NICHT_GEFUNDEN, Vorgang unverändert", async () => {
    const nutzer = await mitglied();
    const fremd = await leiheAn(await mitglied());
    const vorher = await momentaufnahme(t.pg);

    erwarteFehler(await verlaengere(nutzer, fremd.loanId), "NICHT_GEFUNDEN");
    expect(await momentaufnahme(t.pg)).toBe(vorher);
  });

  it("AK-02.6 unbekannte loanId: NICHT_GEFUNDEN", async () => {
    erwarteFehler(await verlaengere(await mitglied(), "00000000-0000-4000-8000-000000000000"), "NICHT_GEFUNDEN");
  });

  it("AK-02.7 abgeschlossener eigener Vorgang: AUSLEIHVORGANG_ABGESCHLOSSEN", async () => {
    const nutzer = await mitglied();
    const ausleihe = await leiheAn(nutzer, { returned: true });
    const vorher = await momentaufnahme(t.pg);

    erwarteFehler(await verlaengere(nutzer, ausleihe.loanId), "AUSLEIHVORGANG_ABGESCHLOSSEN");
    expect(await momentaufnahme(t.pg)).toBe(vorher);
  });

  it("AK-02.8 die Liste zeigt je Vorgang, ob Verlängern möglich ist, und wenn nicht, warum", async () => {
    const M = standardWert("maxVerlaengerungen");
    await setzeEinstellung(t.pg, "maxVerlaengerungen", M);
    const nutzer = await mitglied();
    const frei = await leiheAn(nutzer, { title: "Frei" });
    const vorgemerkt = await leiheAn(nutzer, { title: "Vorgemerkt" });
    await legeVormerkungAn(t.pg, { titleId: vorgemerkt.titleId, memberId: (await mitglied()).id, status: "WARTEND", createdAt: zeitpunkt("2026-11-05") });
    const amMaximum = await leiheAn(nutzer, { title: "Am Maximum", renewalCount: M });

    const liste = await meineAusleihen(nutzer);
    const zu = (loanId: string) => liste.find((x) => x.loanId === loanId);
    expect(zu(frei.loanId)).toMatchObject({ verlaengerbar: true });
    expect(zu(frei.loanId)?.grund ?? undefined).toBeUndefined();
    expect(zu(vorgemerkt.loanId)).toMatchObject({ verlaengerbar: false, grund: "VORMERKUNG_VORHANDEN" });
    expect(zu(amMaximum.loanId)).toMatchObject({ verlaengerbar: false, grund: "MAX_VERLAENGERUNGEN_ERREICHT" });
  });

  it("AK-02.8 die Anzeige stimmt mit dem Ergebnis der Verlängerung überein", async () => {
    const nutzer = await mitglied();
    const vorgemerkt = await leiheAn(nutzer);
    await legeVormerkungAn(t.pg, { titleId: vorgemerkt.titleId, memberId: (await mitglied()).id, status: "WARTEND", createdAt: zeitpunkt("2026-11-05") });

    const [eintrag] = await meineAusleihen(nutzer);
    const ergebnis = await verlaengere(nutzer, vorgemerkt.loanId);
    expect(eintrag.verlaengerbar).toBe(ergebnis.ok);
    if (!ergebnis.ok) expect(eintrag.grund).toBe(ergebnis.fehler);
  });

  it("Prüfreihenfolge (schnittstellen.md): wartende Vormerkung vor Höchstzahl", async () => {
    const M = standardWert("maxVerlaengerungen");
    await setzeEinstellung(t.pg, "maxVerlaengerungen", M);
    const nutzer = await mitglied();
    const ausleihe = await leiheAn(nutzer, { renewalCount: M });
    await legeVormerkungAn(t.pg, { titleId: ausleihe.titleId, memberId: (await mitglied()).id, status: "WARTEND", createdAt: zeitpunkt("2026-11-05") });

    erwarteFehler(await verlaengere(nutzer, ausleihe.loanId), "VORMERKUNG_VORHANDEN");
  });

  it("Prüfreihenfolge (schnittstellen.md): fremder Vorgang vor abgeschlossen", async () => {
    const fremd = await leiheAn(await mitglied(), { returned: true });

    erwarteFehler(await verlaengere(await mitglied(), fremd.loanId), "NICHT_GEFUNDEN");
  });
});

describe("E03-US02-FR03 Neue Fälligkeit und Wirkung auf die Mahnung", () => {
  it("AK-03.1 neue Fälligkeit = Tag der Verlängerung + leihfristTage", async () => {
    await setzeEinstellung(t.pg, "leihfristTage", L);
    const nutzer = await mitglied();
    const ausleihe = await leiheAn(nutzer, { dueDate: plusTage(HEUTE, 3) });

    const daten = erwarteOk(await verlaengere(nutzer, ausleihe.loanId, HEUTE));
    expect(daten.dueDate).toBe(plusTage(HEUTE, L));
    expect((await leseAusleihe(t.pg, ausleihe.loanId))?.due_date).toBe(plusTage(HEUTE, L));
  });

  it("AK-03.1 die Leihfrist kommt aus der Konfiguration (größter erlaubter Wert)", async () => {
    const { max } = grenzen("leihfristTage");
    await setzeEinstellung(t.pg, "leihfristTage", max);
    const nutzer = await mitglied();
    const ausleihe = await leiheAn(nutzer, { dueDate: plusTage(HEUTE, 3) });

    expect(erwarteOk(await verlaengere(nutzer, ausleihe.loanId, HEUTE)).dueDate).toBe(plusTage(HEUTE, max));
  });

  it("AK-03.2 (OF-F06-2) die neue Fälligkeit ist nie früher als die alte; die Verlängerung zählt trotzdem", async () => {
    const { min } = grenzen("leihfristTage");
    await setzeEinstellung(t.pg, "leihfristTage", min);
    const nutzer = await mitglied();
    const alteFaelligkeit = plusTage(HEUTE, min + 5);
    const ausleihe = await leiheAn(nutzer, { dueDate: alteFaelligkeit });

    const daten = erwarteOk(await verlaengere(nutzer, ausleihe.loanId, HEUTE));
    expect(daten).toMatchObject({ dueDate: alteFaelligkeit, renewalCount: 1 });
    expect(await leseAusleihe(t.pg, ausleihe.loanId)).toMatchObject({ due_date: alteFaelligkeit, renewal_count: 1 });
  });

  it.each([
    ["am Fälligkeitstag", 0],
    ["vor der Fälligkeit", -4],
  ])("AK-03.3 Verlängerung %s: danach nicht überfällig, keine Mahnung", async (_wann, versatz) => {
    const nutzer = await mitglied();
    const dueDate = "2026-11-20";
    const ausleihe = await leiheAn(nutzer, { dueDate });
    const verlaengerungstag = plusTage(dueDate, versatz);

    const daten = erwarteOk(await verlaengere(nutzer, ausleihe.loanId, verlaengerungstag));
    expect(daten.dueDate > dueDate).toBe(true);
    expect(daten.mahngebuehrCents ?? null).toBeNull();
    expect((await leseAusleihe(t.pg, ausleihe.loanId))?.overdue_since).toBeNull();
    expect(await leseMahnungen(t.pg, ausleihe.loanId)).toEqual([]);
  });

  it("AK-03.4 (Querverweis E04-US02) Verlängerung nach dem Fälligkeitstag mit bestehender Mahnung: gelingt, Mahnung bleibt offen", async () => {
    const nutzer = await mitglied();
    const dueDate = "2026-11-05";
    const ausleihe = await leiheAn(nutzer, { dueDate });
    const mahnungId = await legeMahnungAn(t.pg, { loanId: ausleihe.loanId, createdOn: "2026-11-06" });

    const daten = erwarteOk(await verlaengere(nutzer, ausleihe.loanId, HEUTE));
    expect(daten.renewalCount).toBe(1);
    const mahnungen = await leseMahnungen(t.pg, ausleihe.loanId);
    expect(mahnungen).toHaveLength(1);
    expect(mahnungen[0]).toMatchObject({ id: mahnungId, settled_at: null });
  });

  it("AK-03.4 nach Fristüberschreitung gilt FR02 weiter: wartende Vormerkung verhindert die Verlängerung", async () => {
    const nutzer = await mitglied();
    const ausleihe = await leiheAn(nutzer, { dueDate: "2026-11-05" });
    await legeMahnungAn(t.pg, { loanId: ausleihe.loanId, createdOn: "2026-11-06" });
    await legeVormerkungAn(t.pg, { titleId: ausleihe.titleId, memberId: (await mitglied()).id, status: "WARTEND", createdAt: zeitpunkt("2026-11-07") });

    erwarteFehler(await verlaengere(nutzer, ausleihe.loanId, HEUTE), "VORMERKUNG_VORHANDEN");
  });

  it("AK-03.5 (Querverweis E04-US02-FR01, FR02) überfällig ohne Mahnung: es entsteht eine offene Mahnung mit Gebühr bis zum Verlängerungstag", async () => {
    const T = standardWert("mahnTagessatzEuro");
    await setzeEinstellung(t.pg, "mahnTagessatzEuro", T);
    const nutzer = await mitglied();
    const dueDate = "2026-11-03";
    const ausleihe = await leiheAn(nutzer, { dueDate });
    const k = tageZwischen(dueDate, HEUTE);

    const daten = erwarteOk(await verlaengere(nutzer, ausleihe.loanId, HEUTE));
    const mahnungen = await leseMahnungen(t.pg, ausleihe.loanId);
    expect(mahnungen).toHaveLength(1);
    expect(mahnungen[0]).toMatchObject({ created_on: HEUTE, fee_cents: gebuehrCents(k, T), settled_at: null });
    expect(daten.mahngebuehrCents).toBe(gebuehrCents(k, T));
  });

  it("AK-03.5 die Gebühr folgt dem gesetzten Tagessatz (größter erlaubter Wert)", async () => {
    const { max } = grenzen("mahnTagessatzEuro");
    await setzeEinstellung(t.pg, "mahnTagessatzEuro", max);
    const nutzer = await mitglied();
    const ausleihe = await leiheAn(nutzer, { dueDate: "2026-11-09" });

    erwarteOk(await verlaengere(nutzer, ausleihe.loanId, HEUTE));
    expect((await leseMahnungen(t.pg, ausleihe.loanId))[0].fee_cents).toBe(gebuehrCents(1, max));
  });

  it("AK-03.5 eine zweite verspätete Verlängerung legt keine zweite Mahnung zum selben Vorgang an", async () => {
    await setzeEinstellung(t.pg, "maxVerlaengerungen", grenzen("maxVerlaengerungen").max);
    const nutzer = await mitglied();
    const ausleihe = await leiheAn(nutzer, { dueDate: "2026-11-03" });

    erwarteOk(await verlaengere(nutzer, ausleihe.loanId, HEUTE));
    erwarteOk(await verlaengere(nutzer, ausleihe.loanId, plusTage(HEUTE, standardWert("leihfristTage") + 2)));
    expect(await zaehle(t.pg, "SELECT count(*) AS n FROM dunnings WHERE loan_id = $1", [ausleihe.loanId])).toBe(1);
  });

  it("AK-03.6 (Querverweis E04-US02-FR03) eine offene Mahnung zu einem anderen Vorgang blockiert die Verlängerung nicht", async () => {
    const nutzer = await mitglied();
    const alt = await leiheAn(nutzer, { returned: true, dueDate: "2026-10-01" });
    await legeMahnungAn(t.pg, { loanId: alt.loanId, createdOn: "2026-10-02", feeCents: 100 });
    const ausleihe = await leiheAn(nutzer);

    erwarteOk(await verlaengere(nutzer, ausleihe.loanId));
  });
});
