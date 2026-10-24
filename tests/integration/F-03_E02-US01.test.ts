// F-03 · E02-US01 · Titel anlegen, bearbeiten und archivieren
// Spec: docs/specs/F-03_E02-US01.md · Testplan: docs/testing/F-03.md
import { describe, expect, it } from "vitest";
import * as titelModul from "@/server/titel";
import { ladeVerwaltungsliste, titelAnlegen, titelArchivieren, titelBearbeiten } from "@/server/titel";
import { sucheKatalog } from "@/server/katalog/suche";
import { ladeTitelDetail } from "@/server/katalog/detail";
import { ausleihen } from "@/server/ausleihe";
import { ladeMeineAusleihen } from "@/server/verlaengerung";
import { momentaufnahme, nutzeTestDatenbank, zaehle, type Sitzung } from "../helpers/testdb";
import { erwarteFehler, erwarteOk } from "../helpers/ergebnis";
import { festeUhr } from "../helpers/uhr";
import {
  leseAusleihe,
  legeAusleiheAn,
  legeExemplarAn,
  legeNutzerAn,
  legeTitelAn,
  legeVormerkungAn,
  sitzungFuer,
  zeitpunkt,
} from "../helpers/daten";

const t = nutzeTestDatenbank();

type Neu = Parameters<typeof titelAnlegen>[1];

const GUELTIG = { title: "Der Process", author: "Franz Kafka", category: "Roman" } as const;

async function bibliothekar(): Promise<Sitzung> {
  return sitzungFuer(await legeNutzerAn(t.pg, "BIBLIOTHEKAR"));
}

async function legeAn(eingabe: Neu, sitzung?: Sitzung): Promise<string> {
  return erwarteOk(await titelAnlegen(t.kontext(sitzung ?? (await bibliothekar())), eingabe)).titleId;
}

type TitelZeile = {
  title: string;
  author: string;
  category: string;
  isbn: string | null;
  description: string | null;
  publication_year: number | null;
  archived_at: Date | null;
};

async function leseTitel(titleId: string): Promise<TitelZeile | undefined> {
  const { rows } = await t.pg.query<TitelZeile>(
    "SELECT title, author, category, isbn, description, publication_year, archived_at FROM titles WHERE id = $1",
    [titleId],
  );
  return rows[0];
}

const ohneTrenner = (s: string | null | undefined) => (s ?? "").replace(/[-\s]/g, "");

