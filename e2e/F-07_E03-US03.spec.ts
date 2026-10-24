// F-07 · E03-US03 · E2E: Rückgabe nur nach Anmeldung (ohne Testdaten)
import { expect, test } from "@playwright/test";

test.describe("E03-US03-FR01 Rückgabe erfassen", () => {
  test("Gast wird von /verwaltung/rueckgabe zur Anmeldung geleitet", async ({ page }) => {
    await page.goto("/verwaltung/rueckgabe");
    await expect(page).toHaveURL(/\/anmelden/);
  });
});
