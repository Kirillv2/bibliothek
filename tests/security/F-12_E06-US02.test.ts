// F-12 · E06-US02 · Rechte-Tests Rollen und Systemparameter
// Rechte-Matrix: nur Administrator. Gast → NICHT_ANGEMELDET; Mitglied und Bibliothekar → KEINE_BERECHTIGUNG,
// nichts ändert sich. Die Nutzerliste enthält keine Passwort-Hashes; wer geändert hat, kommt aus der Sitzung.
import { describe, expect, it } from "vitest";
import { ladeNutzer, ladeSystemparameter, rolleZuweisen, systemparameterAendern } from "@/server/administration";
import { momentaufnahme, nutzeTestDatenbank, type Rolle } from "../helpers/testdb";
import { erwarteFehler, erwarteOk, type Fehlercode } from "../helpers/ergebnis";
import { legeNutzerAn, sitzungFuer } from "../helpers/daten";
import { andererGueltigerWert, standardWert } from "../helpers/konfiguration";

const t = nutzeTestDatenbank();

const verboten: [string, Rolle | null, Fehlercode][] = [
  ["Gast", null, "NICHT_ANGEMELDET"],
  ["Mitglied", "MITGLIED", "KEINE_BERECHTIGUNG"],
  ["Bibliothekar", "BIBLIOTHEKAR", "KEINE_BERECHTIGUNG"],
];

async function sitzung(rolle: Rolle | null) {
  return rolle ? sitzungFuer(await legeNutzerAn(t.pg, rolle)) : null;
}

describe("E06-US02-FR01 Rechte: Rollen nur Administrator", () => {
  it.each(verboten)("%s: Nutzerliste → %s", async (_name, rolle, code) => {
    erwarteFehler(await ladeNutzer(t.kontext(await sitzung(rolle))), code);
  });

  it.each(verboten)("%s: Rolle zuweisen → %s, nichts ändert sich", async (_name, rolle, code) => {
    const ziel = await legeNutzerAn(t.pg, "MITGLIED");
    const s = await sitzung(rolle);
    const vorher = await momentaufnahme(t.pg);
    erwarteFehler(await rolleZuweisen(t.kontext(s), { userId: ziel.id, role: "ADMINISTRATOR" }), code);
    expect(await momentaufnahme(t.pg)).toBe(vorher);
  });

  it("ein Mitglied kann sich nicht selbst zum Administrator machen", async () => {
    const ich = await legeNutzerAn(t.pg, "MITGLIED");
    erwarteFehler(await rolleZuweisen(t.kontext(sitzungFuer(ich)), { userId: ich.id, role: "ADMINISTRATOR" }), "KEINE_BERECHTIGUNG");
    const { rows } = await t.pg.query<{ role: string }>("SELECT role FROM users WHERE id = $1", [ich.id]);
    expect(rows[0].role).toBe("MITGLIED");
  });

  it("die Nutzerliste enthält keine Passwort-Hashes und keine Sitzungsdaten", async () => {
    const admin = await legeNutzerAn(t.pg, "ADMINISTRATOR");
    await legeNutzerAn(t.pg, "MITGLIED");
    const liste = erwarteOk(await ladeNutzer(t.kontext(sitzungFuer(admin))));
    for (const eintrag of liste) expect(Object.keys(eintrag).sort()).toEqual(["email", "role", "userId"]);
    expect(JSON.stringify(liste)).not.toContain("test-hash-");
  });
});

describe("E06-US02-FR02 Rechte: Systemparameter nur Administrator", () => {
  it.each(verboten)("%s: Parameter ansehen → %s", async (_name, rolle, code) => {
    erwarteFehler(await ladeSystemparameter(t.kontext(await sitzung(rolle))), code);
  });

  it.each(verboten)("%s: Parameter ändern → %s, nichts ändert sich", async (_name, rolle, code) => {
    const s = await sitzung(rolle);
    const vorher = await momentaufnahme(t.pg);
    const wert = andererGueltigerWert("leihfristTage", standardWert("leihfristTage"));
    erwarteFehler(await systemparameterAendern(t.kontext(s), { name: "leihfristTage", wert }), code);
    expect(await momentaufnahme(t.pg)).toBe(vorher);
  });

  it("wer geändert hat, kommt aus der Sitzung; mitgeschickte Felder werden ignoriert", async () => {
    const admin = await legeNutzerAn(t.pg, "ADMINISTRATOR");
    const anderer = await legeNutzerAn(t.pg, "ADMINISTRATOR");
    const wert = andererGueltigerWert("leihfristTage", standardWert("leihfristTage"));
    erwarteOk(
      await systemparameterAendern(t.kontext(sitzungFuer(admin)), {
        name: "leihfristTage",
        wert,
        updatedById: anderer.id,
        updated_by_id: anderer.id,
        min: 0,
        max: 1000,
      } as { name: string; wert: number }),
    );
    const { rows } = await t.pg.query<{ updated_by_id: string }>("SELECT updated_by_id FROM system_settings WHERE key = 'leihfristTage'");
    expect(rows[0].updated_by_id).toBe(admin.id);
  });

  it("Grenzen kommen nur aus der Konfiguration: mitgeschicktes max erlaubt keinen größeren Wert", async () => {
    const admin = await legeNutzerAn(t.pg, "ADMINISTRATOR");
    const vorher = await momentaufnahme(t.pg);
    erwarteFehler(
      await systemparameterAendern(t.kontext(sitzungFuer(admin)), { name: "leihfristTage", wert: 100_000, max: 1_000_000 } as {
        name: string;
        wert: number;
      }),
      "VALIDIERUNG",
    );
    expect(await momentaufnahme(t.pg)).toBe(vorher);
  });
});
