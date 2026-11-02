// F-12 · E06-US02 · Rollen und Systemparameter konfigurieren (Spec docs/specs/F-12_E06-US02.md)
// Vertrag: `ladeNutzer`, `rolleZuweisen`, `ladeSystemparameter`, `systemparameterAendern` aus `@/server/administration`.
// Grenzen und Standards aus config/system.defaults.json (ADR 006); Erwartungen werden daraus gerechnet.
import { describe, expect, it } from "vitest";
import defaults from "../../config/system.defaults.json";
import {
  ladeNutzer,
  ladeSystemparameter,
  rolleZuweisen,
  systemparameterAendern,
} from "@/server/administration";
import { erzeugeSitzung, findeSitzung } from "@/server/auth/anmeldung";
import { ausleihen } from "@/server/ausleihe";
import { verlaengern } from "@/server/verlaengerung";
import { rueckgabeErfassen } from "@/server/rueckgabe";
import { getSetting } from "@/server/settings";
import { momentaufnahme, nutzeTestDatenbank, type Rolle } from "../helpers/testdb";
import { erwarteFehler, erwarteOk } from "../helpers/ergebnis";
import {
  legeAusleiheAn,
  legeExemplarAn,
  legeMahnungAn,
  legeNutzerAn,
  legeTitelAn,
  legeVormerkungAn,
  leseAusleihe,
  sitzungFuer,
  zeitpunkt,
  type Nutzer,
} from "../helpers/daten";
import { andererGueltigerWert, gebuehrCents, grenzen, standardWert, type EinstellungName } from "../helpers/konfiguration";
import { festeUhr, plusTage, tageZwischen } from "../helpers/uhr";

const t = nutzeTestDatenbank();
const HEUTE = "2026-11-10";

type Eintrag = { standard: number; min: number; max: number; quelle: string };
const NAMEN = Object.keys(defaults).filter((n) => !n.startsWith("_")) as EinstellungName[];
const ganzzahlig = (name: EinstellungName) => name !== "mahnTagessatzEuro";

async function admin(): Promise<Nutzer> {
  return legeNutzerAn(t.pg, "ADMINISTRATOR");
}

async function als(nutzer: Nutzer, uhr = festeUhr(HEUTE)) {
  return t.kontext(sitzungFuer(nutzer), uhr);
}

async function aendere(name: EinstellungName, wert: unknown, wer?: Nutzer) {
  return systemparameterAendern(await als(wer ?? (await admin())), { name, wert } as { name: string; wert: number });
}

async function rolleIn(userId: string): Promise<string> {
  const { rows } = await t.pg.query<{ role: string }>("SELECT role FROM users WHERE id = $1", [userId]);
  return rows[0].role;
}

