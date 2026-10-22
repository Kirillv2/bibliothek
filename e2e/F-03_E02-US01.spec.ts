// F-03 · E02-US01 · E2E: Verwaltung ohne Anmeldung (ohne Testdaten)
// E06-US01-FR02 / NFR03: geschützte Seiten leiten Gäste zur Anmeldung.
import { expect, test } from "@playwright/test";

test.describe("E02-US01-FR01 Titelverwaltung nur nach Anmeldung", () => {
  test("Gast wird von /verwaltung/titel/neu zur Anmeldung geleitet", async ({ page }) => {
    await page.goto("/verwaltung/titel/neu");
    await expect(page).toHaveURL(/\/anmelden/);
  });

  test("Gast wird von /verwaltung/titel zur Anmeldung geleitet", async ({ page }) => {
    await page.goto("/verwaltung/titel");
    await expect(page).toHaveURL(/\/anmelden/);
  });
});
