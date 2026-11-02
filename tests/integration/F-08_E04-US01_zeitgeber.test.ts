// F-08 · E04-US01-FR01 · Eingebauter Zeitgeber (OF-J3, ADR 007 Punkt 7, Issue #42); dazu F-10 AK-03.11
// Spec: docs/specs/F-08_E04-US01.md (AK-01.8 bis AK-01.10), docs/specs/F-10_E05-US01.md (AK-03.11)
// Vertrag: `fuehreTagesjobsAus(k)` und `starteZeitgeber({ kontext, intervallMs, timer?, melde? })`
// aus `@/server/jobs/zeitgeber` (docs/architektur/schnittstellen.md).
import { describe, expect, it, vi } from "vitest";
import { fuehreTagesjobsAus, starteZeitgeber } from "@/server/jobs/zeitgeber";
import { fristpruefung } from "@/server/jobs/fristpruefung";
import { nutzeTestDatenbank } from "../helpers/testdb";
import { erwarteOk } from "../helpers/ergebnis";
import { standardWert } from "../helpers/konfiguration";
import { festeUhr, plusTage, type Uhr } from "../helpers/uhr";
import {
  leseJobLaeufe,
  leseMahnungen,
  leseVormerkung,
  legeAusleiheAn,
  legeExemplarAn,
  legeNutzerAn,
  legeTitelAn,
  legeVormerkungAn,
  zeitpunkt,
} from "../helpers/daten";

const t = nutzeTestDatenbank();
const HEUTE = "2026-11-10";

/** Uhr, deren Tag sich im Test weiterstellen lässt. */
function stellbareUhr(start: string): Uhr & { stelle(datum: string): void } {
  let aktuell = festeUhr(start, "02:00");
  return {
    heute: () => aktuell.heute(),
    jetzt: () => aktuell.jetzt(),
    stelle(datum: string) {
      aktuell = festeUhr(datum, "02:00");
    },
  };
}

/** Timer, der nichts von selbst auslöst: der Test ruft den gemerkten Takt selbst auf. */
function testTimer() {
  const takte: { fn: () => void; ms: number }[] = [];
  let gestoppt = 0;
  return {
    takte,
    get gestoppt() {
      return gestoppt;
    },
    setInterval: (fn: () => void, ms: number) => {
      takte.push({ fn, ms });
      return takte.length;
    },
    clearInterval: () => {
      gestoppt++;
    },
  };
}

async function ueberfaelligeAusleihe(stichtag: string) {
  const titleId = await legeTitelAn(t.pg);
  const exemplar = await legeExemplarAn(t.pg, titleId);
  const mitglied = await legeNutzerAn(t.pg, "MITGLIED");
  const loanId = await legeAusleiheAn(t.pg, {
    copyId: exemplar.id,
    memberId: mitglied.id,
    startDate: plusTage(stichtag, -30),
    dueDate: plusTage(stichtag, -2),
  });
  return { loanId };
}

async function abgelaufeneAbholung(stichtag: string) {
  const titleId = await legeTitelAn(t.pg);
  const exemplar = await legeExemplarAn(t.pg, titleId);
  const mitglied = await legeNutzerAn(t.pg, "MITGLIED");
  const id = await legeVormerkungAn(t.pg, {
    titleId,
    memberId: mitglied.id,
    status: "ABHOLBEREIT",
    createdAt: zeitpunkt(plusTage(stichtag, -10)),
    copyId: exemplar.id,
    pickupDeadline: plusTage(stichtag, -1),
  });
  return { id };
}

function laeufeAm(laeufe: Awaited<ReturnType<typeof leseJobLaeufe>>, stichtag: string) {
  return laeufe.filter((l) => l.stichtag === stichtag).map((l) => l.job);
}

