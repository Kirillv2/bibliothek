// F-02 · E01-US02 · E2E: „nicht gefunden“-Seite (ohne Testdaten)
import { expect, test } from "@playwright/test";

test.describe("E01-US02-FR01 Detailseite eines unbekannten Titels", () => {
  test("AK-01.8 unbekannte Titel-ID liefert HTTP 404", async ({ page }) => {
    const antwort = await page.goto("/titel/00000000-0000-4000-8000-000000000000");
    expect(antwort?.status()).toBe(404);
  });

  test("AK-01.8 eine ID in falschem Format liefert ebenfalls HTTP 404", async ({ page }) => {
    const antwort = await page.goto("/titel/kein-gueltiger-wert");
    expect(antwort?.status()).toBe(404);
  });
});
