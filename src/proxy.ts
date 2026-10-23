// Gäste werden von geschützten Seiten direkt zur Anmeldung geleitet (E06-US01-FR02).
// Das ist nur eine schnelle Vorprüfung auf das Cookie; Sitzung und Rolle prüft jede Seite und
// jede Server Action selbst auf dem Server (ADR 003, security-architektur.md 4).
import { NextResponse, type NextRequest } from "next/server";
import { SITZUNGS_COOKIE } from "./server/auth/cookie";

export function proxy(anfrage: NextRequest) {
  if (anfrage.cookies.has(SITZUNGS_COOKIE)) return NextResponse.next();
  const ziel = new URL("/anmelden", anfrage.url);
  ziel.searchParams.set("weiter", anfrage.nextUrl.pathname + anfrage.nextUrl.search);
  return NextResponse.redirect(ziel);
}

export const config = {
  matcher: ["/konto/:path*", "/verwaltung/:path*"],
};
