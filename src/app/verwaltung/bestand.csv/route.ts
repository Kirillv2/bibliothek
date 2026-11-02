// F-13 · E07-US01-FR03 · Download des Bestandsexports (nur Bibliothekar). Prüfung in `exportiereBestandCsv`.
import { NextResponse } from "next/server";
import { erstelleKontext } from "@/server/anfrage";
import { exportiereBestandCsv } from "@/server/dashboard";

export async function GET(anfrage: Request): Promise<Response> {
  const ergebnis = await exportiereBestandCsv(await erstelleKontext());
  if (!ergebnis.ok) {
    // Gast (z. B. abgelaufene Sitzung) → Anmeldung, danach zurück zum Dashboard (E06-US01-FR02)
    if (ergebnis.fehler === "NICHT_ANGEMELDET") {
      const ziel = new URL("/anmelden", anfrage.url);
      ziel.searchParams.set("weiter", "/verwaltung/dashboard");
      return NextResponse.redirect(ziel);
    }
    return new NextResponse("Dafür fehlt dir die Berechtigung.", { status: 403 });
  }
  return new NextResponse(ergebnis.daten.inhalt, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${ergebnis.daten.dateiname}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
