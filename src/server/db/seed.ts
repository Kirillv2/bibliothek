// Seed für die lokale Entwicklung (ADR 003, Punkt 5): je ein Konto pro Rolle und ein kleiner Beispielbestand.
// Annahme (Spec schweigt, Wunsch des Teams): Die Test-Konten haben feste, bekannte Passwörter, die auch im
// README stehen, damit sie nicht bei jedem Neuaufbau wechseln. Das ist nur vertretbar, weil dieser Seed
// ausschließlich lokal im Entwicklungsmodus mit PGlite läuft (siehe verbindung.ts). Produktion und
// DATABASE_URL bekommen keine Seed-Konten. SEED_PASSWORT überschreibt die festen Passwörter für alle Konten.
import { count, sql } from "drizzle-orm";
import { hashePasswort } from "../auth/passwort";
import type { Datenbank } from "./index";
import { titles, users, type Rolle } from "./schema";

/** Test-Konten mit ihren festen Entwicklungs-Passwörtern (stehen auch im README, Abschnitt 4). */
export const SEED_KONTEN: { email: string; role: Rolle; passwort: string }[] = [
  { email: "mitglied@bibliothek.test", role: "MITGLIED", passwort: "Mitglied-2026" },
  { email: "bibliothekar@bibliothek.test", role: "BIBLIOTHEKAR", passwort: "Bibliothekar-2026" },
  { email: "admin@bibliothek.test", role: "ADMINISTRATOR", passwort: "Admin-2026" },
];

const BEISPIELE = [
  { title: "Der Process", author: "Franz Kafka", category: "Roman", publicationYear: 1925, isbn: "978-3-596-90013-5" },
  { title: "Das Schloss", author: "Franz Kafka", category: "Roman", publicationYear: 1926, isbn: null },
  { title: "Faust. Der Tragödie erster Teil", author: "Johann Wolfgang von Goethe", category: "Drama", publicationYear: 1808, isbn: null },
  { title: "Die Verwandlung", author: "Franz Kafka", category: "Erzählung", publicationYear: 1915, isbn: null },
  { title: "Kurze Geschichte der Zeit", author: "Stephen Hawking", category: "Sachbuch", publicationYear: 1988, isbn: null },
  { title: "Grundkurs Software-Engineering", author: "Helmut Balzert", category: "Lehrbuch", publicationYear: 2009, isbn: null },
];

export async function legeEntwicklungsdatenAn(db: Datenbank): Promise<void> {
  const [{ n: nutzerAnzahl }] = await db.select({ n: count() }).from(users);
  if (Number(nutzerAnzahl) === 0) {
    for (const { email, role, passwort } of SEED_KONTEN) {
      const klartext = process.env.SEED_PASSWORT || passwort;
      await db.insert(users).values({ email, role, passwordHash: await hashePasswort(klartext) });
    }
  }

  const [{ n: titelAnzahl }] = await db.select({ n: count() }).from(titles);
  if (Number(titelAnzahl) === 0) {
    for (const [i, beispiel] of BEISPIELE.entries()) {
      const [titel] = await db.insert(titles).values(beispiel).returning({ id: titles.id });
      for (let j = 0; j <= i % 3; j++) {
        await db.execute(sql`
          INSERT INTO copies (title_id, inventory_number)
          VALUES (${titel.id}, 'INV-' || lpad(nextval('inventory_number_seq')::text, 6, '0'))`);
      }
    }
  }
}
