// Vorprüfungen, bevor eine Seite gerendert wird. Nur hier lässt sich der HTTP-Status noch setzen,
// denn die Seiten streamen ihre Antwort (Next.js: notFound() nach Streaming-Beginn bleibt 200).
// Rechte prüft trotzdem jede Seite und jede Server Action selbst auf dem Server (ADR 003, security-architektur.md 4).
import { NextResponse, type NextRequest } from "next/server";
import { SITZUNGS_COOKIE } from "./server/auth/cookie";
import { holeDatenbank } from "./server/db/verbindung";
import { titelIstSichtbar } from "./server/katalog/detail";

// Ein Pfad ohne Seite: Next.js antwortet darauf mit der „nicht gefunden“-Seite und HTTP 404.
const NICHT_GEFUNDEN = "/_nicht-gefunden";

export async function proxy(anfrage: NextRequest) {
  const pfad = anfrage.nextUrl.pathname;

  // F-02 AK-01.8, AK-01.9: unbekannter oder archivierter Titel → echte 404-Antwort
  const titel = /^\/titel\/([^/]+)\/?$/.exec(pfad);
  if (titel) {
    const sichtbar = await titelIstSichtbar(await holeDatenbank(), decodeURIComponent(titel[1]));
    return sichtbar ? NextResponse.next() : NextResponse.rewrite(new URL(NICHT_GEFUNDEN, anfrage.url));
  }

  // E06-US01-FR02: Gäste werden von geschützten Seiten direkt zur Anmeldung geleitet (nur Cookie-Vorprüfung)
  if (anfrage.cookies.has(SITZUNGS_COOKIE)) return NextResponse.next();
  const ziel = new URL("/anmelden", anfrage.url);
  ziel.searchParams.set("weiter", pfad + anfrage.nextUrl.search);
  return NextResponse.redirect(ziel);
}

export const config = {
  matcher: ["/konto/:path*", "/verwaltung/:path*", "/titel/:titleId"],
};