describe("E06-US02-FR01 Rollen zuweisen", () => {
  it("AK-01.1 alle Konten mit E-Mail und Rolle, sortiert nach E-Mail", async () => {
    const a = await legeNutzerAn(t.pg, "MITGLIED", "c-mitglied@example.org");
    const b = await legeNutzerAn(t.pg, "BIBLIOTHEKAR", "a-bib@example.org");
    const ich = await legeNutzerAn(t.pg, "ADMINISTRATOR", "b-admin@example.org");
    const liste = erwarteOk(await ladeNutzer(await als(ich)));
    expect(liste).toEqual([
      { userId: b.id, email: "a-bib@example.org", role: "BIBLIOTHEKAR" },
      { userId: ich.id, email: "b-admin@example.org", role: "ADMINISTRATOR" },
      { userId: a.id, email: "c-mitglied@example.org", role: "MITGLIED" },
    ]);
  });

  const wechsel: [Rolle, Rolle][] = [
    ["MITGLIED", "BIBLIOTHEKAR"],
    ["MITGLIED", "ADMINISTRATOR"],
    ["BIBLIOTHEKAR", "MITGLIED"],
    ["BIBLIOTHEKAR", "ADMINISTRATOR"],
    ["ADMINISTRATOR", "MITGLIED"],
    ["ADMINISTRATOR", "BIBLIOTHEKAR"],
    ["MITGLIED", "MITGLIED"],
  ];

  it.each(wechsel)("AK-01.2 (OF-D7) %s → %s: danach genau diese Rolle", async (von, nach) => {
    const konto = await legeNutzerAn(t.pg, von);
    const ergebnis = erwarteOk(await rolleZuweisen(await als(await admin()), { userId: konto.id, role: nach }));
    expect(ergebnis).toEqual({ userId: konto.id, role: nach });
    expect(await rolleIn(konto.id)).toBe(nach);
  });

  it("AK-01.3 die neue Rolle gilt sofort, auch für eine bestehende Sitzung", async () => {
    const konto = await legeNutzerAn(t.pg, "MITGLIED");
    const jetzt = festeUhr(HEUTE).jetzt();
    const { token } = await erzeugeSitzung(t.db, konto.id, jetzt);
    expect((await findeSitzung(t.db, token, jetzt))?.role).toBe("MITGLIED");
    erwarteOk(await rolleZuweisen(await als(await admin()), { userId: konto.id, role: "BIBLIOTHEKAR" }));
    expect(await findeSitzung(t.db, token, jetzt)).toEqual({ userId: konto.id, role: "BIBLIOTHEKAR" });
  });

  it.each(["GAST", "SYSTEM", "mitglied", "", null, 3])("AK-01.4 Rolle %j → VALIDIERUNG (role), nichts ändert sich", async (role) => {
    const konto = await legeNutzerAn(t.pg, "MITGLIED");
    const ich = await admin();
    const vorher = await momentaufnahme(t.pg);
    const felder = erwarteFehler(
      await rolleZuweisen(await als(ich), { userId: konto.id, role } as { userId: string; role: Rolle }),
      "VALIDIERUNG",
    );
    expect(Object.keys(felder)).toContain("role");
    expect(await momentaufnahme(t.pg)).toBe(vorher);
  });

  it.each(["00000000-0000-4000-8000-0000000000aa", "keine-uuid", ""])("AK-01.4 unbekanntes Konto %j → NICHT_GEFUNDEN", async (userId) => {
    const ich = await admin();
    const vorher = await momentaufnahme(t.pg);
    erwarteFehler(await rolleZuweisen(await als(ich), { userId, role: "BIBLIOTHEKAR" }), "NICHT_GEFUNDEN");
    expect(await momentaufnahme(t.pg)).toBe(vorher);
  });

  it.each<Rolle>(["MITGLIED", "BIBLIOTHEKAR", "ADMINISTRATOR"])(
    "AK-01.5 (OF-F12-1) eigene Rolle ändern (auf %s) → EIGENE_ROLLE, nichts ändert sich",
    async (role) => {
      const ich = await admin();
      const vorher = await momentaufnahme(t.pg);
      erwarteFehler(await rolleZuweisen(await als(ich), { userId: ich.id, role }), "EIGENE_ROLLE");
      expect(await momentaufnahme(t.pg)).toBe(vorher);
    },
  );

  it("AK-01.6 (OF-F12-2) Ausleihen, Vormerkungen und Mahnungen bleiben beim Rollenwechsel erhalten", async () => {
    const konto = await legeNutzerAn(t.pg, "MITGLIED");
    const titel = await legeTitelAn(t.pg);
    const ex = await legeExemplarAn(t.pg, titel);
    await legeAusleiheAn(t.pg, { copyId: ex.id, memberId: konto.id, startDate: "2026-10-01", dueDate: "2026-10-29" });
    const alt = await legeExemplarAn(t.pg, await legeTitelAn(t.pg));
    const altLoan = await legeAusleiheAn(t.pg, {
      copyId: alt.id,
      memberId: konto.id,
      startDate: "2026-09-01",
      dueDate: "2026-09-29",
      returnedAt: zeitpunkt("2026-10-02"),
    });
    await legeMahnungAn(t.pg, { loanId: altLoan, createdOn: "2026-10-02", feeCents: 150 });
    await legeVormerkungAn(t.pg, { titleId: await legeTitelAn(t.pg), memberId: konto.id, createdAt: zeitpunkt("2026-11-01"), status: "WARTEND" });

    const tabellen = async () => {
      const teile = [];
      for (const tabelle of ["loans", "reservations", "dunnings"]) {
        teile.push(JSON.stringify((await t.pg.query(`SELECT * FROM ${tabelle} ORDER BY id`)).rows));
      }
      return teile.join("\n");
    };
    const vorher = await tabellen();
    erwarteOk(await rolleZuweisen(await als(await admin()), { userId: konto.id, role: "BIBLIOTHEKAR" }));
    expect(await tabellen()).toBe(vorher);
  });
});

