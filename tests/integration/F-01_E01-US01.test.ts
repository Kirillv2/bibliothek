// F-01 · E01-US01 · Katalog durchsuchen, filtern und sortieren
// Spec: docs/specs/F-01_E01-US01.md · Testplan: docs/testing/F-01.md
import { describe, expect, it } from "vitest";
import { ladeKategorien, sucheKatalog } from "@/server/katalog/suche";
import { ausleihen } from "@/server/ausleihe";
import { nutzeTestDatenbank, zaehle } from "../helpers/testdb";
import { erwarteFehler, erwarteOk } from "../helpers/ergebnis";
import { erwarteKeinePersonendaten } from "../helpers/personendaten";
import {
  legeAusleiheAn,
  legeExemplarAn,
  legeNutzerAn,
  legeTitelAn,
  legeVormerkungAn,
  sitzungFuer,
  zeitpunkt,
} from "../helpers/daten";

const t = nutzeTestDatenbank();

type Anfrage = Parameters<typeof sucheKatalog>[1];

async function suche(anfrage: Anfrage = {}) {
  return erwarteOk(await sucheKatalog(t.kontext(null), anfrage));
}

async function trefferIds(anfrage: Anfrage = {}): Promise<string[]> {
  return (await suche(anfrage)).treffer.map((x) => x.titleId);
}

async function trefferTitel(anfrage: Anfrage = {}): Promise<string[]> {
  return (await suche(anfrage)).treffer.map((x) => x.title);
}

/** Titel mit einem ausgeliehenen Exemplar (nicht verfügbar). */
async function legeAusgeliehenenTitelAn(felder: Parameters<typeof legeTitelAn>[1] = {}): Promise<string> {
  const titleId = await legeTitelAn(t.pg, felder);
  const exemplar = await legeExemplarAn(t.pg, titleId);
  const mitglied = await legeNutzerAn(t.pg, "MITGLIED");
  await legeAusleiheAn(t.pg, { copyId: exemplar.id, memberId: mitglied.id, startDate: "2026-11-01", dueDate: "2026-11-29" });
  return titleId;
}

