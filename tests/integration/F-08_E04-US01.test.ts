// F-08 · E04-US01 · Fällige und überfällige Ausleihen automatisch erkennen
// Spec: docs/specs/F-08_E04-US01.md · Testplan: docs/testing/F-08.md
import { describe, expect, it } from "vitest";
import { fristpruefung } from "@/server/jobs/fristpruefung";
import { benachrichtigungenGelesen, ladeMeineBenachrichtigungen } from "@/server/benachrichtigungen";
import { ausleihen } from "@/server/ausleihe";
import { verlaengern } from "@/server/verlaengerung";
import { rueckgabeErfassen } from "@/server/rueckgabe";
import { momentaufnahme, nutzeTestDatenbank, zaehle } from "../helpers/testdb";
import { erwarteFehler, erwarteOk } from "../helpers/ergebnis";
import { andererGueltigerWert, grenzen, standardWert } from "../helpers/konfiguration";
import { festeUhr, plusTage } from "../helpers/uhr";
import {
  leseAusleihe,
  leseBenachrichtigungen,
  leseJobLaeufe,
  leseMahnungen,
  legeAusleiheAn,
  legeExemplarAn,
  legeNutzerAn,
  legeTitelAn,
  setzeEinstellung,
  sitzungFuer,
  type Nutzer,
} from "../helpers/daten";

const t = nutzeTestDatenbank();

const HEUTE = "2026-11-10";

type Vorgang = { loanId: string; titleId: string; inventoryNumber: string; mitglied: Nutzer; dueDate: string };

async function vorgang(dueDate: string, optionen: { mitglied?: Nutzer; returnedAt?: Date | null; title?: string } = {}): Promise<Vorgang> {
  const titleId = await legeTitelAn(t.pg, { title: optionen.title });
  const exemplar = await legeExemplarAn(t.pg, titleId);
  const mitglied = optionen.mitglied ?? (await legeNutzerAn(t.pg, "MITGLIED"));
  const loanId = await legeAusleiheAn(t.pg, {
    copyId: exemplar.id,
    memberId: mitglied.id,
    startDate: plusTage(dueDate, -standardWert("leihfristTage")),
    dueDate,
    returnedAt: optionen.returnedAt ?? null,
  });
  return { loanId, titleId, inventoryNumber: exemplar.inventoryNumber, mitglied, dueDate };
}

async function lauf(stichtag = HEUTE) {
  return erwarteOk(await fristpruefung(t.kontext(null, festeUhr(stichtag, "02:00"))));
}

async function erinnerungen(loanId?: string) {
  return (await leseBenachrichtigungen(t.pg)).filter((b) => b.type === "ERINNERUNG" && (!loanId || b.loan_id === loanId));
}

