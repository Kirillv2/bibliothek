// F-12 · E06-US02 · E2E: Verwaltung für Administratoren nur nach Anmeldung (ohne Testdaten)
import { expect, test } from "@playwright/test";

test.describe("E06-US02 Administration", () => {
  for (const pfad of ["/admin/nutzer", "/admin/parameter"]) {
    test(`Gast wird von ${pfad} zur Anmeldung geleitet`, async ({ page }) => {
      await page.goto(pfad);
      await expect(page).toHaveURL(/\/anmelden/);
    });
  }
});
