// F-06 · E03-US02 · E2E: „Meine Ausleihen“ nur nach Anmeldung (ohne Testdaten)
import { expect, test } from "@playwright/test";

test.describe("E03-US02-FR01 Meine Ausleihen", () => {
  test("AK-01.6 (E06-US01-FR02) Gast wird von /konto/ausleihen zur Anmeldung geleitet", async ({ page }) => {
    await page.goto("/konto/ausleihen");
    await expect(page).toHaveURL(/\/anmelden/);
  });
});
