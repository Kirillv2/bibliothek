// F-01 · E01-US01 · Katalog durchsuchen, filtern und sortieren (Spec docs/specs/F-01_E01-US01.md)
// Für alle Rollen inkl. Gast; die Antwort enthält keine Personendaten (AK-03.4).
import { sql, type SQL } from "drizzle-orm";
import { zeilen } from "../db";
import { erfolg, fehler, type Ergebnis } from "../ergebnis";
import type { Kontext } from "../kontext";
import { anzahlVerfuegbar } from "./verfuegbarkeit";

// OF-F01-6: 20 Treffer je Seite
export const TREFFER_JE_SEITE = 20;

export const SORTIERUNGEN = ["TITEL", "KATEGORIE", "VERFUEGBARKEIT", "JAHR"] as const;
export type Sortierung = (typeof SORTIERUNGEN)[number];
export type Richtung = "AUF" | "AB";

export type KatalogAnfrage = {
  q?: string;
  kategorie?: string;
  nurVerfuegbar?: boolean;
  jahrVon?: number;
  jahrBis?: number;
  sortierung?: Sortierung;
  richtung?: Richtung;
  seite?: number;
};

export type KatalogTreffer = {
  titleId: string;
  title: string;
  author: string;
  category: string;
  publicationYear: number | null;
  verfuegbareExemplare: number;
};

export type KatalogErgebnis = { treffer: KatalogTreffer[]; gesamt: number; seite: number };

type GepruefteAnfrage = {
  q: string | null;
  kategorie: string | null;
  nurVerfuegbar: boolean;
  jahrVon: number | null;
  jahrBis: number | null;
  sortierung: Sortierung;
  richtung: Richtung;
  seite: number;
};

function istGanzzahl(wert: unknown): wert is number {
  return typeof wert === "number" && Number.isSafeInteger(wert);
}

function pruefe(
  anfrage: KatalogAnfrage,
): { gueltig: true; anfrage: GepruefteAnfrage } | { gueltig: false; felder: Record<string, string> } {
  const felder: Record<string, string> = {};
  const { q, kategorie, nurVerfuegbar, jahrVon, jahrBis, sortierung, richtung, seite } = anfrage;
  if (q !== undefined && typeof q !== "string") felder.q = "Suchbegriff muss Text sein.";
  if (kategorie !== undefined && typeof kategorie !== "string") felder.kategorie = "Kategorie muss Text sein.";
  if (nurVerfuegbar !== undefined && typeof nurVerfuegbar !== "boolean") felder.nurVerfuegbar = "Ungültiger Wert.";
  if (jahrVon !== undefined && !istGanzzahl(jahrVon)) felder.jahrVon = "Jahr muss eine ganze Zahl sein.";
  if (jahrBis !== undefined && !istGanzzahl(jahrBis)) felder.jahrBis = "Jahr muss eine ganze Zahl sein.";
  if (sortierung !== undefined && !SORTIERUNGEN.includes(sortierung)) felder.sortierung = "Unbekannte Sortierung.";
  if (richtung !== undefined && richtung !== "AUF" && richtung !== "AB") felder.richtung = "Unbekannte Richtung.";
  if (seite !== undefined && (!istGanzzahl(seite) || seite < 1)) felder.seite = "Seite muss eine ganze Zahl ab 1 sein.";
  if (Object.keys(felder).length > 0) return { gueltig: false, felder };

  return {
    gueltig: true,
    anfrage: {
      // OF-F01-2: ein leerer Suchbegriff zählt wie kein Suchbegriff
      q: typeof q === "string" && q.trim() !== "" ? q.trim() : null,
      kategorie: typeof kategorie === "string" && kategorie !== "" ? kategorie : null,
      nurVerfuegbar: nurVerfuegbar === true,
      jahrVon: jahrVon ?? null,
      jahrBis: jahrBis ?? null,
      sortierung: sortierung ?? "TITEL",
      richtung: richtung ?? "AUF",
      seite: seite ?? 1,
    },
  };
}

/** Sonderzeichen für LIKE entschärfen: `%` und `_` sind normale Zeichen (AK-01.9). */
function alsTeilwortMuster(text: string): string {
  return `%${text.replace(/[\\%_]/g, (zeichen) => `\\${zeichen}`)}%`;
}

