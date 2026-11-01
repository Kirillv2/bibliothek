// F-10 · E05-US01 · Titel vormerken (Warteschlange)
// Spec: docs/specs/F-10_E05-US01.md · Testplan: docs/testing/F-10.md
import { describe, expect, it } from "vitest";
import { ladeMeineVormerkungen, vormerken } from "@/server/vormerkung";
import { abholfristen } from "@/server/jobs/abholfristen";
import { ausleihen } from "@/server/ausleihe";
import { verlaengern } from "@/server/verlaengerung";
import { rueckgabeErfassen } from "@/server/rueckgabe";
import { exemplarAnlegen, exemplarZustandAendern } from "@/server/exemplare";
import { ladeTitelDetail } from "@/server/katalog/detail";
import { ladeMeineBenachrichtigungen } from "@/server/benachrichtigungen";
import { momentaufnahme, nutzeTestDatenbank, zaehle } from "../helpers/testdb";
import { erwarteFehler, erwarteOk } from "../helpers/ergebnis";
import { andererGueltigerWert, standardWert } from "../helpers/konfiguration";
import { festeUhr, plusTage } from "../helpers/uhr";
import {
  leseBenachrichtigungen,
  leseJobLaeufe,
  leseVormerkung,
  legeAusleiheAn,
  legeExemplarAn,
  legeMahnungAn,
  legeNutzerAn,
  legeTitelAn,
  legeVormerkungAn,
  setzeEinstellung,
  sitzungFuer,
  zeitpunkt,
  type Exemplar,
  type Nutzer,
} from "../helpers/daten";

const t = nutzeTestDatenbank();

const HEUTE = "2026-11-10";

/** Titel mit einem Exemplar, das ein anderes Mitglied ausgeliehen hat (kein Exemplar verfügbar). */
async function verliehenerTitel(title?: string): Promise<{ titleId: string; exemplar: Exemplar; leiher: Nutzer }> {
  const titleId = await legeTitelAn(t.pg, { title });
  const exemplar = await legeExemplarAn(t.pg, titleId);
  const leiher = await legeNutzerAn(t.pg, "MITGLIED");
  await legeAusleiheAn(t.pg, { copyId: exemplar.id, memberId: leiher.id, startDate: "2026-10-20", dueDate: "2026-11-17" });
  return { titleId, exemplar, leiher };
}

async function mitglied(): Promise<Nutzer> {
  return legeNutzerAn(t.pg, "MITGLIED");
}

async function merkeVor(nutzer: Nutzer, titleId: string, tag = HEUTE, uhrzeit = "12:00") {
  return vormerken(t.kontext(sitzungFuer(nutzer), festeUhr(tag, uhrzeit)), { titleId });
}

async function zurueck(inventoryNumber: string, tag = HEUTE) {
  const bib = await legeNutzerAn(t.pg, "BIBLIOTHEKAR");
  return erwarteOk(await rueckgabeErfassen(t.kontext(sitzungFuer(bib), festeUhr(tag, "10:00")), { inventoryNumber }));
}

async function lauf(stichtag: string) {
  return erwarteOk(await abholfristen(t.kontext(null, festeUhr(stichtag, "02:00"))));
}

async function bibliothekar() {
  return sitzungFuer(await legeNutzerAn(t.pg, "BIBLIOTHEKAR"));
}