describe("E02-US01-FR01 Titel anlegen mit Pflichtfeldern Titel, Autor, Kategorie, optional ISBN und Beschreibung", () => {
  it("AK-01.1 (Querverweis F-01) mit Titel, Autor und Kategorie angelegt und im Katalog auffindbar", async () => {
    const titleId = await legeAn({ ...GUELTIG });

    expect(await leseTitel(titleId)).toMatchObject({ title: "Der Process", author: "Franz Kafka", category: "Roman", archived_at: null });
    const katalog = erwarteOk(await sucheKatalog(t.kontext(null), { q: "Process" }));
    expect(katalog.treffer.map((x) => x.titleId)).toEqual([titleId]);
  });

  it("AK-01.2 (Querverweis F-02) ISBN und Beschreibung werden gespeichert und auf der Detailseite gezeigt", async () => {
    const titleId = await legeAn({ ...GUELTIG, isbn: "978-3-16-148410-0", description: "Josef K. wird verhaftet." });

    const zeile = await leseTitel(titleId);
    expect(ohneTrenner(zeile?.isbn)).toBe("9783161484100");
    expect(zeile?.description).toBe("Josef K. wird verhaftet.");
    const detail = erwarteOk(await ladeTitelDetail(t.kontext(null), titleId));
    expect(ohneTrenner(detail.isbn)).toBe("9783161484100");
    expect(detail.description).toBe("Josef K. wird verhaftet.");
  });

  const pflichtfelder = ["title", "author", "category"] as const;
  const leerWerte = [
    ["fehlt", undefined],
    ["leer", ""],
    ["nur Leerzeichen", "   "],
  ] as const;

  for (const feld of pflichtfelder) {
    it.each(leerWerte)(`AK-01.3 Pflichtfeld ${feld} %s: VALIDIERUNG mit Feldangabe, nichts angelegt`, async (_art, wert) => {
      const sitzung = await bibliothekar();
      const eingabe: Record<string, unknown> = { ...GUELTIG, [feld]: wert };
      if (wert === undefined) delete eingabe[feld];
      const vorher = await momentaufnahme(t.pg);

      const felder = erwarteFehler(await titelAnlegen(t.kontext(sitzung), eingabe as Neu), "VALIDIERUNG");
      expect(Object.keys(felder)).toContain(feld);
      expect(await momentaufnahme(t.pg)).toBe(vorher);
    });
  }

  it("AK-01.3 fehlen alle Pflichtfelder, werden alle drei genannt", async () => {
    const sitzung = await bibliothekar();

    const felder = erwarteFehler(await titelAnlegen(t.kontext(sitzung), { title: "", author: " ", category: "" }), "VALIDIERUNG");
    expect(Object.keys(felder)).toEqual(expect.arrayContaining(["title", "author", "category"]));
    expect(await zaehle(t.pg, "SELECT count(*) AS n FROM titles")).toBe(0);
  });

  it("AK-01.4 ohne ISBN und Beschreibung wird der Titel trotzdem angelegt", async () => {
    const titleId = await legeAn({ ...GUELTIG });

    const zeile = await leseTitel(titleId);
    expect(zeile?.isbn ?? null).toBeNull();
    expect(zeile?.description ?? null).toBeNull();
  });

  it("AK-01.4 leere Texte für ISBN und Beschreibung gelten als nicht angegeben", async () => {
    const titleId = await legeAn({ ...GUELTIG, isbn: "", description: "" });

    const zeile = await leseTitel(titleId);
    expect(zeile?.isbn || null).toBeNull();
    expect(zeile?.description || null).toBeNull();
  });

  it("AK-01.5 ein Erscheinungsjahr wird gespeichert", async () => {
    const titleId = await legeAn({ ...GUELTIG, publicationYear: 1925 });

    expect((await leseTitel(titleId))?.publication_year).toBe(1925);
  });

  it("AK-01.5 das Erscheinungsjahr ist optional", async () => {
    const titleId = await legeAn({ ...GUELTIG });

    expect((await leseTitel(titleId))?.publication_year ?? null).toBeNull();
  });

  it("AK-01.5 das aktuelle Jahr (laut Uhr) ist erlaubt", async () => {
    const sitzung = await bibliothekar();
    const ergebnis = await titelAnlegen(t.kontext(sitzung, festeUhr("2026-11-10")), { ...GUELTIG, publicationYear: 2026 });

    erwarteOk(ergebnis);
  });

  it.each([
    ["null", 0],
    ["negativ", -1],
    ["keine ganze Zahl", 1999.5],
    ["nach dem aktuellen Jahr", 2027],
  ])("AK-01.5 Erscheinungsjahr %s (%s): VALIDIERUNG", async (_grund, jahr) => {
    const sitzung = await bibliothekar();
    const vorher = await momentaufnahme(t.pg);

    const ergebnis = await titelAnlegen(t.kontext(sitzung, festeUhr("2026-11-10")), { ...GUELTIG, publicationYear: jahr });
    expect(Object.keys(erwarteFehler(ergebnis, "VALIDIERUNG"))).toContain("publicationYear");
    expect(await momentaufnahme(t.pg)).toBe(vorher);
  });

  it("AK-01.5 „aktuelles Jahr“ kommt aus der Uhr: am 01.01.2027 ist 2027 erlaubt", async () => {
    const sitzung = await bibliothekar();

    erwarteOk(await titelAnlegen(t.kontext(sitzung, festeUhr("2027-01-01")), { ...GUELTIG, publicationYear: 2027 }));
  });

  it.each(["3-16-148410-X", "316148410X", "978-3-16-148410-0", "978 3 16 148410 0", "3161484101"])(
    "AK-01.6 ISBN in gültiger Form wird angenommen (ohne Prüfziffer): %s",
    async (isbn) => {
      erwarteOk(await titelAnlegen(t.kontext(await bibliothekar()), { ...GUELTIG, isbn }));
    },
  );

  it.each(["12345", "978316148410", "31614841X0", "ABCDEFGHIJ", "978-3-16-148410-00"])(
    "AK-01.6 ISBN in ungültiger Form: VALIDIERUNG (%s)",
    async (isbn) => {
      const sitzung = await bibliothekar();
      const vorher = await momentaufnahme(t.pg);

      const felder = erwarteFehler(await titelAnlegen(t.kontext(sitzung), { ...GUELTIG, isbn }), "VALIDIERUNG");
      expect(Object.keys(felder)).toContain("isbn");
      expect(await momentaufnahme(t.pg)).toBe(vorher);
    },
  );

  it("AK-01.6 dieselbe ISBN darf mehrfach vorkommen", async () => {
    const sitzung = await bibliothekar();
    const a = await legeAn({ ...GUELTIG, isbn: "978-3-16-148410-0" }, sitzung);
    const b = await legeAn({ ...GUELTIG, title: "Zweite Ausgabe", isbn: "978-3-16-148410-0" }, sitzung);

    expect(a).not.toBe(b);
    expect(await zaehle(t.pg, "SELECT count(*) AS n FROM titles")).toBe(2);
  });

  it("AK-01.7 (Querverweis E02-US02-FR03, F-01, F-02) ein neuer Titel hat keine Exemplare und 0 verfügbare", async () => {
    const titleId = await legeAn({ ...GUELTIG });

    expect(await zaehle(t.pg, "SELECT count(*) AS n FROM copies WHERE title_id = $1", [titleId])).toBe(0);
    expect(erwarteOk(await ladeTitelDetail(t.kontext(null), titleId)).exemplare).toEqual([]);
    const [treffer] = erwarteOk(await sucheKatalog(t.kontext(null), { q: "Process" })).treffer;
    expect(treffer.verfuegbareExemplare).toBe(0);
  });
});

