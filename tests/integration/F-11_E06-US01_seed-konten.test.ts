// F-11 · E06-US01 · Test-Konten des Entwicklungs-Seeds (ADR 003, Punkt 5)
// Annahme (Spec schweigt): Die Seed-Konten haben feste, bekannte Passwörter für die lokale Entwicklung,
// die im README stehen. SEED_PASSWORT überschreibt sie. Der Seed läuft nur lokal im Entwicklungsmodus.
import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { meldeAn } from "@/server/auth/anmeldung";
import { legeEntwicklungsdatenAn, SEED_KONTEN } from "@/server/db/seed";
import { nutzeTestDatenbank } from "../helpers/testdb";

const t = nutzeTestDatenbank();
const JETZT = new Date("2026-11-10T10:00:00Z");

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("E06-US01-FR01 Anmeldung mit den Test-Konten des Entwicklungs-Seeds", () => {
  it("jedes Test-Konto meldet sich mit seinem festen Passwort und seiner Rolle an", async () => {
    vi.stubEnv("SEED_PASSWORT", "");
    await legeEntwicklungsdatenAn(t.db);
    for (const konto of SEED_KONTEN) {
      expect(await meldeAn(t.db, konto.email, konto.passwort, JETZT)).toMatchObject({
        ok: true,
        sitzung: { role: konto.role },
      });
    }
  });

  it("ein zweiter Start ändert die Passwörter nicht", async () => {
    vi.stubEnv("SEED_PASSWORT", "");
    await legeEntwicklungsdatenAn(t.db);
    await legeEntwicklungsdatenAn(t.db);
    const [konto] = SEED_KONTEN;
    expect((await meldeAn(t.db, konto.email, konto.passwort, JETZT)).ok).toBe(true);
  });

  it("SEED_PASSWORT ersetzt die festen Passwörter für alle Test-Konten", async () => {
    vi.stubEnv("SEED_PASSWORT", "eigenes-Test-Passwort");
    await legeEntwicklungsdatenAn(t.db);
    for (const konto of SEED_KONTEN) {
      expect((await meldeAn(t.db, konto.email, "eigenes-Test-Passwort", JETZT)).ok).toBe(true);
      expect((await meldeAn(t.db, konto.email, konto.passwort, JETZT)).ok).toBe(false);
    }
  });

  it("README nennt jedes Test-Konto mit seinem Passwort", async () => {
    const readme = await readFile(new URL("../../README.md", import.meta.url), "utf8");
    for (const konto of SEED_KONTEN) {
      expect(readme).toContain(konto.email);
      expect(readme).toContain(konto.passwort);
    }
  });
});
