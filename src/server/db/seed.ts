// Seed für die lokale Entwicklung (ADR 003, Punkt 5): je ein Konto pro Rolle und ein kleiner Beispielbestand.
// Passwörter stehen nicht im Repo: sie kommen aus SEED_PASSWORT oder werden zufällig erzeugt und
// in `.data/seed-zugaenge.txt` abgelegt (der Ordner ist von Git ausgeschlossen).
import path from "node:path";
import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { count, sql } from "drizzle-orm";
import { hashePasswort } from "../auth/passwort";
import type { Datenbank } from "./index";
import { titles, users, type Rolle } from "./schema";

const KONTEN: { email: string; role: Rolle }[] = [
  { email: "mitglied@bibliothek.test", role: "MITGLIED" },
  { email: "bibliothekar@bibliothek.test", role: "BIBLIOTHEKAR" },
  { email: "admin@bibliothek.test", role: "ADMINISTRATOR" },
];

const BEISPIELE = [
  { title: "Der Process", author: "Franz Kafka", category: "Roman", publicationYear: 1925, isbn: "978-3-596-90013-5" },
  { title: "Das Schloss", author: "Franz Kafka", category: "Roman", publicationYear: 1926, isbn: null },
  { title: "Faust. Der Tragödie erster Teil", author: "Johann Wolfgang von Goethe", category: "Drama", publicationYear: 1808, isbn: null },
  { title: "Die Verwandlung", author: "Franz Kafka", category: "Erzählung", publicationYear: 1915, isbn: null },
  { title: "Kurze Geschichte der Zeit", author: "Stephen Hawking", category: "Sachbuch", publicationYear: 1988, isbn: null },
  { title: "Grundkurs Software-Engineering", author: "Helmut Balzert", category: "Lehrbuch", publicationYear: 2009, isbn: null },
];

export async function legeEntwicklungsdatenAn(db: Datenbank, ordner: string): Promise<void> {
  const [{ n: nutzerAnzahl }] = await db.select({ n: count() }).from(users);
  if (Number(nutzerAnzahl) === 0) {
    const passwort = process.env.SEED_PASSWORT || randomBytes(9).toString("base64url");
    for (const konto of KONTEN) {
      await db.insert(users).values({ ...konto, passwordHash: await hashePasswort(passwort) });
    }
    if (!process.env.SEED_PASSWORT) {
      const zeilen = KONTEN.map((k) => `${k.role}: ${k.email} / ${passwort}`);
      await writeFile(path.join(ordner, "seed-zugaenge.txt"), `${zeilen.join("\n")}\n`, { mode: 0o600 });
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