describe("E01-US01-FR01 Freitextsuche über Titel, Autor und ISBN/Inventarkennung", () => {
  it("AK-01.1 findet einen Titel über einen Begriff aus dem Titel", async () => {
    const gesucht = await legeTitelAn(t.pg, { title: "Der Process", author: "Franz Kafka" });
    await legeTitelAn(t.pg, { title: "Faust", author: "Goethe" });

    expect(await trefferIds({ q: "Process" })).toEqual([gesucht]);
  });

  it("AK-01.2 findet einen Titel über den Autor", async () => {
    const gesucht = await legeTitelAn(t.pg, { title: "Das Schloss", author: "Franz Kafka" });
    await legeTitelAn(t.pg, { title: "Faust", author: "Goethe" });

    expect(await trefferIds({ q: "Kafka" })).toEqual([gesucht]);
  });

  it("AK-01.3 findet einen Titel über die ISBN", async () => {
    const gesucht = await legeTitelAn(t.pg, { title: "Mit ISBN", isbn: "978-3-16-148410-0" });
    await legeTitelAn(t.pg, { title: "Ohne ISBN" });

    expect(await trefferIds({ q: "978-3-16-148410-0" })).toEqual([gesucht]);
  });

  it("AK-01.4 findet den Titel über die Inventarnummer eines Exemplars, einmal statt je Exemplar", async () => {
    const gesucht = await legeTitelAn(t.pg, { title: "Mehrere Exemplare" });
    await legeExemplarAn(t.pg, gesucht, { inventoryNumber: "INV-900123" });
    await legeExemplarAn(t.pg, gesucht, { inventoryNumber: "INV-900124" });
    const anderer = await legeTitelAn(t.pg, { title: "Anderer Titel" });
    await legeExemplarAn(t.pg, anderer, { inventoryNumber: "INV-900200" });

    const ergebnis = await suche({ q: "INV-900123" });
    expect(ergebnis.treffer.map((x) => x.titleId)).toEqual([gesucht]);
    expect(ergebnis.gesamt).toBe(1);
  });

  it("AK-01.4 findet einen Titel mit mehreren passenden Exemplaren nur einmal", async () => {
    const gesucht = await legeTitelAn(t.pg, { title: "Viele Exemplare" });
    await legeExemplarAn(t.pg, gesucht, { inventoryNumber: "INV-901001" });
    await legeExemplarAn(t.pg, gesucht, { inventoryNumber: "INV-901002" });

    const ergebnis = await suche({ q: "INV-9010" });
    expect(ergebnis.treffer.map((x) => x.titleId)).toEqual([gesucht]);
    expect(ergebnis.gesamt).toBe(1);
  });

  it("AK-01.5 findet Teilwörter ohne Beachtung der Groß-/Kleinschreibung", async () => {
    const gesucht = await legeTitelAn(t.pg, { title: "Der Process", author: "Franz Kafka" });

    expect(await trefferIds({ q: "process" })).toEqual([gesucht]);
    expect(await trefferIds({ q: "PROC" })).toEqual([gesucht]);
    expect(await trefferIds({ q: "afk" })).toEqual([gesucht]);
  });

  it("AK-01.5 ignoriert Bindestriche und Leerzeichen bei der ISBN", async () => {
    const gesucht = await legeTitelAn(t.pg, { title: "Mit ISBN", isbn: "978-3-16-148410-0" });

    expect(await trefferIds({ q: "9783161484100" })).toEqual([gesucht]);
    expect(await trefferIds({ q: "978 3 16 148410 0" })).toEqual([gesucht]);
  });

  it("AK-01.5 ignoriert Bindestriche und Leerzeichen bei der Inventarnummer", async () => {
    const gesucht = await legeTitelAn(t.pg, { title: "Mit Exemplar" });
    await legeExemplarAn(t.pg, gesucht, { inventoryNumber: "INV-900777" });

    expect(await trefferIds({ q: "INV900777" })).toEqual([gesucht]);
    expect(await trefferIds({ q: "inv 900777" })).toEqual([gesucht]);
  });

  it("AK-01.6 liefert eine leere Trefferliste, wenn nichts passt", async () => {
    await legeTitelAn(t.pg, { title: "Der Process" });

    const ergebnis = await suche({ q: "Quxzyw nichts passt" });
    expect(ergebnis.treffer).toEqual([]);
    expect(ergebnis.gesamt).toBe(0);
  });

  it("AK-01.7 zeigt ohne Suchbegriff alle aktiven Titel", async () => {
    const a = await legeTitelAn(t.pg, { title: "Alpha" });
    const b = await legeTitelAn(t.pg, { title: "Beta" });
    const c = await legeTitelAn(t.pg, { title: "Gamma" });
    await legeTitelAn(t.pg, { title: "Delta archiviert", archiviert: true });

    const ergebnis = await suche();
    expect(ergebnis.treffer.map((x) => x.titleId).sort()).toEqual([a, b, c].sort());
    expect(ergebnis.gesamt).toBe(3);
  });

  it("AK-01.7 ein leerer oder nur aus Leerzeichen bestehender Suchbegriff zählt wie kein Suchbegriff", async () => {
    await legeTitelAn(t.pg, { title: "Alpha" });
    await legeTitelAn(t.pg, { title: "Beta" });

    expect((await suche({ q: "" })).gesamt).toBe(2);
    expect((await suche({ q: "   " })).gesamt).toBe(2);
  });

  it("AK-01.8 zeigt archivierte Titel nicht, auch wenn sie passen", async () => {
    const aktiv = await legeTitelAn(t.pg, { title: "Process aktiv" });
    await legeTitelAn(t.pg, { title: "Process archiviert", archiviert: true });

    expect(await trefferIds({ q: "Process" })).toEqual([aktiv]);
  });

  it("AK-01.8 findet einen archivierten Titel auch nicht über die Inventarnummer", async () => {
    const archiviert = await legeTitelAn(t.pg, { title: "Archiviert", archiviert: true });
    await legeExemplarAn(t.pg, archiviert, { inventoryNumber: "INV-900555" });

    expect(await trefferIds({ q: "INV-900555" })).toEqual([]);
  });

  it("AK-01.9 behandelt SQL-Sonderzeichen als normalen Text", async () => {
    await legeTitelAn(t.pg, { title: "Alpha" });
    await legeTitelAn(t.pg, { title: "Beta" });

    const ergebnis = await sucheKatalog(t.kontext(null), { q: "' OR 1=1 --" });
    expect(erwarteOk(ergebnis).treffer).toEqual([]);
    expect(await zaehle(t.pg, "SELECT count(*) AS n FROM titles")).toBe(2);
  });

  it("AK-01.9 behandelt % und _ als Zeichen, nicht als Platzhalter", async () => {
    const prozent = await legeTitelAn(t.pg, { title: "100% Sicher" });
    const unterstrich = await legeTitelAn(t.pg, { title: "A_B Handbuch" });
    await legeTitelAn(t.pg, { title: "AxB Handbuch" });
    await legeTitelAn(t.pg, { title: "Ohne Sonderzeichen" });

    expect(await trefferIds({ q: "%" })).toEqual([prozent]);
    expect(await trefferIds({ q: "_" })).toEqual([unterstrich]);
  });

  it("AK-01.9 verträgt Anführungszeichen und Backslash ohne Fehler", async () => {
    const gesucht = await legeTitelAn(t.pg, { title: 'Er sagte "Hallo" \\ Tschüss' });

    expect(await trefferIds({ q: '"Hallo" \\' })).toEqual([gesucht]);
  });
});