describe("E05-US01-FR01 Vormerkung nur, wenn kein Exemplar verfügbar ist", () => {
  it("AK-01.1 alle Exemplare ausgeliehen: Vormerkung WARTEND mit Zeitpunkt jetzt für das Mitglied aus der Sitzung", async () => {
    const { titleId } = await verliehenerTitel();
    const a = await mitglied();

    const daten = erwarteOk(await merkeVor(a, titleId, HEUTE, "09:15"));
    expect(daten.position).toBe(1);
    const zeile = await leseVormerkung(t.pg, daten.reservationId);
    expect(zeile).toMatchObject({ member_id: a.id, status: "WARTEND", copy_id: null, pickup_deadline: null });
    const { rows } = await t.pg.query<{ created_at: Date }>("SELECT created_at FROM reservations WHERE id = $1", [daten.reservationId]);
    expect(rows[0].created_at.toISOString()).toBe(festeUhr(HEUTE, "09:15").jetzt().toISOString());
  });

  it("AK-01.1 auch ohne Exemplare oder wenn alle verloren sind, kann vorgemerkt werden", async () => {
    const ohne = await legeTitelAn(t.pg);
    const verloren = await legeTitelAn(t.pg);
    await legeExemplarAn(t.pg, verloren, { condition: "VERLOREN" });
    erwarteOk(await merkeVor(await mitglied(), ohne));
    erwarteOk(await merkeVor(await mitglied(), verloren));
  });

  it("AK-01.2 ein Exemplar ist verfügbar → EXEMPLAR_VERFUEGBAR, keine Vormerkung", async () => {
    const titleId = await legeTitelAn(t.pg);
    await legeExemplarAn(t.pg, titleId);
    const a = await mitglied();
    const vorher = await momentaufnahme(t.pg);
    erwarteFehler(await merkeVor(a, titleId), "EXEMPLAR_VERFUEGBAR");
    expect(await momentaufnahme(t.pg)).toBe(vorher);
  });

  it("AK-01.3 unbekannter oder archivierter Titel → NICHT_GEFUNDEN", async () => {
    const archiviert = await legeTitelAn(t.pg, { archiviert: true });
    const a = await mitglied();
    erwarteFehler(await merkeVor(a, archiviert), "NICHT_GEFUNDEN");
    erwarteFehler(await merkeVor(a, "00000000-0000-4000-8000-000000000000"), "NICHT_GEFUNDEN");
    erwarteFehler(await merkeVor(a, "keine-uuid"), "NICHT_GEFUNDEN");
    expect(await zaehle(t.pg, "SELECT count(*) AS n FROM reservations")).toBe(0);
  });

  it("AK-01.4 (OF-F10-2) schon aktiv vorgemerkt (wartend oder abholbereit) → BEREITS_VORGEMERKT", async () => {
    const { titleId } = await verliehenerTitel();
    const a = await mitglied();
    erwarteOk(await merkeVor(a, titleId));
    erwarteFehler(await merkeVor(a, titleId), "BEREITS_VORGEMERKT");

    const b = await mitglied();
    const zweiter = await verliehenerTitel();
    await legeVormerkungAn(t.pg, {
      titleId: zweiter.titleId,
      memberId: b.id,
      status: "ABHOLBEREIT",
      createdAt: zeitpunkt("2026-11-01"),
      copyId: zweiter.exemplar.id,
      pickupDeadline: plusTage(HEUTE, 1),
    });
    erwarteFehler(await merkeVor(b, zweiter.titleId), "BEREITS_VORGEMERKT");
    expect(await zaehle(t.pg, "SELECT count(*) AS n FROM reservations")).toBe(2);
  });

  it("AK-01.4 eine abgelaufene oder abgeholte Vormerkung hindert nicht am neuen Vormerken", async () => {
    const { titleId } = await verliehenerTitel();
    const a = await mitglied();
    await legeVormerkungAn(t.pg, { titleId, memberId: a.id, status: "ABGELAUFEN", createdAt: zeitpunkt("2026-10-01") });
    await legeVormerkungAn(t.pg, { titleId, memberId: a.id, status: "ABGEHOLT", createdAt: zeitpunkt("2026-09-01") });
    erwarteOk(await merkeVor(a, titleId));
  });

  it("AK-01.5 (Querverweis E01-US02-FR03, OF-F02-1) Detailseite: Vormerken angeboten; nach dem Vormerken eigener Stand statt Aktion", async () => {
    const { titleId } = await verliehenerTitel();
    const a = await mitglied();
    const b = await mitglied();
    const vorher = erwarteOk(await ladeTitelDetail(t.kontext(sitzungFuer(a)), titleId));
    expect(vorher.aktionen.vormerken).toBe(true);
    expect(vorher.meineVormerkung).toBeUndefined();

    erwarteOk(await merkeVor(b, titleId, HEUTE, "08:00"));
    erwarteOk(await merkeVor(a, titleId, HEUTE, "09:00"));
    const nachher = erwarteOk(await ladeTitelDetail(t.kontext(sitzungFuer(a)), titleId));
    expect(nachher.aktionen.vormerken).toBe(false);
    expect(nachher.meineVormerkung).toEqual({ status: "WARTEND", position: 2 });
    // Gast und andere sehen nichts von fremden Vormerkungen
    expect(erwarteOk(await ladeTitelDetail(t.kontext(null), titleId)).meineVormerkung).toBeUndefined();
  });

  it("AK-01.6 Prüfreihenfolge: Titel aktiv vor schon vorgemerkt vor Exemplar verfügbar", async () => {
    const titleId = await legeTitelAn(t.pg);
    const a = await mitglied();
    await legeVormerkungAn(t.pg, { titleId, memberId: a.id, status: "WARTEND", createdAt: zeitpunkt("2026-11-01") });
    await legeExemplarAn(t.pg, titleId);
    // schon vorgemerkt und ein Exemplar verfügbar → BEREITS_VORGEMERKT
    erwarteFehler(await merkeVor(a, titleId), "BEREITS_VORGEMERKT");
    await t.pg.query("UPDATE titles SET archived_at = now() WHERE id = $1", [titleId]);
    erwarteFehler(await merkeVor(a, titleId), "NICHT_GEFUNDEN");
  });
});

