// F-01 · E01-US01 · E2E: Katalogsuche als Gast (ohne Testdaten)
// NFR01: Suchfeld und Filter auf einer Seite. AK-01.6: Hinweis, wenn nichts gefunden wurde.
import { expect, test } from "@playwright/test";

test.describe("E01-US01-FR01 Katalogsuche als Gast", () => {
  test("AK-01.6 die Katalogseite ist ohne Anmeldung erreichbar und meldet, wenn nichts gefunden wurde", async ({ page }) => {
    const antwort = await page.goto("/");
    expect(antwort?.status()).toBe(200);

    const suchfeld = page.getByRole("searchbox").first();
    await expect(suchfeld).toBeVisible();
    await suchfeld.fill("Quxzyw nichts passt 7319");
    await suchfeld.press("Enter");

    await expect(page.getByText(/nichts gefunden|keine treffer/i)).toBeVisible();
    await expect(page).not.toHaveURL(/anmelden/);
  });
});

test.describe("E01-US01-FR02 Filter auf derselben Seite (NFR01)", () => {
  test("AK-02.1 bis AK-02.5 Filter für Kategorie, Verfügbarkeit, Erscheinungsjahr und Sortierung sind sichtbar", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByLabel(/kategorie/i).first()).toBeVisible();
    await expect(page.getByLabel(/verfügbar/i).first()).toBeVisible();
    await expect(page.getByLabel(/jahr/i).first()).toBeVisible();
    await expect(page.getByLabel(/sortier/i).first()).toBeVisible();
  });
});