describe("E02-US01-FR02 Titel bearbeiten ohne Wirkung auf laufende Ausleihvorgänge", () => {
  it("AK-02.1 (Querverweis F-01, F-02) geänderte Felder erscheinen in Katalog und Detailseite", async () => {
    const titleId = await legeTitelAn(t.pg, { title: "Alter Titel", author: "Alter Autor", category: "Alt" });

    erwarteOk(
      await titelBearbeiten(t.kontext(await bibliothekar()), {
        titleId,
        title: "Neuer Titel",
        author: "Neue Autorin",
        category: "Neu",
        isbn: "3-16-148410-X",
        description: "Neu beschrieben",
        publicationYear: 2001,
      }),
    );

    expect(await leseTitel(titleId)).toMatchObject({
      title: "Neuer Titel",
      author: "Neue Autorin",
      category: "Neu",
      description: "Neu beschrieben",
      publication_year: 2001,
    });
    const [treffer] = erwarteOk(await sucheKatalog(t.kontext(null), { q: "Neuer Titel" })).treffer;
    expect(treffer).toMatchObject({ titleId, title: "Neuer Titel", author: "Neue Autorin", category: "Neu" });
    expect(erwarteOk(await sucheKatalog(t.kontext(null), { q: "Alter Titel" })).treffer).toEqual([]);
    const detail = erwarteOk(await ladeTitelDetail(t.kontext(null), titleId));
    expect(detail).toMatchObject({ title: "Neuer Titel", author: "Neue Autorin", category: "Neu", description: "Neu beschrieben" });
  });

  it.each(["title", "author", "category"] as const)(
    "AK-02.2 Pflichtfeld %s nur aus Leerzeichen: VALIDIERUNG, Titel unverändert",
    async (feld) => {
      const titleId = await legeTitelAn(t.pg, { ...GUELTIG });
      const sitzung = await bibliothekar();
      const vorher = await momentaufnahme(t.pg);

      const ergebnis = await titelBearbeiten(t.kontext(sitzung), { titleId, ...GUELTIG, [feld]: "   " });
      expect(Object.keys(erwarteFehler(ergebnis, "VALIDIERUNG"))).toContain(feld);
      expect(await momentaufnahme(t.pg)).toBe(vorher);
    },
  );

  it("AK-02.2 ungültige ISBN und ungültiges Jahr beim Bearbeiten: VALIDIERUNG", async () => {
    const titleId = await legeTitelAn(t.pg, { ...GUELTIG });
    const sitzung = await bibliothekar();

    const a = await titelBearbeiten(t.kontext(sitzung), { titleId, ...GUELTIG, isbn: "12345" });
    expect(Object.keys(erwarteFehler(a, "VALIDIERUNG"))).toContain("isbn");
    const b = await titelBearbeiten(t.kontext(sitzung, festeUhr("2026-11-10")), { titleId, ...GUELTIG, publicationYear: 2027 });
    expect(Object.keys(erwarteFehler(b, "VALIDIERUNG"))).toContain("publicationYear");
    expect(await leseTitel(titleId)).toMatchObject({ isbn: null, publication_year: null });
  });

  it("AK-02.3 (Querverweis E03) ein offener Ausleihvorgang bleibt durch die Bearbeitung unverändert", async () => {
    const titleId = await legeTitelAn(t.pg, { ...GUELTIG });
    const exemplar = await legeExemplarAn(t.pg, titleId);
    const mitglied = await legeNutzerAn(t.pg, "MITGLIED");
    const loanId = await legeAusleiheAn(t.pg, {
      copyId: exemplar.id,
      memberId: mitglied.id,
      startDate: "2026-11-01",
      dueDate: "2026-11-29",
      renewalCount: 1,
    });
    const vorher = await leseAusleihe(t.pg, loanId);

    erwarteOk(await titelBearbeiten(t.kontext(await bibliothekar()), { titleId, title: "Umbenannt", author: "Andere", category: "Anders" }));

    const nachher = await leseAusleihe(t.pg, loanId);
    expect(nachher).toEqual(vorher);
    expect(nachher).toMatchObject({
      copy_id: exemplar.id,
      member_id: mitglied.id,
      start_date: "2026-11-01",
      due_date: "2026-11-29",
      renewal_count: 1,
      returned_at: null,
    });
  });

  it("AK-02.4 (Querverweis F-06) „Meine Ausleihen“ zeigt danach den neuen Titel, Daten des Vorgangs bleiben", async () => {
    const titleId = await legeTitelAn(t.pg, { title: "Vorher" });
    const exemplar = await legeExemplarAn(t.pg, titleId);
    const mitglied = await legeNutzerAn(t.pg, "MITGLIED");
    const loanId = await legeAusleiheAn(t.pg, { copyId: exemplar.id, memberId: mitglied.id, startDate: "2026-11-01", dueDate: "2026-11-29" });

    erwarteOk(await titelBearbeiten(t.kontext(await bibliothekar()), { titleId, title: "Nachher", author: "A", category: "K" }));

    const liste = erwarteOk(await ladeMeineAusleihen(t.kontext(sitzungFuer(mitglied))));
    expect(liste).toEqual([
      expect.objectContaining({ loanId, title: "Nachher", inventoryNumber: exemplar.inventoryNumber, dueDate: "2026-11-29" }),
    ]);
  });

  it("AK-02.5 unbekannte Titel-ID: NICHT_GEFUNDEN", async () => {
    const ergebnis = await titelBearbeiten(t.kontext(await bibliothekar()), {
      titleId: "00000000-0000-4000-8000-000000000000",
      ...GUELTIG,
    });

    erwarteFehler(ergebnis, "NICHT_GEFUNDEN");
    expect(await zaehle(t.pg, "SELECT count(*) AS n FROM titles")).toBe(0);
  });
});