describe("E05-US01-FR02 Warteschlange je Titel nach Zeitpunkt", () => {
  it("AK-02.1 A vor B → Platz 1 und 2; bei gleichem Zeitpunkt feste Reihenfolge", async () => {
    const { titleId } = await verliehenerTitel();
    const a = await mitglied();
    const b = await mitglied();
    expect(erwarteOk(await merkeVor(a, titleId, HEUTE, "08:00")).position).toBe(1);
    expect(erwarteOk(await merkeVor(b, titleId, HEUTE, "09:00")).position).toBe(2);

    const zweiter = await verliehenerTitel();
    const c = await mitglied();
    const d = await mitglied();
    erwarteOk(await merkeVor(c, zweiter.titleId, HEUTE, "10:00"));
    erwarteOk(await merkeVor(d, zweiter.titleId, HEUTE, "10:00"));
    const pc = erwarteOk(await ladeMeineVormerkungen(t.kontext(sitzungFuer(c))))[0].position;
    const pd = erwarteOk(await ladeMeineVormerkungen(t.kontext(sitzungFuer(d))))[0].position;
    expect([pc, pd].sort()).toEqual([1, 2]);
  });

  it("AK-02.2 Vormerkungen anderer Titel beeinflussen die Plätze nicht", async () => {
    const eins = await verliehenerTitel();
    const zwei = await verliehenerTitel();
    erwarteOk(await merkeVor(await mitglied(), zwei.titleId, HEUTE, "07:00"));
    expect(erwarteOk(await merkeVor(await mitglied(), eins.titleId, HEUTE, "08:00")).position).toBe(1);
  });

  it("AK-02.3 Meine Vormerkungen: Titel, Status, Platz bzw. Inventarnummer und letzter Abholtag; keine fremden", async () => {
    const a = await mitglied();
    const wartet = await verliehenerTitel("Wartender Titel");
    await merkeVor(await mitglied(), wartet.titleId, HEUTE, "07:00");
    erwarteOk(await merkeVor(a, wartet.titleId, HEUTE, "08:00"));
    const bereit = await verliehenerTitel("Bereiter Titel");
    erwarteOk(await merkeVor(a, bereit.titleId, HEUTE, "08:00"));
    await zurueck(bereit.exemplar.inventoryNumber, HEUTE);

    const liste = erwarteOk(await ladeMeineVormerkungen(t.kontext(sitzungFuer(a))));
    expect(liste).toHaveLength(2);
    expect(liste.find((v) => v.title === "Wartender Titel")).toMatchObject({ status: "WARTEND", position: 2 });
    expect(liste.find((v) => v.title === "Bereiter Titel")).toMatchObject({
      status: "ABHOLBEREIT",
      inventoryNumber: bereit.exemplar.inventoryNumber,
      pickupDeadline: plusTage(HEUTE, standardWert("abholfristVormerkungTage")),
    });
    expect(JSON.stringify(liste)).not.toMatch(/member|email/i);
  });

  it("AK-02.4 (Querverweis E03-US02-FR02) solange vorgemerkt ist, kann der Leiher nicht verlängern", async () => {
    const titleId = await legeTitelAn(t.pg);
    const exemplar = await legeExemplarAn(t.pg, titleId);
    const leiher = await mitglied();
    const loanId = await legeAusleiheAn(t.pg, { copyId: exemplar.id, memberId: leiher.id, startDate: "2026-10-20", dueDate: "2026-11-17" });
    erwarteOk(await merkeVor(await mitglied(), titleId));
    erwarteFehler(await verlaengern(t.kontext(sitzungFuer(leiher)), { loanId }), "VORMERKUNG_VORHANDEN");
  });
});

