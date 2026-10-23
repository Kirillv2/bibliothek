// F-03 · E02-US01 · Titel anlegen, bearbeiten und archivieren (Spec docs/specs/F-03_E02-US01.md)
// Nur Bibliothekar (Rechte-Matrix, OF-R3). Archivierte Titel werden weder bearbeitet noch reaktiviert (OF-F03-3).
import { sql } from "drizzle-orm";
import { jahrVon } from "@/lib/datum";
import { istGueltigeIsbnForm } from "@/lib/isbn";
import { pruefeRolle } from "./auth/rechte";
import { zeilen } from "./db";
import { istUuid, textOderNull, type MitWeiterenFeldern } from "./eingabe";
import { Abbruch, erfolg, fehler, type Ergebnis } from "./ergebnis";
import type { Kontext } from "./kontext";

export type TitelFelder = {
  title?: unknown;
  author?: unknown;
  category?: unknown;
  isbn?: unknown;
  description?: unknown;
  publicationYear?: unknown;
} & MitWeiterenFeldern;

export type TitelBearbeitenEingabe = { titleId: string } & TitelFelder;

type GepruefteFelder = {
  title: string;
  author: string;
  category: string;
  isbn: string | null;
  description: string | null;
  publicationYear: number | null;
};

const PFLICHTFELDER = { title: "Titel", author: "Autor", category: "Kategorie" } as const;

/** AK-01.3 bis AK-01.6, AK-02.2: Pflichtfelder, ISBN-Form und Erscheinungsjahr; alle Fehler auf einmal. */
function pruefeFelder(
  k: Kontext,
  eingabe: TitelFelder,
): { gueltig: true; felder: GepruefteFelder } | { gueltig: false; felder: Record<string, string> } {
  const fehlerFelder: Record<string, string> = {};

  const pflicht = {} as Record<keyof typeof PFLICHTFELDER, string>;
  for (const [feld, name] of Object.entries(PFLICHTFELDER) as [keyof typeof PFLICHTFELDER, string][]) {
    const wert = textOderNull(eingabe?.[feld]);
    if (wert === null) fehlerFelder[feld] = `${name} ist ein Pflichtfeld.`;
    else pflicht[feld] = wert;
  }

  const isbn = textOderNull(eingabe?.isbn);
  if (eingabe?.isbn != null && typeof eingabe.isbn !== "string") fehlerFelder.isbn = "ISBN muss Text sein.";
  else if (isbn !== null && !istGueltigeIsbnForm(isbn)) {
    fehlerFelder.isbn = "Die ISBN muss 10 Zeichen (letztes auch X) oder 13 Ziffern haben; Bindestriche und Leerzeichen sind erlaubt.";
  }

  const description = textOderNull(eingabe?.description);
  if (eingabe?.description != null && typeof eingabe.description !== "string") {
    fehlerFelder.description = "Beschreibung muss Text sein.";
  }

  // OF-D1: optional; sonst positive ganze Zahl, höchstens das aktuelle Jahr laut Uhr
  const jahr = eingabe?.publicationYear;
  let publicationYear: number | null = null;
  if (jahr !== undefined && jahr !== null) {
    const aktuellesJahr = jahrVon(k.uhr.heute());
    if (typeof jahr !== "number" || !Number.isInteger(jahr) || jahr < 1) {
      fehlerFelder.publicationYear = "Das Erscheinungsjahr muss eine positive ganze Zahl sein.";
    } else if (jahr > aktuellesJahr) {
      fehlerFelder.publicationYear = `Das Erscheinungsjahr darf nicht nach ${aktuellesJahr} liegen.`;
    } else {
      publicationYear = jahr;
    }
  }

  if (Object.keys(fehlerFelder).length > 0) return { gueltig: false, felder: fehlerFelder };
  return { gueltig: true, felder: { ...pflicht, isbn, description, publicationYear } };
}

export async function titelAnlegen(k: Kontext, eingabe: TitelFelder): Promise<Ergebnis<{ titleId: string }>> {
  const rechte = pruefeRolle(k.sitzung, "BIBLIOTHEKAR");
  if (rechte) return rechte;
  const geprueft = pruefeFelder(k, eingabe);
  if (!geprueft.gueltig) return fehler("VALIDIERUNG", geprueft.felder);
  const f = geprueft.felder;
  const jetzt = k.uhr.jetzt();

  // E02-US01-FR01: neu angelegt, noch ohne Exemplare (AK-01.7)
  const [neu] = zeilen<{ id: string }>(
    await k.db.execute(sql`
      INSERT INTO titles (title, author, category, isbn, description, publication_year, created_at, updated_at)
      VALUES (${f.title}, ${f.author}, ${f.category}, ${f.isbn}, ${f.description}, ${f.publicationYear}, ${jetzt}, ${jetzt})
      RETURNING id`),
  );
  return erfolg({ titleId: neu.id });
}

export async function titelBearbeiten(k: Kontext, eingabe: TitelBearbeitenEingabe): Promise<Ergebnis<{ titleId: string }>> {
  const rechte = pruefeRolle(k.sitzung, "BIBLIOTHEKAR");
  if (rechte) return rechte;
  const titleId = eingabe?.titleId;
  if (!istUuid(titleId)) return fehler("NICHT_GEFUNDEN");
  const geprueft = pruefeFelder(k, eingabe);
  if (!geprueft.gueltig) return fehler("VALIDIERUNG", geprueft.felder);
  const f = geprueft.felder;

  // E02-US01-FR02: nur die Titeldaten; Ausleihvorgänge bleiben unverändert (AK-02.3).
  // AK-02.5, AK-03.8: unbekannt oder archiviert → NICHT_GEFUNDEN
  const geaendert = zeilen<{ id: string }>(
    await k.db.execute(sql`
      UPDATE titles SET title = ${f.title}, author = ${f.author}, category = ${f.category}, isbn = ${f.isbn},
        description = ${f.description}, publication_year = ${f.publicationYear}, updated_at = ${k.uhr.jetzt()}
      WHERE id = ${titleId} AND archived_at IS NULL
      RETURNING id`),
  );
  if (geaendert.length === 0) return fehler("NICHT_GEFUNDEN");
  return erfolg({ titleId });
}