describe("E01-US01-FR02 Filtern und Sortieren nach Kategorie, Verfügbarkeit und Erscheinungsjahr", () => {
  it("AK-02.1 filtert nach Kategorie", async () => {
    const a1 = await legeTitelAn(t.pg, { title: "A eins", category: "Roman" });
    const a2 = await legeTitelAn(t.pg, { title: "A zwei", category: "Roman" });
    await legeTitelAn(t.pg, { title: "B eins", category: "Sachbuch" });

    expect((await trefferIds({ kategorie: "Roman" })).sort()).toEqual([a1, a2].sort());
  });

  it("AK-02.2 filtert auf Titel mit mindestens einem verfügbaren Exemplar", async () => {
    const verfuegbar = await legeTitelAn(t.pg, { title: "Verfügbar" });
    await legeExemplarAn(t.pg, verfuegbar);
    await legeAusgeliehenenTitelAn({ title: "Ausgeliehen" });
    await legeTitelAn(t.pg, { title: "Ohne Exemplare" });
    const verloren = await legeTitelAn(t.pg, { title: "Nur verloren" });
    await legeExemplarAn(t.pg, verloren, { condition: "VERLOREN" });

    expect(await trefferIds({ nurVerfuegbar: true })).toEqual([verfuegbar]);
  });

  it("AK-02.2 ohne Verfügbarkeitsfilter erscheinen auch Titel ohne verfügbare Exemplare", async () => {
    const verfuegbar = await legeTitelAn(t.pg, { title: "Verfügbar" });
    await legeExemplarAn(t.pg, verfuegbar);
    const ausgeliehen = await legeAusgeliehenenTitelAn({ title: "Ausgeliehen" });

    expect((await trefferIds({ nurVerfuegbar: false })).sort()).toEqual([verfuegbar, ausgeliehen].sort());
  });

  it("AK-02.3 filtert nach Jahresbereich (Grenzen eingeschlossen); Titel ohne Jahr fallen heraus", async () => {
    await legeTitelAn(t.pg, { title: "J1985", publicationYear: 1985 });
    const j1990 = await legeTitelAn(t.pg, { title: "J1990", publicationYear: 1990 });
    const j1995 = await legeTitelAn(t.pg, { title: "J1995", publicationYear: 1995 });
    const j2000 = await legeTitelAn(t.pg, { title: "J2000", publicationYear: 2000 });
    await legeTitelAn(t.pg, { title: "J2005", publicationYear: 2005 });
    await legeTitelAn(t.pg, { title: "Ohne Jahr", publicationYear: null });

    expect((await trefferIds({ jahrVon: 1990, jahrBis: 2000 })).sort()).toEqual([j1990, j1995, j2000].sort());
  });

  it("AK-02.3 filtert mit nur einer Grenze (ab bzw. bis)", async () => {
    const alt = await legeTitelAn(t.pg, { title: "Alt", publicationYear: 1950 });
    const neu = await legeTitelAn(t.pg, { title: "Neu", publicationYear: 2020 });
    await legeTitelAn(t.pg, { title: "Ohne Jahr", publicationYear: null });

    expect(await trefferIds({ jahrVon: 2000 })).toEqual([neu]);
    expect(await trefferIds({ jahrBis: 2000 })).toEqual([alt]);
  });

  it("AK-02.4 verknüpft alle Filter und den Suchbegriff mit UND", async () => {
    const passt = await legeTitelAn(t.pg, { title: "Kafka Roman", category: "Roman", publicationYear: 1925 });
    await legeExemplarAn(t.pg, passt);
    // jeweils genau eine Bedingung verletzt
    const falscheKategorie = await legeTitelAn(t.pg, { title: "Kafka Sachbuch", category: "Sachbuch", publicationYear: 1925 });
    await legeExemplarAn(t.pg, falscheKategorie);
    const falschesJahr = await legeTitelAn(t.pg, { title: "Kafka spät", category: "Roman", publicationYear: 1990 });
    await legeExemplarAn(t.pg, falschesJahr);
    await legeAusgeliehenenTitelAn({ title: "Kafka verliehen", category: "Roman", publicationYear: 1925 });
    const falscherBegriff = await legeTitelAn(t.pg, { title: "Mann Roman", category: "Roman", publicationYear: 1925 });
    await legeExemplarAn(t.pg, falscherBegriff);

    const ids = await trefferIds({ q: "Kafka", kategorie: "Roman", nurVerfuegbar: true, jahrVon: 1900, jahrBis: 1950 });
    expect(ids).toEqual([passt]);
  });

  it("AK-02.5 sortiert nach Kategorie auf- und absteigend, bei Gleichstand nach Titel", async () => {
    await legeTitelAn(t.pg, { title: "Beta", category: "Kunst" });
    await legeTitelAn(t.pg, { title: "Alpha", category: "Kunst" });
    await legeTitelAn(t.pg, { title: "Gamma", category: "Biologie" });
    await legeTitelAn(t.pg, { title: "Delta", category: "Recht" });

    expect(await trefferTitel({ sortierung: "KATEGORIE", richtung: "AUF" })).toEqual(["Gamma", "Alpha", "Beta", "Delta"]);
    expect(await trefferTitel({ sortierung: "KATEGORIE", richtung: "AB" })).toEqual(["Delta", "Alpha", "Beta", "Gamma"]);
  });

  it("AK-02.5 sortiert nach Anzahl verfügbarer Exemplare auf- und absteigend, bei Gleichstand nach Titel", async () => {
    const drei = await legeTitelAn(t.pg, { title: "Drei" });
    for (let i = 0; i < 3; i++) await legeExemplarAn(t.pg, drei);
    const einsA = await legeTitelAn(t.pg, { title: "Eins A" });
    await legeExemplarAn(t.pg, einsA);
    const einsB = await legeTitelAn(t.pg, { title: "Eins B" });
    await legeExemplarAn(t.pg, einsB);
    await legeAusgeliehenenTitelAn({ title: "Null" });

    expect(await trefferTitel({ sortierung: "VERFUEGBARKEIT", richtung: "AUF" })).toEqual(["Null", "Eins A", "Eins B", "Drei"]);
    expect(await trefferTitel({ sortierung: "VERFUEGBARKEIT", richtung: "AB" })).toEqual(["Drei", "Eins A", "Eins B", "Null"]);
  });

  it("AK-02.5 sortiert nach Erscheinungsjahr; Titel ohne Jahr stehen in beiden Richtungen am Ende", async () => {
    await legeTitelAn(t.pg, { title: "Mitte", publicationYear: 1990 });
    await legeTitelAn(t.pg, { title: "Ohne Jahr B", publicationYear: null });
    await legeTitelAn(t.pg, { title: "Neu", publicationYear: 2010 });
    await legeTitelAn(t.pg, { title: "Ohne Jahr A", publicationYear: null });
    await legeTitelAn(t.pg, { title: "Alt", publicationYear: 1950 });
    await legeTitelAn(t.pg, { title: "Auch Mitte", publicationYear: 1990 });

    expect(await trefferTitel({ sortierung: "JAHR", richtung: "AUF" })).toEqual([
      "Alt",
      "Auch Mitte",
      "Mitte",
      "Neu",
      "Ohne Jahr A",
      "Ohne Jahr B",
    ]);
    expect(await trefferTitel({ sortierung: "JAHR", richtung: "AB" })).toEqual([
      "Neu",
      "Auch Mitte",
      "Mitte",
      "Alt",
      "Ohne Jahr A",
      "Ohne Jahr B",
    ]);
  });

  it("AK-02.6 ohne Sortierung alphabetisch nach Titel aufsteigend", async () => {
    await legeTitelAn(t.pg, { title: "Gamma" });
    await legeTitelAn(t.pg, { title: "Alpha" });
    await legeTitelAn(t.pg, { title: "Delta" });
    await legeTitelAn(t.pg, { title: "Beta" });

    expect(await trefferTitel()).toEqual(["Alpha", "Beta", "Delta", "Gamma"]);
  });

  it("AK-02.7 bietet die Kategorien der aktiven Titel zur Auswahl an, jede einmal", async () => {
    await legeTitelAn(t.pg, { category: "Roman" });
    await legeTitelAn(t.pg, { category: "Roman" });
    await legeTitelAn(t.pg, { category: "Sachbuch" });
    await legeTitelAn(t.pg, { category: "Nur archiviert", archiviert: true });

    const kategorien = erwarteOk(await ladeKategorien(t.kontext(null)));
    expect([...kategorien].sort()).toEqual(["Roman", "Sachbuch"]);
  });

  it("AK-02.8 zeigt 20 Treffer je Seite und die Gesamtzahl", async () => {
    for (let i = 1; i <= 25; i++) await legeTitelAn(t.pg, { title: `Titel ${String(i).padStart(2, "0")}` });

    const seite1 = await suche({ seite: 1 });
    const seite2 = await suche({ seite: 2 });
    expect(seite1.treffer).toHaveLength(20);
    expect(seite1.gesamt).toBe(25);
    expect(seite1.seite).toBe(1);
    expect(seite2.treffer).toHaveLength(5);
    expect(seite2.gesamt).toBe(25);
    expect(seite2.seite).toBe(2);

    const alle = [...seite1.treffer, ...seite2.treffer].map((x) => x.title);
    expect(new Set(alle).size).toBe(25);
  });

  it("AK-02.8 ohne Seitenangabe wird Seite 1 geliefert", async () => {
    for (let i = 1; i <= 21; i++) await legeTitelAn(t.pg, { title: `Titel ${String(i).padStart(2, "0")}` });

    const ergebnis = await suche();
    expect(ergebnis.seite).toBe(1);
    expect(ergebnis.treffer).toHaveLength(20);
    expect(ergebnis.gesamt).toBe(21);
  });

  it("AK-02.8 Filter und Sortierung gelten über alle Seiten", async () => {
    for (let i = 1; i <= 30; i++) {
      await legeTitelAn(t.pg, {
        title: `Titel ${String(i).padStart(2, "0")}`,
        category: i % 2 === 0 ? "Gerade" : "Ungerade",
        publicationYear: 1900 + i,
      });
    }

    const anfrage = { kategorie: "Gerade", sortierung: "JAHR", richtung: "AB" } as const;
    const seite1 = await suche({ ...anfrage, seite: 1 });
    expect(seite1.gesamt).toBe(15);
    expect(seite1.treffer).toHaveLength(15);
    const jahre = seite1.treffer.map((x) => x.publicationYear);
    expect(jahre).toEqual([...jahre].sort((a, b) => Number(b) - Number(a)));
    expect(seite1.treffer.every((x) => x.category === "Gerade")).toBe(true);

    for (let i = 31; i <= 50; i++) {
      await legeTitelAn(t.pg, { title: `Titel ${i}`, category: "Gerade", publicationYear: 1800 + i });
    }
    const s1 = await suche({ ...anfrage, seite: 1 });
    const s2 = await suche({ ...anfrage, seite: 2 });
    expect(s1.gesamt).toBe(35);
    const zusammen = [...s1.treffer, ...s2.treffer].map((x) => Number(x.publicationYear));
    expect(zusammen).toHaveLength(35);
    expect(zusammen).toEqual([...zusammen].sort((a, b) => b - a));
  });

  it("AK-02.8 eine Seite hinter dem Ende ist leer, die Gesamtzahl stimmt", async () => {
    await legeTitelAn(t.pg, { title: "Einziger" });

    const ergebnis = await suche({ seite: 5 });
    expect(ergebnis.treffer).toEqual([]);
    expect(ergebnis.gesamt).toBe(1);
  });

  it("AK-02.8 eine Seitenzahl kleiner als 1 ist ungültig (VALIDIERUNG)", async () => {
    const felder = erwarteFehler(await sucheKatalog(t.kontext(null), { seite: 0 }), "VALIDIERUNG");
    expect(Object.keys(felder)).toContain("seite");
  });
});

