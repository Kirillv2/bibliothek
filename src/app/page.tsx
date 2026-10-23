// F-01 · E01-US01 · Katalogseite: Suche, Filter und Sortierung auf einer Seite (NFR01), ohne Anmeldung.
import Link from "next/link";
import { erstelleOeffentlichenKontext } from "@/server/anfrage";
import {
  ladeKategorien,
  sucheKatalog,
  SORTIERUNGEN,
  TREFFER_JE_SEITE,
  type KatalogAnfrage,
  type Richtung,
  type Sortierung,
} from "@/server/katalog/suche";

export const instant = false;

type Parameter = Record<string, string | string[] | undefined>;

function text(wert: string | string[] | undefined): string | undefined {
  const einzeln = Array.isArray(wert) ? wert[0] : wert;
  return einzeln === undefined || einzeln.trim() === "" ? undefined : einzeln;
}

function ganzzahl(wert: string | string[] | undefined): number | undefined {
  const t = text(wert);
  // zu große Zahlen werden wie unlesbare ignoriert (sonst scheitert die Abfrage)
  return t !== undefined && /^-?\d+$/.test(t.trim()) && Number.isSafeInteger(Number(t)) ? Number(t) : undefined;
}

/** URL-Parameter → Anfrage. Unlesbare Werte werden ignoriert, statt die Seite scheitern zu lassen. */
function leseAnfrage(p: Parameter): KatalogAnfrage {
  const sortierung = text(p.sortierung);
  const seite = ganzzahl(p.seite);
  return {
    q: text(p.q),
    kategorie: text(p.kategorie),
    nurVerfuegbar: text(p.verfuegbar) === "1",
    jahrVon: ganzzahl(p.jahrVon),
    jahrBis: ganzzahl(p.jahrBis),
    sortierung: SORTIERUNGEN.includes(sortierung as Sortierung) ? (sortierung as Sortierung) : undefined,
    richtung: text(p.richtung) === "AB" ? ("AB" as Richtung) : "AUF",
    seite: seite !== undefined && seite >= 1 ? seite : 1,
  };
}

function seitenLink(p: Parameter, seite: number): string {
  const suche = new URLSearchParams();
  for (const [schluessel, wert] of Object.entries(p)) {
    const t = text(wert);
    if (t !== undefined && schluessel !== "seite") suche.set(schluessel, t);
  }
  suche.set("seite", String(seite));
  return `/?${suche.toString()}`;
}

const SORTIER_NAMEN: Record<Sortierung, string> = {
  TITEL: "Titel",
  KATEGORIE: "Kategorie",
  VERFUEGBARKEIT: "Verfügbarkeit",
  JAHR: "Erscheinungsjahr",
};

export default async function KatalogSeite({ searchParams }: PageProps<"/">) {
  const parameter = await searchParams;
  const anfrage = leseAnfrage(parameter);
  const k = await erstelleOeffentlichenKontext();
  const [ergebnis, kategorien] = await Promise.all([sucheKatalog(k, anfrage), ladeKategorien(k)]);
  const kategorieListe = kategorien.ok ? kategorien.daten : [];

  return (
    <>
      <h1>Katalog</h1>
      <form method="get" action="/" className="felder" role="search">
        <label className="breit">
          Suchbegriff (Titel, Autor, ISBN oder Inventarnummer)
          <input type="search" name="q" defaultValue={anfrage.q ?? ""} />
        </label>
        <label>
          Kategorie
          <select name="kategorie" defaultValue={anfrage.kategorie ?? ""}>
            <option value="">Alle Kategorien</option>
            {kategorieListe.map((kategorie) => (
              <option key={kategorie} value={kategorie}>
                {kategorie}
              </option>
            ))}
          </select>
        </label>
        <label>
          Erscheinungsjahr von
          <input type="number" name="jahrVon" inputMode="numeric" defaultValue={anfrage.jahrVon ?? ""} />
        </label>
        <label>
          Erscheinungsjahr bis
          <input type="number" name="jahrBis" inputMode="numeric" defaultValue={anfrage.jahrBis ?? ""} />
        </label>
        <label>
          Sortieren nach
          <select name="sortierung" defaultValue={anfrage.sortierung ?? "TITEL"}>
            {SORTIERUNGEN.map((s) => (
              <option key={s} value={s}>
                {SORTIER_NAMEN[s]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Richtung
          <select name="richtung" defaultValue={anfrage.richtung}>
            <option value="AUF">aufsteigend</option>
            <option value="AB">absteigend</option>
          </select>
        </label>
        <label className="waagrecht">
          <input type="checkbox" name="verfuegbar" value="1" defaultChecked={anfrage.nurVerfuegbar} />
          Nur verfügbare Titel
        </label>
        <div>
          <button type="submit">Suchen</button>
        </div>
      </form>

      {!ergebnis.ok ? (
        <p className="meldung fehler" role="alert">
          Die Suchangaben sind ungültig: {Object.values(ergebnis.felder ?? {}).join(" ")}
        </p>
      ) : ergebnis.daten.gesamt === 0 ? (
        <p className="meldung" role="status">
          Keine Treffer: Es wurde nichts gefunden.
        </p>
      ) : (
        <>
          <p role="status">
            {ergebnis.daten.gesamt} {ergebnis.daten.gesamt === 1 ? "Treffer" : "Treffer"}
          </p>
          <table>
            <thead>
              <tr>
                <th>Titel</th>
                <th>Autor</th>
                <th>Kategorie</th>
                <th>Jahr</th>
                <th>Verfügbare Exemplare</th>
              </tr>
            </thead>
            <tbody>
              {ergebnis.daten.treffer.map((treffer) => (
                <tr key={treffer.titleId}>
                  <td>
                    <Link href={`/titel/${treffer.titleId}`}>{treffer.title}</Link>
                  </td>
                  <td>{treffer.author}</td>
                  <td>{treffer.category}</td>
                  <td>{treffer.publicationYear ?? "–"}</td>
                  <td>{treffer.verfuegbareExemplare}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Blaettern parameter={parameter} seite={ergebnis.daten.seite} gesamt={ergebnis.daten.gesamt} />
        </>
      )}
    </>
  );
}

function Blaettern({ parameter, seite, gesamt }: { parameter: Parameter; seite: number; gesamt: number }) {
  const seiten = Math.max(1, Math.ceil(gesamt / TREFFER_JE_SEITE));
  if (seiten === 1) return null;
  return (
    <nav className="blaettern" aria-label="Seiten">
      {seite > 1 && <Link href={seitenLink(parameter, seite - 1)}>Vorherige Seite</Link>}
      <span>
        Seite {seite} von {seiten}
      </span>
      {seite < seiten && <Link href={seitenLink(parameter, seite + 1)}>Nächste Seite</Link>}
    </nav>
  );
}