export async function titelArchivieren(
  k: Kontext,
  eingabe: { titleId: string } & MitWeiterenFeldern,
): Promise<Ergebnis<{ titleId: string; archivedAt: string }>> {
  const rechte = pruefeRolle(k.sitzung, "BIBLIOTHEKAR");
  if (rechte) return rechte;
  const titleId = eingabe?.titleId;
  if (!istUuid(titleId)) return fehler("NICHT_GEFUNDEN");

  try {
    return erfolg(
      await k.db.transaction(async (tx) => {
        // Sperre gegen eine gleichzeitige Ausleihe desselben Titels (ausleihen() sperrt ihn FOR SHARE)
        const [titel] = zeilen<{ id: string }>(
          await tx.execute(sql`SELECT id FROM titles WHERE id = ${titleId} AND archived_at IS NULL FOR UPDATE`),
        );
        // AK-03.8: ein bereits archivierter Titel bleibt, wie er ist
        if (!titel) throw new Abbruch(fehler("NICHT_GEFUNDEN"));

        // E02-US01-FR03: kein Exemplar ausgeliehen (AK-03.2) und keine aktive Vormerkung (AK-03.3, AK-03.4, OF-F03-1)
        const [blockiert] = zeilen<{ ja: boolean }>(
          await tx.execute(sql`
            SELECT (
              EXISTS (SELECT 1 FROM loans l JOIN copies c ON c.id = l.copy_id
                      WHERE c.title_id = ${titleId} AND l.returned_at IS NULL)
              OR EXISTS (SELECT 1 FROM reservations r
                         WHERE r.title_id = ${titleId} AND r.status IN ('WARTEND', 'ABHOLBEREIT'))
            ) AS ja`),
        );
        if (blockiert?.ja) throw new Abbruch(fehler("TITEL_NICHT_ARCHIVIERBAR"));

        const archivedAt = k.uhr.jetzt();
        await tx.execute(sql`UPDATE titles SET archived_at = ${archivedAt}, updated_at = ${archivedAt} WHERE id = ${titleId}`);
        return { titleId, archivedAt: archivedAt.toISOString() };
      }),
    );
  } catch (e) {
    if (e instanceof Abbruch) return e.ergebnis;
    throw e;
  }
}

export type VerwaltungsEintrag = {
  titleId: string;
  title: string;
  author: string;
  category: string;
  isbn: string | null;
  publicationYear: number | null;
  archiviert: boolean;
  anzahlExemplare: number;
};

/** AK-03.7: alle Titel für die Verwaltung, archivierte gekennzeichnet; aktive zuerst, dann nach Titel. */
export async function ladeVerwaltungsliste(k: Kontext): Promise<Ergebnis<VerwaltungsEintrag[]>> {
  const rechte = pruefeRolle(k.sitzung, "BIBLIOTHEKAR");
  if (rechte) return rechte;
  const liste = zeilen<{
    id: string;
    title: string;
    author: string;
    category: string;
    isbn: string | null;
    publication_year: number | null;
    archiviert: boolean;
    exemplare: number;
  }>(
    await k.db.execute(sql`
      SELECT t.id, t.title, t.author, t.category, t.isbn, t.publication_year,
        t.archived_at IS NOT NULL AS archiviert,
        (SELECT count(*)::int FROM copies c WHERE c.title_id = t.id) AS exemplare
      FROM titles t
      ORDER BY t.archived_at IS NOT NULL, lower(t.title), t.id`),
  );
  return erfolg(
    liste.map((z) => ({
      titleId: z.id,
      title: z.title,
      author: z.author,
      category: z.category,
      isbn: z.isbn,
      publicationYear: z.publication_year === null ? null : Number(z.publication_year),
      archiviert: Boolean(z.archiviert),
      anzahlExemplare: Number(z.exemplare),
    })),
  );
}

export type TitelZurBearbeitung = Omit<VerwaltungsEintrag, "anzahlExemplare"> & { description: string | null };

/** Ein Titel für das Bearbeitungsformular der Verwaltung, auch wenn er archiviert ist. */
export async function ladeTitelZurBearbeitung(k: Kontext, titleId: string): Promise<Ergebnis<TitelZurBearbeitung>> {
  const rechte = pruefeRolle(k.sitzung, "BIBLIOTHEKAR");
  if (rechte) return rechte;
  if (!istUuid(titleId)) return fehler("NICHT_GEFUNDEN");
  const [z] = zeilen<{
    id: string;
    title: string;
    author: string;
    category: string;
    isbn: string | null;
    description: string | null;
    publication_year: number | null;
    archiviert: boolean;
  }>(
    await k.db.execute(sql`
      SELECT id, title, author, category, isbn, description, publication_year, archived_at IS NOT NULL AS archiviert
      FROM titles WHERE id = ${titleId}`),
  );
  if (!z) return fehler("NICHT_GEFUNDEN");
  return erfolg({
    titleId: z.id,
    title: z.title,
    author: z.author,
    category: z.category,
    isbn: z.isbn,
    description: z.description,
    publicationYear: z.publication_year === null ? null : Number(z.publication_year),
    archiviert: Boolean(z.archiviert),
  });
}