describe("E06-US02-FR02 Systemparameter konfigurieren", () => {
  it("AK-02.1 (OF-F12-3) alle Parameter aus config/system.defaults.json mit Wert, Standard, min, max und Quelle", async () => {
    const liste = erwarteOk(await ladeSystemparameter(await als(await admin())));
    expect(liste.map((p) => p.name)).toEqual(NAMEN);
    for (const name of NAMEN) {
      const e = (defaults as unknown as Record<string, Eintrag>)[name];
      expect(liste.find((p) => p.name === name)).toEqual({ name, wert: e.standard, standard: e.standard, min: e.min, max: e.max, quelle: e.quelle });
    }
    // mindestens die vier Werte aus E06-US02-FR02
    expect(NAMEN).toEqual(expect.arrayContaining(["leihfristTage", "ausleihlimitProMitglied", "maxVerlaengerungen", "mahnTagessatzEuro"]));
  });

  it("AK-02.1 ein geänderter Wert wird als aktueller Wert angezeigt, Standard bleibt", async () => {
    const neu = andererGueltigerWert("leihfristTage", standardWert("leihfristTage"));
    const ich = await admin();
    erwarteOk(await aendere("leihfristTage", neu, ich));
    const eintrag = erwarteOk(await ladeSystemparameter(await als(ich))).find((p) => p.name === "leihfristTage");
    expect(eintrag).toMatchObject({ wert: neu, standard: standardWert("leihfristTage") });
  });

  it.each(NAMEN)("AK-02.2 %s: Wert innerhalb min/max gilt sofort (getSetting)", async (name) => {
    const neu = andererGueltigerWert(name, standardWert(name));
    expect(erwarteOk(await aendere(name, neu))).toEqual({ name, wert: neu });
    expect(await getSetting(t.db, name)).toBe(neu);
  });

  it.each(NAMEN)("AK-02.2 %s: genau min und genau max sind gültig", async (name) => {
    const { min, max } = grenzen(name);
    erwarteOk(await aendere(name, min));
    expect(await getSetting(t.db, name)).toBe(min);
    erwarteOk(await aendere(name, max));
    expect(await getSetting(t.db, name)).toBe(max);
  });

  it("AK-02.3 (Querverweis E03-US01-FR02) neue Leihfrist für neue Ausleihen; bestehende Fälligkeit bleibt", async () => {
    const mitglied = await legeNutzerAn(t.pg, "MITGLIED");
    const titel = await legeTitelAn(t.pg);
    const altEx = await legeExemplarAn(t.pg, titel);
    const altLoan = await legeAusleiheAn(t.pg, { copyId: altEx.id, memberId: mitglied.id, startDate: "2026-11-01", dueDate: "2026-11-29" });
    await legeExemplarAn(t.pg, titel);

    const neu = andererGueltigerWert("leihfristTage", standardWert("leihfristTage"));
    erwarteOk(await aendere("leihfristTage", neu));
    const ausleihe = erwarteOk(await ausleihen(await als(mitglied), { titleId: titel }));
    expect(ausleihe.dueDate).toBe(plusTage(HEUTE, neu));
    expect((await leseAusleihe(t.pg, altLoan))?.due_date).toBe("2026-11-29");
  });

  it("AK-02.4 (Querverweis E03-US01-FR03) neues Ausleihlimit gilt beim nächsten Ausleihen", async () => {
    const mitglied = await legeNutzerAn(t.pg, "MITGLIED");
    const { min } = grenzen("ausleihlimitProMitglied");
    for (let i = 0; i < min; i++) {
      const ex = await legeExemplarAn(t.pg, await legeTitelAn(t.pg));
      await legeAusleiheAn(t.pg, { copyId: ex.id, memberId: mitglied.id, startDate: "2026-11-01", dueDate: "2026-11-29" });
    }
    const titel = await legeTitelAn(t.pg);
    await legeExemplarAn(t.pg, titel);
    erwarteOk(await aendere("ausleihlimitProMitglied", min));
    erwarteFehler(await ausleihen(await als(mitglied), { titleId: titel }), "AUSLEIHLIMIT_ERREICHT");
    erwarteOk(await aendere("ausleihlimitProMitglied", min + 1));
    erwarteOk(await ausleihen(await als(mitglied), { titleId: titel }));
  });

  it("AK-02.5 (Querverweis E03-US02-FR02) neue Höchstzahl an Verlängerungen gilt beim nächsten Verlängern", async () => {
    const mitglied = await legeNutzerAn(t.pg, "MITGLIED");
    const ex = await legeExemplarAn(t.pg, await legeTitelAn(t.pg));
    const loanId = await legeAusleiheAn(t.pg, { copyId: ex.id, memberId: mitglied.id, startDate: "2026-11-01", dueDate: "2026-11-29", renewalCount: 1 });
    erwarteOk(await aendere("maxVerlaengerungen", 1));
    erwarteFehler(await verlaengern(await als(mitglied), { loanId }), "MAX_VERLAENGERUNGEN_ERREICHT");
    erwarteOk(await aendere("maxVerlaengerungen", 2));
    erwarteOk(await verlaengern(await als(mitglied), { loanId }));
  });

  it("AK-02.6 (Querverweis E04-US02-FR02) mit dem neuen Tagessatz wird gerechnet", async () => {
    const mitglied = await legeNutzerAn(t.pg, "MITGLIED");
    const ex = await legeExemplarAn(t.pg, await legeTitelAn(t.pg));
    const dueDate = "2026-11-05";
    await legeAusleiheAn(t.pg, { copyId: ex.id, memberId: mitglied.id, startDate: "2026-10-08", dueDate });
    const satz = andererGueltigerWert("mahnTagessatzEuro", standardWert("mahnTagessatzEuro"));
    erwarteOk(await aendere("mahnTagessatzEuro", satz));
    const bib = await legeNutzerAn(t.pg, "BIBLIOTHEKAR");
    const daten = erwarteOk(await rueckgabeErfassen(await als(bib), { inventoryNumber: ex.inventoryNumber }));
    expect(daten.mahngebuehrCents).toBe(gebuehrCents(tageZwischen(dueDate, HEUTE), satz));
  });

  function ungueltigeWerte(name: EinstellungName): [string, unknown][] {
    const { min, max } = grenzen(name);
    const werte: [string, unknown][] = [
      ["unter min", min - 1],
      ["über max", max + 1],
      ["Text", "abc"],
      ["Zahl als Text", String(min)],
      ["NaN", Number.NaN],
      ["unendlich", Number.POSITIVE_INFINITY],
      ["leer", null],
    ];
    werte.push(ganzzahlig(name) ? ["keine ganze Zahl", min + 0.5] : ["drei Nachkommastellen", min + 0.125]);
    return werte;
  }

  it.each(NAMEN.flatMap((name) => ungueltigeWerte(name).map(([art, wert]) => [name, art, wert] as const)))(
    "AK-02.7 (OF-F12-4) %s: %s → VALIDIERUNG (wert), alter Wert bleibt",
    async (name, _art, wert) => {
      const ich = await admin();
      const vorher = await momentaufnahme(t.pg);
      const felder = erwarteFehler(await aendere(name, wert, ich), "VALIDIERUNG");
      expect(Object.keys(felder)).toContain("wert");
      expect(await momentaufnahme(t.pg)).toBe(vorher);
      expect(await getSetting(t.db, name)).toBe(standardWert(name));
    },
  );

  it("AK-02.7 Tagessatz mit zwei Nachkommastellen ist gültig", async () => {
    const { min, max } = grenzen("mahnTagessatzEuro");
    const wert = Math.min(max, min + 0.25);
    erwarteOk(await aendere("mahnTagessatzEuro", wert));
    expect(await getSetting(t.db, "mahnTagessatzEuro")).toBe(wert);
  });

  it.each(["unbekannterWert", "_hinweis", "", "__proto__", "constructor"])("AK-02.8 Name %j → VALIDIERUNG (name)", async (name) => {
    const ich = await admin();
    const vorher = await momentaufnahme(t.pg);
    const felder = erwarteFehler(
      await systemparameterAendern(await als(ich), { name, wert: 1 } as { name: string; wert: number }),
      "VALIDIERUNG",
    );
    expect(Object.keys(felder)).toContain("name");
    expect(await momentaufnahme(t.pg)).toBe(vorher);
  });

  it("AK-02.9 gespeichert werden Wert, Zeitpunkt und der Administrator", async () => {
    const ich = await admin();
    const uhr = festeUhr(HEUTE, "09:30");
    const neu = andererGueltigerWert("abholfristVormerkungTage", standardWert("abholfristVormerkungTage"));
    erwarteOk(await systemparameterAendern(await als(ich, uhr), { name: "abholfristVormerkungTage", wert: neu }));
    const { rows } = await t.pg.query<{ value: number; updated_at: Date; updated_by_id: string }>(
      "SELECT value, updated_at, updated_by_id FROM system_settings WHERE key = 'abholfristVormerkungTage'",
    );
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].value)).toBe(neu);
    expect(new Date(rows[0].updated_at).getTime()).toBe(uhr.jetzt().getTime());
    expect(rows[0].updated_by_id).toBe(ich.id);
  });

  it("AK-02.9 zweite Änderung überschreibt: weiter genau eine Zeile mit dem letzten Administrator", async () => {
    const erster = await admin();
    const zweiter = await admin();
    const { min, max } = grenzen("leihfristTage");
    erwarteOk(await aendere("leihfristTage", min, erster));
    erwarteOk(await aendere("leihfristTage", max, zweiter));
    const { rows } = await t.pg.query<{ value: number; updated_by_id: string }>(
      "SELECT value, updated_by_id FROM system_settings WHERE key = 'leihfristTage'",
    );
    expect(rows).toEqual([{ value: max, updated_by_id: zweiter.id }]);
  });
});
