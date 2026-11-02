// F-13 · E07-US01 · E2E: Dashboard, Vorgangsseite und Export nur nach Anmeldung (ohne Testdaten)
import { expect, test } from "@playwright/test";

test.describe("E07-US01 Dashboard", () => {
  for (const pfad of [
    "/verwaltung/dashboard",
    "/verwaltung/ausleihen/00000000-0000-4000-8000-000000000001",
    "/verwaltung/bestand.csv",
  ]) {
    test(`Gast wird von ${pfad} zur Anmeldung geleitet`, async ({ page }) => {
      await page.goto(pfad);
      await expect(page).toHaveURL(/\/anmelden/);
    });
  }
});