describe("E05-US01-FR03 Benachrichtigung, befristete Abholoption, Nachrücken", () => {
  it("AK-03.1 (Querverweis E03-US03-FR03) Rückgabe → erste Person abholbereit mit Abholtag und Benachrichtigung", async () => {
    const { titleId, exemplar } = await verliehenerTitel();
    const a = await mitglied();
    const b = await mitglied();
    const va = erwarteOk(await merkeVor(a, titleId, HEUTE, "08:00"));
    const vb = erwarteOk(await merkeVor(b, titleId, HEUTE, "09:00"));
    await zurueck(exemplar.inventoryNumber, "2026-11-12");

    expect(await leseVormerkung(t.pg, va.reservationId)).toMatchObject({
      status: "ABHOLBEREIT",
      copy_id: exemplar.id,
      pickup_deadline: plusTage("2026-11-12", standardWert("abholfristVormerkungTage")),
    });
    expect((await leseVormerkung(t.pg, vb.reservationId))?.status).toBe("WARTEND");
    expect((await leseBenachrichtigungen(t.pg, a.id)).map((n) => n.type)).toEqual(["ABHOLBEREIT"]);
    expect(await leseBenachrichtigungen(t.pg, b.id)).toHaveLength(0);
  });

  it("AK-03.2 die Person sieht die Benachrichtigung mit Titel, Inventarnummer und letztem Abholtag", async () => {
    const { titleId, exemplar } = await verliehenerTitel("Abholbuch");
    const a = await mitglied();
    erwarteOk(await merkeVor(a, titleId));
    await zurueck(exemplar.inventoryNumber, HEUTE);
    const [n] = erwarteOk(await ladeMeineBenachrichtigungen(t.kontext(sitzungFuer(a))));
    expect(n).toMatchObject({
      type: "ABHOLBEREIT",
      title: "Abholbuch",
      inventoryNumber: exemplar.inventoryNumber,
      pickupDeadline: plusTage(HEUTE, standardWert("abholfristVormerkungTage")),
      gelesen: false,
    });
  });

  it("AK-03.3 (OF-F10-3) Abholen = Ausleihen: die Person bekommt das zugeordnete Exemplar, Vormerkung ABGEHOLT", async () => {
    const { titleId, exemplar } = await verliehenerTitel();
    const a = await mitglied();
    const va = erwarteOk(await merkeVor(a, titleId));
    await zurueck(exemplar.inventoryNumber, HEUTE);
    const letzterTag = plusTage(HEUTE, standardWert("abholfristVormerkungTage"));

    const ausleihe = erwarteOk(await ausleihen(t.kontext(sitzungFuer(a), festeUhr(letzterTag)), { titleId }));
    expect(ausleihe.inventoryNumber).toBe(exemplar.inventoryNumber);
    expect((await leseVormerkung(t.pg, va.reservationId))?.status).toBe("ABGEHOLT");
    // Detailseite: danach ausgeliehen, kein „vorgemerkt“ mehr
    const detail = erwarteOk(await ladeTitelDetail(t.kontext(null), titleId));
    expect(detail.exemplare[0].status).toBe("AUSGELIEHEN");
  });

  it("AK-03.3 die Detailseite bietet der Person mit abholbereiter Vormerkung „Ausleihen“ an, anderen nicht", async () => {
    const { titleId, exemplar } = await verliehenerTitel();
    const a = await mitglied();
    const b = await mitglied();
    erwarteOk(await merkeVor(a, titleId));
    await zurueck(exemplar.inventoryNumber, HEUTE);

    const fuerA = erwarteOk(await ladeTitelDetail(t.kontext(sitzungFuer(a)), titleId));
    expect(fuerA.aktionen.ausleihen).toBe(true);
    expect(fuerA.meineVormerkung).toEqual({ status: "ABHOLBEREIT", pickupDeadline: plusTage(HEUTE, standardWert("abholfristVormerkungTage")) });
    expect(erwarteOk(await ladeTitelDetail(t.kontext(sitzungFuer(b)), titleId)).aktionen).toEqual({ ausleihen: false, vormerken: true });
  });

  it("AK-03.3 offene Mahnung oder Limit verhindern das Abholen; die Abholoption bleibt bestehen", async () => {
    const { titleId, exemplar } = await verliehenerTitel();
    const a = await mitglied();
    const va = erwarteOk(await merkeVor(a, titleId));
    await zurueck(exemplar.inventoryNumber, HEUTE);
    // offene Mahnung zu einem alten Vorgang
    const alt = await legeTitelAn(t.pg);
    const altEx = await legeExemplarAn(t.pg, alt);
    const altLoan = await legeAusleiheAn(t.pg, {
      copyId: altEx.id,
      memberId: a.id,
      startDate: "2026-09-01",
      dueDate: "2026-09-29",
      returnedAt: new Date("2026-10-05T10:00:00Z"),
    });
    await legeMahnungAn(t.pg, { loanId: altLoan, createdOn: "2026-10-05", feeCents: 300 });

    erwarteFehler(await ausleihen(t.kontext(sitzungFuer(a)), { titleId }), "OFFENE_MAHNUNG");
    expect(await leseVormerkung(t.pg, va.reservationId)).toMatchObject({ status: "ABHOLBEREIT", copy_id: exemplar.id });
  });

  it("AK-03.4 niemand sonst kann das zugeordnete Exemplar ausleihen", async () => {
    const { titleId, exemplar } = await verliehenerTitel();
    const a = await mitglied();
    erwarteOk(await merkeVor(a, titleId));
    await zurueck(exemplar.inventoryNumber, HEUTE);
    erwarteFehler(await ausleihen(t.kontext(sitzungFuer(await mitglied())), { titleId }), "KEIN_EXEMPLAR_VERFUEGBAR");
  });

  it("AK-03.5 Abholfrist vorbei → ABGELAUFEN, Exemplar an die nächste Person mit neuer Frist und Benachrichtigung", async () => {
    const F = standardWert("abholfristVormerkungTage");
    const { titleId, exemplar } = await verliehenerTitel();
    const a = await mitglied();
    const b = await mitglied();
    const va = erwarteOk(await merkeVor(a, titleId, HEUTE, "08:00"));
    const vb = erwarteOk(await merkeVor(b, titleId, HEUTE, "09:00"));
    await zurueck(exemplar.inventoryNumber, HEUTE);
    const letzterTag = plusTage(HEUTE, F);

    // am letzten Abholtag läuft nichts ab
    expect(await lauf(letzterTag)).toMatchObject({ abgelaufen: 0, nachgerueckt: 0 });
    expect((await leseVormerkung(t.pg, va.reservationId))?.status).toBe("ABHOLBEREIT");

    const tagDanach = plusTage(letzterTag, 1);
    expect(await lauf(tagDanach)).toMatchObject({ stichtag: tagDanach, abgelaufen: 1, nachgerueckt: 1 });
    expect((await leseVormerkung(t.pg, va.reservationId))?.status).toBe("ABGELAUFEN");
    expect(await leseVormerkung(t.pg, vb.reservationId)).toMatchObject({
      status: "ABHOLBEREIT",
      copy_id: exemplar.id,
      pickup_deadline: plusTage(tagDanach, F),
    });
    expect((await leseBenachrichtigungen(t.pg, b.id)).map((n) => n.type)).toEqual(["ABHOLBEREIT"]);
  });

  it("AK-03.5 ein anderer gültiger Wert für die Abholfrist wirkt", async () => {
    const F2 = andererGueltigerWert("abholfristVormerkungTage", standardWert("abholfristVormerkungTage"));
    await setzeEinstellung(t.pg, "abholfristVormerkungTage", F2);
    const { titleId, exemplar } = await verliehenerTitel();
    const va = erwarteOk(await merkeVor(await mitglied(), titleId));
    await zurueck(exemplar.inventoryNumber, HEUTE);
    expect((await leseVormerkung(t.pg, va.reservationId))?.pickup_deadline).toBe(plusTage(HEUTE, F2));
  });

  it("AK-03.6 wartet niemand mehr, wird das Exemplar nach dem Ablauf frei verfügbar", async () => {
    const F = standardWert("abholfristVormerkungTage");
    const { titleId, exemplar } = await verliehenerTitel();
    erwarteOk(await merkeVor(await mitglied(), titleId));
    await zurueck(exemplar.inventoryNumber, HEUTE);
    expect(erwarteOk(await ladeTitelDetail(t.kontext(null), titleId)).exemplare[0].status).toBe("VORGEMERKT");

    expect(await lauf(plusTage(HEUTE, F + 1))).toMatchObject({ abgelaufen: 1, nachgerueckt: 0 });
    expect(erwarteOk(await ladeTitelDetail(t.kontext(null), titleId)).exemplare[0].status).toBe("VERFUEGBAR");
    erwarteOk(await ausleihen(t.kontext(sitzungFuer(await mitglied())), { titleId }));
  });

  it("AK-03.7 (NFR04) zweiter Lauf mit demselben Stichtag ändert nichts; job_runs mit Anzahlen", async () => {
    const F = standardWert("abholfristVormerkungTage");
    const { titleId, exemplar } = await verliehenerTitel();
    erwarteOk(await merkeVor(await mitglied(), titleId, HEUTE, "08:00"));
    erwarteOk(await merkeVor(await mitglied(), titleId, HEUTE, "09:00"));
    await zurueck(exemplar.inventoryNumber, HEUTE);
    const tag = plusTage(HEUTE, F + 1);

    await lauf(tag);
    const ohneLaeufe = async () => (await momentaufnahme(t.pg)).split("\n").filter((z) => !z.startsWith("job_runs:")).join("\n");
    const vorher = await ohneLaeufe();
    expect(await lauf(tag)).toMatchObject({ abgelaufen: 0, nachgerueckt: 0 });
    expect(await ohneLaeufe()).toBe(vorher);

    const laeufe = await leseJobLaeufe(t.pg);
    expect(laeufe.map((l) => l.job)).toEqual(["ABHOLFRISTEN", "ABHOLFRISTEN"]);
    expect(laeufe[0]).toMatchObject({ stichtag: tag, ergebnis: { abgelaufen: 1, nachgerueckt: 1 } });
    expect(laeufe[0].finished_at).not.toBeNull();
  });

  it("AK-03.8 (OF-F10-1) neues Exemplar geht an die erste wartende Vormerkung", async () => {
    const { titleId } = await verliehenerTitel();
    const a = await mitglied();
    const va = erwarteOk(await merkeVor(a, titleId));
    const neu = erwarteOk(await exemplarAnlegen(t.kontext(await bibliothekar(), festeUhr(HEUTE, "11:00")), { titleId }));

    expect(await leseVormerkung(t.pg, va.reservationId)).toMatchObject({
      status: "ABHOLBEREIT",
      copy_id: neu.copyId,
      pickup_deadline: plusTage(HEUTE, standardWert("abholfristVormerkungTage")),
    });
    expect((await leseBenachrichtigungen(t.pg, a.id)).map((n) => n.type)).toEqual(["ABHOLBEREIT"]);
  });

  it("AK-03.8 neues verlorenes Exemplar wird keiner Vormerkung zugeordnet", async () => {
    const { titleId } = await verliehenerTitel();
    const va = erwarteOk(await merkeVor(await mitglied(), titleId));
    erwarteOk(await exemplarAnlegen(t.kontext(await bibliothekar()), { titleId, condition: "VERLOREN" }));
    expect((await leseVormerkung(t.pg, va.reservationId))?.status).toBe("WARTEND");
  });

  it("AK-03.8 Zustand von „verloren“ auf „gut“ bzw. „beschädigt“: Exemplar geht an die erste wartende Vormerkung", async () => {
    for (const neuerZustand of ["GUT", "BESCHAEDIGT"] as const) {
      const titleId = await legeTitelAn(t.pg);
      const verloren = await legeExemplarAn(t.pg, titleId, { condition: "VERLOREN" });
      const va = erwarteOk(await merkeVor(await mitglied(), titleId));
      erwarteOk(await exemplarZustandAendern(t.kontext(await bibliothekar()), { copyId: verloren.id, condition: neuerZustand }));
      expect(await leseVormerkung(t.pg, va.reservationId)).toMatchObject({ status: "ABHOLBEREIT", copy_id: verloren.id });
    }
  });

  it("AK-03.8 ohne wartende Vormerkung bleibt ein neues Exemplar frei verfügbar", async () => {
    const titleId = await legeTitelAn(t.pg);
    erwarteOk(await exemplarAnlegen(t.kontext(await bibliothekar()), { titleId }));
    expect(erwarteOk(await ladeTitelDetail(t.kontext(null), titleId)).exemplare[0].status).toBe("VERFUEGBAR");
  });

  it("AK-03.8 ein ausgeliehenes Exemplar, dessen Zustand wechselt, wird keiner Vormerkung zugeordnet", async () => {
    const { titleId, exemplar } = await verliehenerTitel();
    const va = erwarteOk(await merkeVor(await mitglied(), titleId));
    erwarteOk(await exemplarZustandAendern(t.kontext(await bibliothekar()), { copyId: exemplar.id, condition: "BESCHAEDIGT" }));
    expect((await leseVormerkung(t.pg, va.reservationId))?.status).toBe("WARTEND");
  });

  it("AK-03.9 (OF-F10-4) zugeordnetes Exemplar wird verloren → Vormerkung wieder WARTEND mit Platz 1", async () => {
    const { titleId, exemplar } = await verliehenerTitel();
    const a = await mitglied();
    const b = await mitglied();
    const va = erwarteOk(await merkeVor(a, titleId, HEUTE, "08:00"));
    erwarteOk(await merkeVor(b, titleId, HEUTE, "09:00"));
    await zurueck(exemplar.inventoryNumber, HEUTE);

    erwarteOk(await exemplarZustandAendern(t.kontext(await bibliothekar()), { copyId: exemplar.id, condition: "VERLOREN" }));
    expect(await leseVormerkung(t.pg, va.reservationId)).toMatchObject({ status: "WARTEND", copy_id: null, pickup_deadline: null });
    expect(erwarteOk(await ladeMeineVormerkungen(t.kontext(sitzungFuer(a))))[0]).toMatchObject({ status: "WARTEND", position: 1 });
  });

  it("AK-03.10 (OF-F10-5) abgelaufene Vormerkung kommt nicht zurück; neu vormerken ist möglich", async () => {
    const F = standardWert("abholfristVormerkungTage");
    const { titleId, exemplar } = await verliehenerTitel();
    const a = await mitglied();
    erwarteOk(await merkeVor(a, titleId));
    await zurueck(exemplar.inventoryNumber, HEUTE);
    // Exemplar wird nach Ablauf frei und gleich wieder ausgeliehen
    const tag = plusTage(HEUTE, F + 1);
    await lauf(tag);
    erwarteOk(await ausleihen(t.kontext(sitzungFuer(await mitglied()), festeUhr(tag)), { titleId }));

    expect(erwarteOk(await ladeMeineVormerkungen(t.kontext(sitzungFuer(a))))).toEqual([]);
    erwarteOk(await merkeVor(a, titleId, tag));
  });
});
