// F-11 · E06-US01 · E2E: Registrierung, danach angemeldet; Weg von der Anmeldung zur Registrierung
// Legt ein neues Konto mit zufälliger E-Mail an (keine vorbereiteten Testdaten nötig).
import { expect, test } from "@playwright/test";

test.describe("E06-US01-FR01 Registrierung", () => {
  test("AK-01.7 Gast registriert sich und ist danach angemeldet (Menü „Meine Ausleihen“, „Abmelden“)", async ({ page }) => {
    const email = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.org`;
    await page.goto("/registrieren");
    await page.getByLabel("E-Mail").fill(email);
    await page.getByLabel("Passwort", { exact: true }).fill("sicheres-Passwort-1");
    await page.getByRole("button", { name: "Registrieren" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("link", { name: "Meine Ausleihen" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Abmelden" })).toBeVisible();
  });

  test("AK-01.5 zu kurzes Passwort: Meldung am Feld, keine Anmeldung", async ({ page }) => {
    await page.goto("/registrieren");
    await page.getByLabel("E-Mail").fill(`e2e-kurz-${Date.now()}@example.org`);
    // `minLength` im Browser umgehen, damit der Server prüft
    await page.getByLabel("Passwort", { exact: true }).evaluate((el) => el.removeAttribute("minlength"));
    await page.getByLabel("Passwort", { exact: true }).fill("kurz");
    await page.getByRole("button", { name: "Registrieren" }).click();
    await expect(page.locator("#fehler-passwort")).toBeVisible();
    await expect(page.getByRole("button", { name: "Abmelden" })).toHaveCount(0);
  });
});

test.describe("E06-US01-FR02 Geschützte Seiten", () => {
  test("AK-02.5 von der Anmeldeseite gibt es einen Weg zur Registrierung, das Ziel bleibt erhalten", async ({ page }) => {
    await page.goto("/konto/vormerkungen");
    await expect(page).toHaveURL(/\/anmelden/);
    await page.getByRole("link", { name: /registrieren/i }).click();
    await expect(page).toHaveURL(/\/registrieren\?weiter=%2Fkonto%2Fvormerkungen/);
  });
});