describe("E04-US01-FR01 Täglicher Prozess prüft alle offenen Ausleihen gegen das aktuelle Datum", () => {
  it("AK-01.1 alle offenen Vorgänge verschiedener Mitglieder werden gegen den Stichtag geprüft", async () => {
    const V = standardWert("erinnerungVorlaufTage");
    const bald = await vorgang(plusTage(HEUTE, V));
    const spaet = await vorgang(plusTage(HEUTE, -1));
    const spaeter = await vorgang(plusTage(HEUTE, V + 5));

    const ergebnis = await lauf();
    expect(await erinnerungen(bald.loanId)).toHaveLength(1);
    expect((await leseAusleihe(t.pg, spaet.loanId))?.overdue_since).toBe(HEUTE);
    expect(await erinnerungen(spaeter.loanId)).toHaveLength(0);
    expect((await leseAusleihe(t.pg, spaeter.loanId))?.overdue_since).toBeNull();
    expect(ergebnis).toMatchObject({ stichtag: HEUTE, erinnerungen: 1, ueberfaellig: 1, mahnungen: 1 });
  });

  it("AK-01.2 abgeschlossene Vorgänge bekommen weder Erinnerung noch Markierung noch Mahnung", async () => {
    const V = standardWert("erinnerungVorlaufTage");
    const zurueckSpaet = await vorgang(plusTage(HEUTE, -4), { returnedAt: new Date("2026-11-01T10:00:00Z") });
    const zurueckBald = await vorgang(plusTage(HEUTE, V), { returnedAt: new Date("2026-11-09T10:00:00Z") });

    const ergebnis = await lauf();
    expect(await leseBenachrichtigungen(t.pg)).toHaveLength(0);
    expect((await leseAusleihe(t.pg, zurueckSpaet.loanId))?.overdue_since).toBeNull();
    expect((await leseAusleihe(t.pg, zurueckBald.loanId))?.overdue_since).toBeNull();
    expect(await leseMahnungen(t.pg, zurueckSpaet.loanId)).toHaveLength(0);
    expect(ergebnis).toMatchObject({ erinnerungen: 0, ueberfaellig: 0, mahnungen: 0 });
  });

  it("AK-01.3 der Stichtag ist das heutige Datum der Uhr (Europe/Berlin)", async () => {
    const v = await vorgang("2026-11-09");
    // 23:30 Uhr in Berlin am 10.11. ist in UTC schon der 10.11. 22:30 – maßgeblich ist das Berliner Datum
    const ergebnis = erwarteOk(await fristpruefung(t.kontext(null, festeUhr("2026-11-10", "23:30"))));
    expect(ergebnis.stichtag).toBe("2026-11-10");
    expect((await leseAusleihe(t.pg, v.loanId))?.overdue_since).toBe("2026-11-10");
  });

  it("AK-01.4 jeder Lauf schreibt job_runs mit Job, Stichtag, Ende und Anzahlen", async () => {
    await vorgang(plusTage(HEUTE, -2));
    await vorgang(plusTage(HEUTE, standardWert("erinnerungVorlaufTage")));

    await lauf();
    const laeufe = await leseJobLaeufe(t.pg);
    expect(laeufe).toHaveLength(1);
    expect(laeufe[0]).toMatchObject({ job: "FRISTPRUEFUNG", stichtag: HEUTE });
    expect(laeufe[0].finished_at).not.toBeNull();
    expect(laeufe[0].ergebnis).toMatchObject({ erinnerungen: 1, ueberfaellig: 1, mahnungen: 1 });
  });

  it("AK-01.5 (NFR04) zweiter Lauf mit demselben Stichtag ändert nichts außer einem neuen job_runs-Eintrag mit 0", async () => {
    await vorgang(plusTage(HEUTE, -3));
    await vorgang(plusTage(HEUTE, -1));
    await vorgang(plusTage(HEUTE, standardWert("erinnerungVorlaufTage")));
    await vorgang(HEUTE);

    await lauf();
    const ohneLaeufe = async () => (await momentaufnahme(t.pg)).split("\n").filter((z) => !z.startsWith("job_runs:")).join("\n");
    const vorher = await ohneLaeufe();

    const zweiter = await lauf();
    expect(await ohneLaeufe()).toBe(vorher);
    expect(zweiter).toMatchObject({ erinnerungen: 0, ueberfaellig: 0, mahnungen: 0 });
    expect(await leseJobLaeufe(t.pg)).toHaveLength(2);
  });

  it("AK-01.6 (NFR04) fallen Tage aus, holt der nächste Lauf Markierung und Mahnung nach", async () => {
    const taeglich = await vorgang("2026-11-07");
    for (const tag of ["2026-11-08", "2026-11-09"]) await lauf(tag);
    // erst jetzt angelegt: wird nur vom Lauf am 10. geprüft, die Läufe dazwischen „fielen aus“
    const nachgeholt = await vorgang("2026-11-07");
    await lauf("2026-11-10");

    for (const v of [taeglich, nachgeholt]) {
      expect((await leseAusleihe(t.pg, v.loanId))?.overdue_since).toBe("2026-11-08");
      expect(await leseMahnungen(t.pg, v.loanId)).toHaveLength(1);
    }
    expect((await leseMahnungen(t.pg, taeglich.loanId))[0].created_on).toBe("2026-11-08");
    expect((await leseMahnungen(t.pg, nachgeholt.loanId))[0].created_on).toBe("2026-11-10");
  });
});