describe("E01-US01-FR03 Jeder Treffer zeigt Titel, Autor, Kategorie und verfügbare Exemplare", () => {
  it("AK-03.1 ein Treffer enthält Titel, Autor, Kategorie und Anzahl verfügbarer Exemplare", async () => {
    const titleId = await legeTitelAn(t.pg, { title: "Der Process", author: "Franz Kafka", category: "Roman", publicationYear: 1925 });
    await legeExemplarAn(t.pg, titleId);
    await legeExemplarAn(t.pg, titleId);

    const [treffer] = (await suche({ q: "Process" })).treffer;
    expect(treffer).toMatchObject({
      titleId,
      title: "Der Process",
      author: "Franz Kafka",
      category: "Roman",
      publicationYear: 1925,
      verfuegbareExemplare: 2,
    });
  });

  it("AK-03.1 ein Titel ohne Exemplare zeigt 0 verfügbare Exemplare", async () => {
    await legeTitelAn(t.pg, { title: "Leer" });

    const [treffer] = (await suche({ q: "Leer" })).treffer;
    expect(treffer.verfuegbareExemplare).toBe(0);
  });

  it("AK-03.2 (Querverweis E02-US02-FR03) zählt ausgeliehene, vorgemerkte und verlorene Exemplare nicht", async () => {
    const titleId = await legeTitelAn(t.pg, { title: "Vier Exemplare" });
    const mitglied = await legeNutzerAn(t.pg, "MITGLIED");
    const andere = await legeNutzerAn(t.pg, "MITGLIED");
    await legeExemplarAn(t.pg, titleId); // verfügbar
    const ausgeliehen = await legeExemplarAn(t.pg, titleId);
    await legeAusleiheAn(t.pg, { copyId: ausgeliehen.id, memberId: mitglied.id, startDate: "2026-11-01", dueDate: "2026-11-29" });
    const vorgemerkt = await legeExemplarAn(t.pg, titleId);
    await legeVormerkungAn(t.pg, {
      titleId,
      memberId: andere.id,
      status: "ABHOLBEREIT",
      createdAt: zeitpunkt("2026-11-02"),
      copyId: vorgemerkt.id,
      pickupDeadline: "2026-11-12",
    });
    await legeExemplarAn(t.pg, titleId, { condition: "VERLOREN" });

    const [treffer] = (await suche({ q: "Vier Exemplare" })).treffer;
    expect(treffer.verfuegbareExemplare).toBe(1);
  });

  it("AK-03.2 ein beschädigtes Exemplar und ein zurückgegebenes Exemplar zählen als verfügbar", async () => {
    const titleId = await legeTitelAn(t.pg, { title: "Zwei verfügbar" });
    const mitglied = await legeNutzerAn(t.pg, "MITGLIED");
    await legeExemplarAn(t.pg, titleId, { condition: "BESCHAEDIGT" });
    const zurueck = await legeExemplarAn(t.pg, titleId);
    await legeAusleiheAn(t.pg, {
      copyId: zurueck.id,
      memberId: mitglied.id,
      startDate: "2026-10-01",
      dueDate: "2026-10-29",
      returnedAt: zeitpunkt("2026-10-20"),
    });

    const [treffer] = (await suche({ q: "Zwei verfügbar" })).treffer;
    expect(treffer.verfuegbareExemplare).toBe(2);
  });

  it("AK-03.3 (Querverweis E03-US01-FR04, F-05) nach einer Ausleihe ist die Anzahl um eins kleiner", async () => {
    const titleId = await legeTitelAn(t.pg, { title: "Wird ausgeliehen" });
    await legeExemplarAn(t.pg, titleId);
    await legeExemplarAn(t.pg, titleId);
    const mitglied = await legeNutzerAn(t.pg, "MITGLIED");

    const vorher = (await suche({ q: "Wird ausgeliehen" })).treffer[0].verfuegbareExemplare;
    erwarteOk(await ausleihen(t.kontext(sitzungFuer(mitglied)), { titleId }));
    const nachher = (await suche({ q: "Wird ausgeliehen" })).treffer[0].verfuegbareExemplare;

    expect(nachher).toBe(vorher - 1);
  });

  it("AK-03.4 Treffer enthalten keine Personendaten", async () => {
    const titleId = await legeAusgeliehenenTitelAn({ title: "Mit Ausleihe" });
    const vormerkend = await legeNutzerAn(t.pg, "MITGLIED");
    await legeVormerkungAn(t.pg, { titleId, memberId: vormerkend.id, status: "WARTEND", createdAt: zeitpunkt("2026-11-03") });
    const { rows } = await t.pg.query<{ id: string; email: string; role: "MITGLIED" }>("SELECT id, email, role FROM users");

    const ergebnis = await suche({ q: "Mit Ausleihe" });
    expect(ergebnis.treffer).toHaveLength(1);
    erwarteKeinePersonendaten(ergebnis, rows);
  });
});