function filter(a: GepruefteAnfrage): SQL {
  // OF-D4, OF-F01-5: archivierte Titel erscheinen nicht im Katalog
  const bedingungen: SQL[] = [sql`t.archived_at IS NULL`];

  if (a.q) {
    // E01-US01-FR01, OF-F01-1: Teilwort ohne Groß-/Kleinschreibung über Titel, Autor, ISBN und Inventarnummer
    const muster = alsTeilwortMuster(a.q);
    const teile: SQL[] = [sql`t.title ILIKE ${muster}`, sql`t.author ILIKE ${muster}`];
    const ohneTrenner = a.q.replace(/[-\s]/g, "");
    if (ohneTrenner !== "") {
      // bei ISBN und Inventarnummer werden Bindestriche und Leerzeichen ignoriert
      const kennungsMuster = alsTeilwortMuster(ohneTrenner);
      teile.push(sql`translate(coalesce(t.isbn, ''), '- ', '') ILIKE ${kennungsMuster}`);
      teile.push(
        sql`EXISTS (SELECT 1 FROM copies sc WHERE sc.title_id = t.id AND translate(sc.inventory_number, '- ', '') ILIKE ${kennungsMuster})`,
      );
    }
    bedingungen.push(sql`(${sql.join(teile, sql` OR `)})`);
  }

  // E01-US01-FR02: Filter nach Kategorie und Erscheinungsjahr (Grenzen eingeschlossen, ohne Jahr fällt heraus)
  if (a.kategorie !== null) bedingungen.push(sql`t.category = ${a.kategorie}`);
  if (a.jahrVon !== null) bedingungen.push(sql`t.publication_year >= ${a.jahrVon}`);
  if (a.jahrBis !== null) bedingungen.push(sql`t.publication_year <= ${a.jahrBis}`);

  return sql.join(bedingungen, sql` AND `);
}

function reihenfolge(a: GepruefteAnfrage): SQL {
  const richtung = a.richtung === "AB" ? "DESC" : "ASC";
  // OF-F01-3: Titel ist immer das zweite Kriterium und immer aufsteigend
  const nachTitel = "lower(k.title) ASC, k.title ASC, k.id ASC";
  switch (a.sortierung) {
    case "KATEGORIE":
      return sql.raw(`lower(k.category) ${richtung}, ${nachTitel}`);
    case "VERFUEGBARKEIT":
      return sql.raw(`k.verfuegbar ${richtung}, ${nachTitel}`);
    case "JAHR":
      // OF-D1: Titel ohne Erscheinungsjahr stehen in beiden Richtungen am Ende
      return sql.raw(`k.publication_year ${richtung} NULLS LAST, ${nachTitel}`);
    default:
      return sql.raw(nachTitel);
  }
}

export async function sucheKatalog(k: Kontext, anfrage: KatalogAnfrage): Promise<Ergebnis<KatalogErgebnis>> {
  const geprueft = pruefe(anfrage);
  if (!geprueft.gueltig) return fehler("VALIDIERUNG", geprueft.felder);
  const a = geprueft.anfrage;

  // E01-US01-FR03: je Treffer Titel, Autor, Kategorie und Anzahl verfügbarer Exemplare
  const katalog = sql`(
    SELECT t.id, t.title, t.author, t.category, t.publication_year, ${anzahlVerfuegbar("t")} AS verfuegbar
    FROM titles t
    WHERE ${filter(a)}
  ) k`;
  const nurVerfuegbar = a.nurVerfuegbar ? sql`k.verfuegbar > 0` : sql`TRUE`;

  const [anzahl] = zeilen<{ n: number }>(
    await k.db.execute(sql`SELECT count(*)::int AS n FROM ${katalog} WHERE ${nurVerfuegbar}`),
  );
  const seite = zeilen<{
    id: string;
    title: string;
    author: string;
    category: string;
    publication_year: number | null;
    verfuegbar: number;
  }>(
    await k.db.execute(sql`
      SELECT k.* FROM ${katalog}
      WHERE ${nurVerfuegbar}
      ORDER BY ${reihenfolge(a)}
      LIMIT ${TREFFER_JE_SEITE} OFFSET ${(a.seite - 1) * TREFFER_JE_SEITE}
    `),
  );

  return erfolg({
    treffer: seite.map((z) => ({
      titleId: z.id,
      title: z.title,
      author: z.author,
      category: z.category,
      publicationYear: z.publication_year === null ? null : Number(z.publication_year),
      verfuegbareExemplare: Number(z.verfuegbar),
    })),
    gesamt: Number(anzahl?.n ?? 0),
    seite: a.seite,
  });
}

/** AK-02.7, OF-D5: Kategorien der aktiven Titel für den Filter, jede einmal. */
export async function ladeKategorien(k: Kontext): Promise<Ergebnis<string[]>> {
  const kategorien = zeilen<{ category: string }>(
    await k.db.execute(
      sql`SELECT DISTINCT category FROM titles WHERE archived_at IS NULL ORDER BY category`,
    ),
  );
  return erfolg(kategorien.map((z) => z.category));
}
