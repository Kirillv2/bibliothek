// F-01 · E01-US01 · Rechte-Tests Katalogsuche
// Rechte-Matrix: Katalog durchsuchen für Gast, Mitglied, Bibliothekar, Administrator erlaubt, ohne Anmeldung.
// Gast-Antworten enthalten keine Personendaten. Suchbegriffe werden nie als SQL ausgeführt.
import { describe, expect, it } from "vitest";
import { ladeKategorien, sucheKatalog } from "@/server/katalog/suche";
import { nutzeTestDatenbank, momentaufnahme, zaehle, type Sitzung } from "../helpers/testdb";
import { erwarteOk } from "../helpers/ergebnis";
import { erwarteKeinePersonendaten } from "../helpers/personendaten";
import {
  legeAusleiheAn,
  legeExemplarAn,
  legeNutzerAn,
  legeTitelAn,
  legeVormerkungAn,
  sitzungFuer,
  zeitpunkt,
  type Nutzer,
} from "../helpers/daten";

const t = nutzeTestDatenbank();

async function bestandMitPersonen(): Promise<Nutzer[]> {
  const ausleiher = await legeNutzerAn(t.pg, "MITGLIED");
  const vormerker = await legeNutzerAn(t.pg, "MITGLIED");
  const titleId = await legeTitelAn(t.pg, { title: "Öffentlicher Titel", category: "Roman" });
  const exemplar = await legeExemplarAn(t.pg, titleId);
  await legeAusleiheAn(t.pg, { copyId: exemplar.id, memberId: ausleiher.id, startDate: "2026-11-01", dueDate: "2026-11-29" });
  await legeVormerkungAn(t.pg, { titleId, memberId: vormerker.id, status: "WARTEND", createdAt: zeitpunkt("2026-11-02") });
  return [ausleiher, vormerker];
}

describe("E01-US01-FR01 Rechte: Katalogsuche ohne Anmeldung für alle Rollen", () => {
  it("Gast (ohne Sitzung) kann suchen", async () => {
    await legeTitelAn(t.pg, { title: "Für alle" });

    const daten = erwarteOk(await sucheKatalog(t.kontext(null), { q: "Für alle" }));
    expect(daten.gesamt).toBe(1);
  });

  it.each(["MITGLIED", "BIBLIOTHEKAR", "ADMINISTRATOR"] as const)(
    "%s bekommt dieselbe Trefferliste wie ein Gast",
    async (rolle) => {
      await bestandMitPersonen();
      await legeTitelAn(t.pg, { title: "Zweiter Titel" });
      const nutzer = await legeNutzerAn(t.pg, rolle);
      const sitzung: Sitzung = sitzungFuer(nutzer);

      const gast = erwarteOk(await sucheKatalog(t.kontext(null), {}));
      const angemeldet = erwarteOk(await sucheKatalog(t.kontext(sitzung), {}));
      expect(angemeldet).toEqual(gast);
    },
  );

  it("Kategorien für den Filter sind ohne Anmeldung abrufbar", async () => {
    await legeTitelAn(t.pg, { category: "Roman" });

    expect(erwarteOk(await ladeKategorien(t.kontext(null)))).toEqual(["Roman"]);
  });
});

describe("E01-US01-FR03 Rechte: keine Personendaten in der Trefferliste (AK-03.4)", () => {
  it("Gast-Antwort enthält weder E-Mail noch ID von Ausleihenden oder Vormerkenden", async () => {
    const personen = await bestandMitPersonen();

    const daten = erwarteOk(await sucheKatalog(t.kontext(null), {}));
    expect(daten.treffer).toHaveLength(1);
    erwarteKeinePersonendaten(daten, personen);
  });

  it("auch die Suche nach der E-Mail einer Person liefert keinen Treffer und keine Personendaten", async () => {
    const [ausleiher] = await bestandMitPersonen();

    const daten = erwarteOk(await sucheKatalog(t.kontext(null), { q: ausleiher.email }));
    expect(daten.treffer).toEqual([]);
  });
});

describe("E01-US01-FR01 Rechte: SQL-Injection über den Suchbegriff (AK-01.9, security-architektur.md 6)", () => {
  const angriffe = [
    "' OR 1=1 --",
    "'; DROP TABLE titles; --",
    "%' UNION SELECT email, password_hash FROM users --",
    "\\'; DELETE FROM loans; --",
  ];

  it.each(angriffe)("Suchbegriff %s ändert nichts und liefert keine fremden Treffer", async (angriff) => {
    await bestandMitPersonen();
    const vorher = await momentaufnahme(t.pg);

    const ergebnis = await sucheKatalog(t.kontext(null), { q: angriff });
    expect(erwarteOk(ergebnis).treffer).toEqual([]);
    expect(await momentaufnahme(t.pg)).toBe(vorher);
    expect(await zaehle(t.pg, "SELECT count(*) AS n FROM titles")).toBe(1);
  });

  it("Filterwert Kategorie wird ebenfalls nur als Text verwendet", async () => {
    await bestandMitPersonen();
    const vorher = await momentaufnahme(t.pg);

    const ergebnis = await sucheKatalog(t.kontext(null), { kategorie: "Roman' OR '1'='1" });
    expect(erwarteOk(ergebnis).treffer).toEqual([]);
    expect(await momentaufnahme(t.pg)).toBe(vorher);
  });
});