describe("E01-US01-FR01 NFR02 Antwortzeit beim Testbestand (OF-F01-4)", () => {
  it("NFR02 Suche, Filter und Sortierung über 1 000 Titel antworten in unter 1 Sekunde", async () => {
    const mitglied = await legeNutzerAn(t.pg, "MITGLIED");
    await t.pg.exec(`
      INSERT INTO titles (id, title, author, category, isbn, description, publication_year, archived_at, created_at, updated_at)
      SELECT gen_random_uuid(), 'Bestand ' || lpad(i::text, 4, '0'), 'Autor ' || (i % 97), 'Kategorie ' || (i % 12),
             NULL, NULL, 1950 + (i % 75), NULL, now(), now()
      FROM generate_series(1, 1000) AS i;
      INSERT INTO copies (id, title_id, inventory_number, condition, created_at)
      SELECT gen_random_uuid(), x.id, 'INV-' || lpad((800000 + row_number() OVER ())::text, 6, '0'), 'GUT', now()
      FROM titles x CROSS JOIN generate_series(1, 2);
    `);
    await t.pg.query(
      `INSERT INTO loans (id, copy_id, member_id, start_date, due_date, renewal_count, returned_at, overdue_since, created_at)
       SELECT gen_random_uuid(), c.id, $1, DATE '2026-11-01', DATE '2026-11-29', 0, NULL, NULL, now()
       FROM (SELECT id, row_number() OVER (ORDER BY inventory_number) AS nr FROM copies) c WHERE c.nr % 3 = 0`,
      [mitglied.id],
    );
    expect(await zaehle(t.pg, "SELECT count(*) AS n FROM titles")).toBe(1000);

    const anfragen: Anfrage[] = [
      {},
      { q: "Bestand 05" },
      { q: "Autor 4", nurVerfuegbar: true, sortierung: "VERFUEGBARKEIT", richtung: "AB" },
      { kategorie: "Kategorie 3", jahrVon: 1960, jahrBis: 2000, sortierung: "JAHR", richtung: "AUF", seite: 2 },
      { q: "INV-8005" },
    ];
    await sucheKatalog(t.kontext(null), {}); // Aufwärmen (erste Abfrage, Pläne)
    for (const anfrage of anfragen) {
      const start = performance.now();
      erwarteOk(await sucheKatalog(t.kontext(null), anfrage));
      const dauer = performance.now() - start;
      expect(dauer, `Anfrage ${JSON.stringify(anfrage)} dauerte ${Math.round(dauer)} ms`).toBeLessThan(1000);
    }
  }, 120_000);
});
