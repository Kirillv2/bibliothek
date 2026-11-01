// F-08 · E04-US01-FR01 · Endpunkt der Fristprüfung für den täglichen Auslöser (ADR 007, config-request #30).
// Nur POST mit `Authorization: Bearer <JOB_SECRET>`; andere Methoden beantwortet Next.js mit 405.
import { holeDatenbank } from "@/server/db/verbindung";
import { bearbeiteJobAnfrage } from "@/server/jobs/endpunkt";
import { fristpruefung } from "@/server/jobs/fristpruefung";
import { systemUhr } from "@/server/kontext";

export async function POST(anfrage: Request): Promise<Response> {
  return bearbeiteJobAnfrage(anfrage, {
    secret: process.env.JOB_SECRET,
    ausfuehren: async () => fristpruefung({ db: await holeDatenbank(), uhr: systemUhr, sitzung: null }),
  });
}