describe("E04-US01-FR01 Eingebauter Zeitgeber: täglicher Prozess ohne externen Auslöser (OF-J3)", () => {
  it("AK-01.8 noch kein Lauf heute: Fristprüfung läuft, danach Abholfristen (F-10 AK-03.11)", async () => {
    const { loanId } = await ueberfaelligeAusleihe(HEUTE);
    const vormerkung = await abgelaufeneAbholung(HEUTE);

    const ergebnis = erwarteOk(await fuehreTagesjobsAus(t.kontext(null, festeUhr(HEUTE, "02:00"))));
    expect(ergebnis).toEqual({ stichtag: HEUTE, ausgefuehrt: ["FRISTPRUEFUNG", "ABHOLFRISTEN"] });

    const laeufe = await leseJobLaeufe(t.pg);
    expect(laeufe.map((l) => [l.job, l.stichtag])).toEqual([
      ["FRISTPRUEFUNG", HEUTE],
      ["ABHOLFRISTEN", HEUTE],
    ]);
    expect(laeufe.every((l) => l.finished_at !== null)).toBe(true);
    // Wirkung wie beim Endpunkt: Mahnung erzeugt, Abholoption abgelaufen
    expect(await leseMahnungen(t.pg, loanId)).toHaveLength(1);
    expect((await leseVormerkung(t.pg, vormerkung.id))?.status).toBe("ABGELAUFEN");
  });

  it("AK-01.9 (NFR04) am selben Tag läuft nichts zweimal: kein weiterer job_runs-Eintrag", async () => {
    await ueberfaelligeAusleihe(HEUTE);
    const k = t.kontext(null, festeUhr(HEUTE, "02:00"));
    erwarteOk(await fuehreTagesjobsAus(k));
    const vorher = await leseJobLaeufe(t.pg);

    const zweiter = erwarteOk(await fuehreTagesjobsAus(t.kontext(null, festeUhr(HEUTE, "23:30"))));
    expect(zweiter.ausgefuehrt).toEqual([]);
    expect(await leseJobLaeufe(t.pg)).toHaveLength(vorher.length);
  });

  it("AK-01.9 ein Lauf über den Endpunkt zählt als gelaufen: nur die fehlenden Abholfristen laufen", async () => {
    erwarteOk(await fristpruefung(t.kontext(null, festeUhr(HEUTE, "02:00"))));

    const ergebnis = erwarteOk(await fuehreTagesjobsAus(t.kontext(null, festeUhr(HEUTE, "09:00"))));
    expect(ergebnis.ausgefuehrt).toEqual(["ABHOLFRISTEN"]);
    expect(laeufeAm(await leseJobLaeufe(t.pg), HEUTE)).toEqual(["FRISTPRUEFUNG", "ABHOLFRISTEN"]);
  });

  it("AK-01.9 ein abgebrochener Lauf ohne Ende gilt nicht als gelaufen und wird wiederholt", async () => {
    await t.pg.query("INSERT INTO job_runs (job, stichtag, started_at) VALUES ('FRISTPRUEFUNG', $1, now())", [HEUTE]);

    const ergebnis = erwarteOk(await fuehreTagesjobsAus(t.kontext(null, festeUhr(HEUTE, "03:00"))));
    expect(ergebnis.ausgefuehrt).toEqual(["FRISTPRUEFUNG", "ABHOLFRISTEN"]);
    const fertig = (await leseJobLaeufe(t.pg)).filter((l) => l.job === "FRISTPRUEFUNG" && l.finished_at !== null);
    expect(fertig).toHaveLength(1);
  });

  it("AK-01.9 ein Lauf von gestern zählt nicht für heute: am nächsten Tag läuft die Prüfung wieder", async () => {
    const gestern = plusTage(HEUTE, -1);
    erwarteOk(await fuehreTagesjobsAus(t.kontext(null, festeUhr(gestern, "02:00"))));

    const ergebnis = erwarteOk(await fuehreTagesjobsAus(t.kontext(null, festeUhr(HEUTE, "00:30"))));
    expect(ergebnis.ausgefuehrt).toEqual(["FRISTPRUEFUNG", "ABHOLFRISTEN"]);
    expect(laeufeAm(await leseJobLaeufe(t.pg), gestern)).toEqual(["FRISTPRUEFUNG", "ABHOLFRISTEN"]);
    expect(laeufeAm(await leseJobLaeufe(t.pg), HEUTE)).toEqual(["FRISTPRUEFUNG", "ABHOLFRISTEN"]);
  });

  it("AK-01.9 (Querverweis AK-01.6) nach Tagen ohne laufende App holt der erste Lauf alles nach", async () => {
    const { loanId } = await ueberfaelligeAusleihe(plusTage(HEUTE, -5));
    erwarteOk(await fuehreTagesjobsAus(t.kontext(null, festeUhr(HEUTE, "08:00"))));
    const mahnungen = await leseMahnungen(t.pg, loanId);
    expect(mahnungen).toHaveLength(1);
    expect(mahnungen[0].created_on).toBe(HEUTE);
  });
});