describe("E04-US01-FR02 Erinnerung, wenn sich die Fälligkeit nähert (Vorlauf erinnerungVorlaufTage)", () => {
  it("AK-02.1 im Vorlauf (F − V bis F) entsteht eine Erinnerung zu Vorgang und Fälligkeit", async () => {
    const V = standardWert("erinnerungVorlaufTage");
    const amAnfang = await vorgang(plusTage(HEUTE, V));
    const amFaelligkeitstag = await vorgang(HEUTE);

    await lauf();
    for (const v of [amAnfang, amFaelligkeitstag]) {
      const liste = await erinnerungen(v.loanId);
      expect(liste).toHaveLength(1);
      expect(liste[0]).toMatchObject({ user_id: v.mitglied.id, due_date: v.dueDate });
    }
  });

  it("AK-02.2 vor dem Vorlauf entsteht keine Erinnerung", async () => {
    const V = standardWert("erinnerungVorlaufTage");
    const v = await vorgang(plusTage(HEUTE, V + 1));
    await lauf();
    expect(await erinnerungen(v.loanId)).toHaveLength(0);
  });

  it("AK-02.3 höchstens eine Erinnerung je Vorgang und Fälligkeit über mehrere Läufe im Vorlauf", async () => {
    const V = Math.max(standardWert("erinnerungVorlaufTage"), 1);
    await setzeEinstellung(t.pg, "erinnerungVorlaufTage", V);
    const v = await vorgang(plusTage(HEUTE, V));
    for (let i = 0; i <= V; i++) await lauf(plusTage(HEUTE, i));
    expect(await erinnerungen(v.loanId)).toHaveLength(1);
  });

  it("AK-02.4 ein schon überfälliger Vorgang bekommt keine Erinnerung mehr (OF-F08-2)", async () => {
    const v = await vorgang(plusTage(HEUTE, -1));
    await lauf();
    expect(await erinnerungen(v.loanId)).toHaveLength(0);
  });

  it("AK-02.5 (Querverweis E03-US02-FR03) nach einer Verlängerung gibt es vor der neuen Fälligkeit wieder eine Erinnerung", async () => {
    const V = standardWert("erinnerungVorlaufTage");
    const v = await vorgang(plusTage(HEUTE, V));
    await lauf();
    const verlaengert = erwarteOk(await verlaengern(t.kontext(sitzungFuer(v.mitglied), festeUhr(HEUTE)), { loanId: v.loanId }));

    await lauf(plusTage(verlaengert.dueDate, -V));
    const liste = await erinnerungen(v.loanId);
    expect(liste.map((b) => b.due_date).sort()).toEqual([v.dueDate, verlaengert.dueDate].sort());
  });

  it("AK-02.6 nur das Mitglied des Vorgangs erhält die Erinnerung", async () => {
    const anderer = await legeNutzerAn(t.pg, "MITGLIED");
    const v = await vorgang(HEUTE);
    await lauf();
    expect(await leseBenachrichtigungen(t.pg, anderer.id)).toHaveLength(0);
    expect(await leseBenachrichtigungen(t.pg, v.mitglied.id)).toHaveLength(1);
  });

  it("AK-02.7 (OF-D8) das Mitglied sieht eigene Benachrichtigungen mit Titel, Inventarnummer und Fälligkeit und markiert sie als gelesen", async () => {
    const v = await vorgang(HEUTE, { title: "Erinnerte Geschichten" });
    const fremd = await vorgang(HEUTE);
    await lauf();
    const k = t.kontext(sitzungFuer(v.mitglied), festeUhr(HEUTE, "09:00"));

    const liste = erwarteOk(await ladeMeineBenachrichtigungen(k));
    expect(liste).toHaveLength(1);
    expect(liste[0]).toMatchObject({
      type: "ERINNERUNG",
      title: "Erinnerte Geschichten",
      inventoryNumber: v.inventoryNumber,
      dueDate: HEUTE,
      gelesen: false,
    });
    expect(JSON.stringify(liste)).not.toContain(fremd.inventoryNumber);

    expect(erwarteOk(await benachrichtigungenGelesen(k))).toMatchObject({ anzahl: 1 });
    expect(erwarteOk(await ladeMeineBenachrichtigungen(k))[0].gelesen).toBe(true);
    // fremde Benachrichtigung bleibt ungelesen
    expect((await leseBenachrichtigungen(t.pg, fremd.mitglied.id))[0].read_at).toBeNull();
  });

  it("AK-02.7 neueste Benachrichtigung zuerst", async () => {
    const mitglied = await legeNutzerAn(t.pg, "MITGLIED");
    await vorgang(plusTage(HEUTE, standardWert("erinnerungVorlaufTage")), { mitglied, title: "Erst später fällig" });
    await lauf(HEUTE);
    await vorgang(plusTage(HEUTE, 1), { mitglied, title: "Morgen fällig" });
    await lauf(plusTage(HEUTE, 1));

    const liste = erwarteOk(await ladeMeineBenachrichtigungen(t.kontext(sitzungFuer(mitglied))));
    expect(liste.map((b) => b.title)).toEqual(["Morgen fällig", "Erst später fällig"]);
  });

  it("AK-02.8 ein anderer gültiger Vorlauf wirkt beim nächsten Lauf", async () => {
    const V = standardWert("erinnerungVorlaufTage");
    const anders = andererGueltigerWert("erinnerungVorlaufTage", V);
    await setzeEinstellung(t.pg, "erinnerungVorlaufTage", anders);
    const genau = await vorgang(plusTage(HEUTE, anders));
    const knappDanach = await vorgang(plusTage(HEUTE, anders + 1));

    await lauf();
    expect(await erinnerungen(genau.loanId)).toHaveLength(1);
    expect(await erinnerungen(knappDanach.loanId)).toHaveLength(0);
  });

  it("AK-02.1 Vorlauf 0: Erinnerung genau am Fälligkeitstag (OF-F08-1)", async () => {
    if (grenzen("erinnerungVorlaufTage").min > 0) return;
    await setzeEinstellung(t.pg, "erinnerungVorlaufTage", 0);
    const heute = await vorgang(HEUTE);
    const morgen = await vorgang(plusTage(HEUTE, 1));
    await lauf();
    expect(await erinnerungen(heute.loanId)).toHaveLength(1);
    expect(await erinnerungen(morgen.loanId)).toHaveLength(0);
  });
});