describe("E02-US01-FR03 Titel archivieren nur, wenn kein Exemplar ausgeliehen oder vorgemerkt ist", () => {
  async function archivieren(titleId: string) {
    return titelArchivieren(t.kontext(await bibliothekar()), { titleId });
  }

  async function istArchiviert(titleId: string): Promise<boolean> {
    return (await leseTitel(titleId))?.archived_at != null;
  }

  it("AK-03.1 kein Exemplar ausgeliehen oder vorgemerkt: Titel wird archiviert", async () => {
    const titleId = await legeTitelAn(t.pg);
    await legeExemplarAn(t.pg, titleId);
    await legeExemplarAn(t.pg, titleId, { condition: "VERLOREN" });

    const daten = erwarteOk(await archivieren(titleId));
    expect(daten.titleId).toBe(titleId);
    expect(daten.archivedAt).toBeTruthy();
    expect(await istArchiviert(titleId)).toBe(true);
  });

  it("AK-03.2 ein Exemplar in offenem Ausleihvorgang: TITEL_NICHT_ARCHIVIERBAR, Titel bleibt aktiv", async () => {
    const titleId = await legeTitelAn(t.pg);
    await legeExemplarAn(t.pg, titleId);
    const verliehen = await legeExemplarAn(t.pg, titleId);
    const mitglied = await legeNutzerAn(t.pg, "MITGLIED");
    await legeAusleiheAn(t.pg, { copyId: verliehen.id, memberId: mitglied.id, startDate: "2026-11-01", dueDate: "2026-11-29" });

    erwarteFehler(await archivieren(titleId), "TITEL_NICHT_ARCHIVIERBAR");
    expect(await istArchiviert(titleId)).toBe(false);
  });

  it("AK-03.2 auch ein als verloren markiertes, aber noch ausgeliehenes Exemplar blockiert (OF-F04-1)", async () => {
    const titleId = await legeTitelAn(t.pg);
    const exemplar = await legeExemplarAn(t.pg, titleId, { condition: "VERLOREN" });
    const mitglied = await legeNutzerAn(t.pg, "MITGLIED");
    await legeAusleiheAn(t.pg, { copyId: exemplar.id, memberId: mitglied.id, startDate: "2026-11-01", dueDate: "2026-11-29" });

    erwarteFehler(await archivieren(titleId), "TITEL_NICHT_ARCHIVIERBAR");
    expect(await istArchiviert(titleId)).toBe(false);
  });

  it("AK-03.3 (Querverweis E05-US01) Exemplar einer abholbereiten Vormerkung zugeordnet: TITEL_NICHT_ARCHIVIERBAR", async () => {
    const titleId = await legeTitelAn(t.pg);
    const exemplar = await legeExemplarAn(t.pg, titleId);
    const mitglied = await legeNutzerAn(t.pg, "MITGLIED");
    await legeVormerkungAn(t.pg, {
      titleId,
      memberId: mitglied.id,
      status: "ABHOLBEREIT",
      createdAt: zeitpunkt("2026-11-01"),
      copyId: exemplar.id,
      pickupDeadline: "2026-11-13",
    });

    erwarteFehler(await archivieren(titleId), "TITEL_NICHT_ARCHIVIERBAR");
    expect(await istArchiviert(titleId)).toBe(false);
  });

  it("AK-03.4 (Querverweis E05-US01-FR02) eine wartende Vormerkung ohne Exemplar: TITEL_NICHT_ARCHIVIERBAR (OF-F03-1)", async () => {
    const titleId = await legeTitelAn(t.pg);
    await legeExemplarAn(t.pg, titleId);
    const mitglied = await legeNutzerAn(t.pg, "MITGLIED");
    await legeVormerkungAn(t.pg, { titleId, memberId: mitglied.id, status: "WARTEND", createdAt: zeitpunkt("2026-11-01") });

    erwarteFehler(await archivieren(titleId), "TITEL_NICHT_ARCHIVIERBAR");
    expect(await istArchiviert(titleId)).toBe(false);
  });

  it("AK-03.4 abgelaufene Vormerkungen blockieren nicht (nur aktive: wartend oder abholbereit)", async () => {
    const titleId = await legeTitelAn(t.pg);
    const exemplar = await legeExemplarAn(t.pg, titleId);
    const mitglied = await legeNutzerAn(t.pg, "MITGLIED");
    await legeVormerkungAn(t.pg, {
      titleId,
      memberId: mitglied.id,
      status: "ABGELAUFEN",
      createdAt: zeitpunkt("2026-10-01"),
      copyId: exemplar.id,
      pickupDeadline: "2026-10-10",
    });

    erwarteOk(await archivieren(titleId));
    expect(await istArchiviert(titleId)).toBe(true);
  });

  it("AK-03.4 Vormerkungen eines anderen Titels blockieren nicht", async () => {
    const titleId = await legeTitelAn(t.pg);
    const anderer = await legeTitelAn(t.pg);
    const mitglied = await legeNutzerAn(t.pg, "MITGLIED");
    await legeVormerkungAn(t.pg, { titleId: anderer, memberId: mitglied.id, status: "WARTEND", createdAt: zeitpunkt("2026-11-01") });

    erwarteOk(await archivieren(titleId));
  });

  it("AK-03.5 ein Titel ohne Exemplare wird archiviert", async () => {
    const titleId = await legeTitelAn(t.pg);

    erwarteOk(await archivieren(titleId));
    expect(await istArchiviert(titleId)).toBe(true);
  });

  it("AK-03.6 nur abgeschlossene Ausleihvorgänge: archiviert, die Vorgänge bleiben erhalten", async () => {
    const titleId = await legeTitelAn(t.pg);
    const exemplar = await legeExemplarAn(t.pg, titleId);
    const mitglied = await legeNutzerAn(t.pg, "MITGLIED");
    const loanId = await legeAusleiheAn(t.pg, {
      copyId: exemplar.id,
      memberId: mitglied.id,
      startDate: "2026-09-01",
      dueDate: "2026-09-29",
      returnedAt: zeitpunkt("2026-09-20"),
    });
    const vorgangVorher = await leseAusleihe(t.pg, loanId);

    erwarteOk(await archivieren(titleId));
    expect(await istArchiviert(titleId)).toBe(true);
    expect(await leseAusleihe(t.pg, loanId)).toEqual(vorgangVorher);
  });

  it("AK-03.7 (Querverweis F-01) ein archivierter Titel erscheint nicht mehr im öffentlichen Katalog", async () => {
    const titleId = await legeTitelAn(t.pg, { title: "Bald archiviert" });
    await legeExemplarAn(t.pg, titleId);

    erwarteOk(await archivieren(titleId));
    expect(erwarteOk(await sucheKatalog(t.kontext(null), { q: "Bald archiviert" })).treffer).toEqual([]);
  });

  it("AK-03.7 (Querverweis F-02) seine Detailseite ist für Gast und Mitglied NICHT_GEFUNDEN", async () => {
    const titleId = await legeTitelAn(t.pg);
    const mitglied = sitzungFuer(await legeNutzerAn(t.pg, "MITGLIED"));

    erwarteOk(await archivieren(titleId));
    erwarteFehler(await ladeTitelDetail(t.kontext(null), titleId), "NICHT_GEFUNDEN");
    erwarteFehler(await ladeTitelDetail(t.kontext(mitglied), titleId), "NICHT_GEFUNDEN");
  });

  it("AK-03.7 (Querverweis F-05) er ist nicht ausleihbar", async () => {
    const titleId = await legeTitelAn(t.pg);
    await legeExemplarAn(t.pg, titleId);
    const mitglied = sitzungFuer(await legeNutzerAn(t.pg, "MITGLIED"));

    erwarteOk(await archivieren(titleId));
    erwarteFehler(await ausleihen(t.kontext(mitglied), { titleId }), "NICHT_GEFUNDEN");
    expect(await zaehle(t.pg, "SELECT count(*) AS n FROM loans")).toBe(0);
  });

  it("AK-03.7 der Bibliothekar sieht ihn weiter in der Verwaltung, als archiviert gekennzeichnet", async () => {
    const archiviert = await legeTitelAn(t.pg, { title: "Archiv" });
    const aktiv = await legeTitelAn(t.pg, { title: "Aktiv" });
    const sitzung = await bibliothekar();

    erwarteOk(await titelArchivieren(t.kontext(sitzung), { titleId: archiviert }));
    const liste = erwarteOk(await ladeVerwaltungsliste(t.kontext(sitzung)));
    expect(liste).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ titleId: archiviert, title: "Archiv", archiviert: true }),
        expect.objectContaining({ titleId: aktiv, title: "Aktiv", archiviert: false }),
      ]),
    );
    expect(liste).toHaveLength(2);
  });

  it("AK-03.8 ein archivierter Titel kann nicht bearbeitet werden (NICHT_GEFUNDEN)", async () => {
    const titleId = await legeTitelAn(t.pg, { ...GUELTIG, archiviert: true });

    const ergebnis = await titelBearbeiten(t.kontext(await bibliothekar()), { titleId, title: "Geändert", author: "X", category: "Y" });
    erwarteFehler(ergebnis, "NICHT_GEFUNDEN");
    expect((await leseTitel(titleId))?.title).toBe("Der Process");
  });

  it("AK-03.8 es gibt keine Funktion zum Reaktivieren", () => {
    const namen = Object.keys(titelModul);
    expect(namen.filter((n) => /aktivier|reaktiv|wiederherstell|dearchiv|restore|unarchive/i.test(n))).toEqual([]);
  });

  it("AK-03.8 erneutes Archivieren ändert den archivierten Titel nicht", async () => {
    const titleId = await legeTitelAn(t.pg);
    const sitzung = await bibliothekar();
    erwarteOk(await titelArchivieren(t.kontext(sitzung), { titleId }));
    const vorher = await leseTitel(titleId);

    await titelArchivieren(t.kontext(sitzung), { titleId });
    expect(await leseTitel(titleId)).toEqual(vorher);
  });

  it("unbekannte Titel-ID beim Archivieren: NICHT_GEFUNDEN", async () => {
    erwarteFehler(await archivieren("00000000-0000-4000-8000-000000000000"), "NICHT_GEFUNDEN");
  });
});
