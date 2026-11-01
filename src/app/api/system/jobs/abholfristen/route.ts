// F-10 · E05-US01-FR03 · Endpunkt der Abholfristen für den täglichen Auslöser (ADR 007, config-request #30).
import { holeDatenbank } from "@/server/db/verbindung";
import { abholfristen } from "@/server/jobs/abholfristen";
import { bearbeiteJobAnfrage } from "@/server/jobs/endpunkt";
import { systemUhr } from "@/server/kontext";

export async function POST(anfrage: Request): Promise<Response> {
  return bearbeiteJobAnfrage(anfrage, {
    secret: process.env.JOB_SECRET,
    ausfuehren: async () => abholfristen({ db: await holeDatenbank(), uhr: systemUhr, sitzung: null }),
  });
}