describe("E04-US01-FR03 Überschrittene Fälligkeit: als überfällig markieren und E04-US02 auslösen", () => {
  it("AK-03.1 overdueSince = Fälligkeit + 1 Tag", async () => {
    const v = await vorgang(plusTage(HEUTE, -5));
    await lauf();
    expect((await leseAusleihe(t.pg, v.loanId))?.overdue_since).toBe(plusTage(HEUTE, -4));
  });

  it("AK-03.2 am Fälligkeitstag ist der Vorgang noch nicht überfällig", async () => {
    const v = await vorgang(HEUTE);
    await lauf();
    expect((await leseAusleihe(t.pg, v.loanId))?.overdue_since).toBeNull();
    expect(await leseMahnungen(t.pg, v.loanId)).toHaveLength(0);
  });

  it("AK-03.3 die Markierung hängt nur von der Fälligkeit ab; spätere Läufe ändern sie nicht", async () => {
    const v = await vorgang("2026-11-05");
    await lauf("2026-11-06");
    await lauf("2026-11-10");
    expect((await leseAusleihe(t.pg, v.loanId))?.overdue_since).toBe("2026-11-06");
  });

  it("AK-03.4 (Querverweis E04-US02-FR01) es entsteht genau eine Mahnung mit Datum = Stichtag", async () => {
    const v = await vorgang(plusTage(HEUTE, -2));
    await lauf();
    await lauf(plusTage(HEUTE, 1));
    const mahnungen = await leseMahnungen(t.pg, v.loanId);
    expect(mahnungen).toHaveLength(1);
    expect(mahnungen[0]).toMatchObject({ loan_id: v.loanId, created_on: HEUTE, settled_at: null });
  });

  it("AK-03.5 (Querverweis E03-US02-FR03) nach verspäteter Verlängerung und erneuter Überschreitung neue Markierung, keine zweite Mahnung", async () => {
    const v = await vorgang("2026-11-05");
    await lauf("2026-11-07");
    const neu = erwarteOk(await verlaengern(t.kontext(sitzungFuer(v.mitglied), festeUhr("2026-11-08")), { loanId: v.loanId }));

    const nachUeberschreitung = plusTage(neu.dueDate, 2);
    await lauf(nachUeberschreitung);
    expect((await leseAusleihe(t.pg, v.loanId))?.overdue_since).toBe(plusTage(neu.dueDate, 1));
    expect(await leseMahnungen(t.pg, v.loanId)).toHaveLength(1);
  });

  it("AK-03.6 (Querverweis E03-US03) vor dem Lauf zurückgegeben → keine Markierung", async () => {
    const v = await vorgang(plusTage(HEUTE, -1));
    const bib = await legeNutzerAn(t.pg, "BIBLIOTHEKAR");
    erwarteOk(await rueckgabeErfassen(t.kontext(sitzungFuer(bib), festeUhr(HEUTE, "01:00")), { inventoryNumber: v.inventoryNumber }));
    await lauf();
    expect((await leseAusleihe(t.pg, v.loanId))?.overdue_since).toBeNull();
    // die Mahnung stammt aus der Rückgabe (F-07), der Lauf legt keine zweite an
    expect(await leseMahnungen(t.pg, v.loanId)).toHaveLength(1);
  });

  it("AK-03.7 (Querverweis E03-US01-FR03, E04-US02-FR03) nach dem Lauf kann das Mitglied nicht mehr ausleihen", async () => {
    const v = await vorgang(plusTage(HEUTE, -1));
    const anderer = await legeTitelAn(t.pg);
    await legeExemplarAn(t.pg, anderer);
    await lauf();
    erwarteFehler(await ausleihen(t.kontext(sitzungFuer(v.mitglied)), { titleId: anderer }), "OFFENE_MAHNUNG");
    expect(await zaehle(t.pg, "SELECT count(*) AS n FROM loans WHERE member_id = $1", [v.mitglied.id])).toBe(1);
  });
});
