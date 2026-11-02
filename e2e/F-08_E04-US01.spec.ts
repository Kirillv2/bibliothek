// F-08 · E04-US01 · E2E: Job-Endpunkt und Benachrichtigungen ohne Anmeldung bzw. ohne Secret (ohne Testdaten)
import { expect, test } from "@playwright/test";

test.describe("E04-US01-FR01 Fristprüfung nur mit Job-Secret", () => {
  test("POST ohne Secret → 401", async ({ request }) => {
    const antwort = await request.post("/api/system/jobs/fristpruefung");
    expect(antwort.status()).toBe(401);
  });

  test("GET ist nicht erlaubt", async ({ request }) => {
    const antwort = await request.get("/api/system/jobs/fristpruefung");
    expect([401, 405]).toContain(antwort.status());
  });
});

test.describe("E04-US01-FR02 Benachrichtigungen", () => {
  test("Gast wird von /konto/benachrichtigungen zur Anmeldung geleitet", async ({ page }) => {
    await page.goto("/konto/benachrichtigungen");
    await expect(page).toHaveURL(/\/anmelden/);
  });
});