describe("E04-US01-FR01 Zeitgeber im Server-Prozess: Start, Takt, Fehler (OF-J3)", () => {
  it("AK-01.8 beim Start sofort prüfen, danach im angegebenen Takt", async () => {
    const uhr = stellbareUhr(HEUTE);
    const timer = testTimer();
    const intervallMs = 3_600_000;
    const zeitgeber = starteZeitgeber({ kontext: async () => t.kontext(null, uhr), intervallMs, timer, melde: () => {} });
    await zeitgeber.bereit;

    expect(laeufeAm(await leseJobLaeufe(t.pg), HEUTE)).toEqual(["FRISTPRUEFUNG", "ABHOLFRISTEN"]);
    expect(timer.takte).toHaveLength(1);
    expect(timer.takte[0].ms).toBe(intervallMs);

    // Takt am selben Tag: nichts Neues
    timer.takte[0].fn();
    await zeitgeber.pruefe();
    expect(await leseJobLaeufe(t.pg)).toHaveLength(2);

    // Takt am nächsten Tag: beide Jobs laufen wieder
    const morgen = plusTage(HEUTE, 1);
    uhr.stelle(morgen);
    timer.takte[0].fn();
    await zeitgeber.pruefe();
    expect(laeufeAm(await leseJobLaeufe(t.pg), morgen)).toEqual(["FRISTPRUEFUNG", "ABHOLFRISTEN"]);

    zeitgeber.stoppen();
    expect(timer.gestoppt).toBe(1);
  });

  it("AK-01.10 nie zwei Läufe gleichzeitig: gleichzeitige Prüfungen ergeben je Job einen Lauf", async () => {
    const timer = testTimer();
    const zeitgeber = starteZeitgeber({
      kontext: async () => t.kontext(null, festeUhr(HEUTE, "02:00")),
      intervallMs: 3_600_000,
      timer,
      melde: () => {},
    });
    await Promise.all([zeitgeber.bereit, zeitgeber.pruefe(), zeitgeber.pruefe()]);
    timer.takte[0].fn();
    await zeitgeber.pruefe();
    expect(laeufeAm(await leseJobLaeufe(t.pg), HEUTE)).toEqual(["FRISTPRUEFUNG", "ABHOLFRISTEN"]);
    zeitgeber.stoppen();
  });

  it("AK-01.10 ein Fehler beendet den Zeitgeber nicht: er wird gemeldet, die nächste Prüfung läuft", async () => {
    const timer = testTimer();
    const melde = vi.fn();
    let versuch = 0;
    const zeitgeber = starteZeitgeber({
      kontext: async () => {
        versuch++;
        if (versuch === 1) throw new Error("Datenbank nicht erreichbar");
        return t.kontext(null, festeUhr(HEUTE, "02:00"));
      },
      intervallMs: 3_600_000,
      timer,
      melde,
    });
    await expect(zeitgeber.bereit).resolves.toBeUndefined();
    expect(melde).toHaveBeenCalledTimes(1);
    expect(await leseJobLaeufe(t.pg)).toHaveLength(0);

    timer.takte[0].fn();
    await zeitgeber.pruefe();
    expect(laeufeAm(await leseJobLaeufe(t.pg), HEUTE)).toEqual(["FRISTPRUEFUNG", "ABHOLFRISTEN"]);
    zeitgeber.stoppen();
  });

  it("AK-01.8 der Zeitgeber nutzt nur Werte aus der Konfiguration (Vorlauf), keine eigenen Fristen", async () => {
    // Erinnerung genau am Rand des Vorlaufs: entsteht durch den Zeitgeber wie durch den Endpunkt
    const vorlauf = standardWert("erinnerungVorlaufTage");
    const titleId = await legeTitelAn(t.pg);
    const exemplar = await legeExemplarAn(t.pg, titleId);
    const mitglied = await legeNutzerAn(t.pg, "MITGLIED");
    await legeAusleiheAn(t.pg, {
      copyId: exemplar.id,
      memberId: mitglied.id,
      startDate: plusTage(HEUTE, -10),
      dueDate: plusTage(HEUTE, vorlauf),
    });
    erwarteOk(await fuehreTagesjobsAus(t.kontext(null, festeUhr(HEUTE, "02:00"))));
    const [lauf] = (await leseJobLaeufe(t.pg)).filter((l) => l.job === "FRISTPRUEFUNG");
    expect(lauf.ergebnis).toMatchObject({ erinnerungen: 1 });
  });
});
