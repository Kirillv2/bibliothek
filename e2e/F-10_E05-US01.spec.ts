// F-10 · E05-US01 · E2E: Vormerkungen nur nach Anmeldung, Job nur mit Secret (ohne Testdaten)
import { expect, test } from "@playwright/test";

test.describe("E05-US01-FR02 Meine Vormerkungen", () => {
  test("Gast wird von /konto/vormerkungen zur Anmeldung geleitet", async ({ page }) => {
    await page.goto("/konto/vormerkungen");
    await expect(page).toHaveURL(/\/anmelden/);
  });
});

test.describe("E05-US01-FR03 Abholfristen nur mit Job-Secret", () => {
  test("POST ohne Secret → 401", async ({ request }) => {
    expect((await request.post("/api/system/jobs/abholfristen")).status()).toBe(401);
  });
});
