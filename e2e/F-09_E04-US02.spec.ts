// F-09 · E04-US02 · E2E: Mahnungsverwaltung nur nach Anmeldung (ohne Testdaten)
import { expect, test } from "@playwright/test";

test.describe("E04-US02-FR03 Mahnungen verwalten", () => {
  test("Gast wird von /verwaltung/mahnungen zur Anmeldung geleitet", async ({ page }) => {
    await page.goto("/verwaltung/mahnungen");
    await expect(page).toHaveURL(/\/anmelden/);
  });
});
