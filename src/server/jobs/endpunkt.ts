// Schutz der Job-Endpunkte (ADR 007 Punkt 2, Security-Architektur 5): nur mit `Authorization: Bearer <JOB_SECRET>`.
// Ohne gesetztes Secret ist der Endpunkt immer gesperrt (OF-F08-4). Eine Nutzer-Sitzung spielt keine Rolle.
import { createHash, timingSafeEqual } from "node:crypto";

function hash(text: string): Buffer {
  return createHash("sha256").update(text).digest();
}

/** Zeitkonstanter Vergleich des Bearer-Tokens mit dem Secret (gleich lange Hashes, kein Längen-Leck). */
export function jobSecretGueltig(authorization: string | null, secret: string | undefined): boolean {
  if (!secret) return false;
  const praefix = "Bearer ";
  if (!authorization || !authorization.startsWith(praefix)) return false;
  return timingSafeEqual(hash(authorization.slice(praefix.length)), hash(secret));
}

type JobErgebnis = { ok: true; daten: unknown } | { ok: false; fehler: string };

/**
 * Gemeinsamer Ablauf aller Job-Endpunkte. Der Stichtag kommt nie aus der Anfrage (OF-F08-4):
 * Query und Body werden nicht gelesen.
 */
export async function bearbeiteJobAnfrage(
  anfrage: Request,
  optionen: { secret: string | undefined; ausfuehren: () => Promise<JobErgebnis | unknown> },
): Promise<Response> {
  if (!jobSecretGueltig(anfrage.headers.get("authorization"), optionen.secret)) {
    return new Response("Nicht autorisiert", { status: 401, headers: { "cache-control": "no-store" } });
  }
  const ergebnis = (await optionen.ausfuehren()) as JobErgebnis;
  if (ergebnis && typeof ergebnis === "object" && "ok" in ergebnis) {
    if (!ergebnis.ok) return Response.json({ fehler: ergebnis.fehler }, { status: 500 });
    return Response.json(ergebnis.daten, { headers: { "cache-control": "no-store" } });
  }
  return Response.json(ergebnis, { headers: { "cache-control": "no-store" } });
}
