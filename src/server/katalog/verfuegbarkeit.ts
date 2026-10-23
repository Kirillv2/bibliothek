// Verfügbarkeit eines Exemplars als SQL (ADR 005, Punkt 2): dieselbe Regel wie `leiteExemplarstatusAb`.
// Verfügbar ist ein Exemplar, das weder ausgeliehen, vorgemerkt noch gesperrt ist (E02-US02-FR03).
import { sql, type SQL } from "drizzle-orm";

/** Bedingung „Exemplar ist verfügbar“ für ein Exemplar mit dem SQL-Alias `alias` (Tabelle copies). */
export function exemplarIstVerfuegbar(alias: string): SQL {
  const c = sql.raw(alias);
  return sql`(
    ${c}.condition <> 'VERLOREN'
    AND NOT EXISTS (SELECT 1 FROM loans l WHERE l.copy_id = ${c}.id AND l.returned_at IS NULL)
    AND NOT EXISTS (SELECT 1 FROM reservations r WHERE r.copy_id = ${c}.id AND r.status = 'ABHOLBEREIT')
  )`;
}

/** Anzahl verfügbarer Exemplare des Titels mit dem SQL-Alias `titelAlias` (Tabelle titles). */
export function anzahlVerfuegbar(titelAlias: string): SQL {
  const t = sql.raw(titelAlias);
  return sql`(SELECT count(*)::int FROM copies vc WHERE vc.title_id = ${t}.id AND ${exemplarIstVerfuegbar("vc")})`;
}
