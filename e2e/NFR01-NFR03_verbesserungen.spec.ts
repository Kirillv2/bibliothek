// NFR01, NFR03, NFR05 · E2E: Verbesserungen aus Issue #47 (ohne vorbereitete Testdaten)
// Deutsche 404-Seite, Sicherheits-Header, Anmeldesperre nach zu vielen Fehlversuchen, Handy-Ansicht ohne seitliches Scrollen.
import { expect, test } from "@playwright/test";

test.describe("NFR01 Deutsche Fehlerseite", () => {
  test("unbekannte Adresse: HTTP 404, deutsche Meldung und Weg zurück zum Katalog", async ({ page }) => {
    const antwort = await page.goto("/diese-seite-gibt-es-nicht");
    expect(antwort?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Seite nicht gefunden" })).toBeVisible();
    await expect(page.getByText("could not be found")).toHaveCount(0);
    await page.getByRole("link", { name: "Zum Katalog" }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe("NFR03 Sicherheits-Header", () => {
  test("jede Seite verbietet das Einbetten und verrät das Framework nicht", async ({ page }) => {
    const antwort = await page.goto("/");
    const header = antwort!.headers();
    expect(header["x-frame-options"]).toBe("DENY");
    expect(header["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(header["x-content-type-options"]).toBe("nosniff");
    expect(header["x-powered-by"]).toBeUndefined();
  });
});

test.describe("E06-US01-FR01 Anmeldeschutz gegen Passwort-Raten (NFR03)", () => {
  test("nach wiederholten Fehlversuchen meldet die Anmeldeseite eine Sperre", async ({ page }) => {
    const email = `e2e-sperre-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.org`;
    // Grenze steht im Code (anmeldeschutz.ts); hier wird so lange probiert, bis die Sperre greift
    for (let versuch = 0; versuch < 20; versuch++) {
      await page.goto("/anmelden");
      await page.getByLabel("E-Mail").fill(email);
      await page.getByLabel("Passwort").fill("falsches-Passwort");
      await page.getByRole("button", { name: "Anmelden" }).click();
      await page.waitForURL(/fehler=/);
      if (page.url().includes("fehler=gesperrt")) break;
    }
    await expect(page.locator("p.meldung[role=alert]")).toContainText("Zu viele fehlgeschlagene Anmeldeversuche");
  });
});

test.describe("NFR01, NFR05 Handy-Ansicht", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("Katalog und Menü passen auf einen schmalen Bildschirm, nichts läuft seitlich heraus", async ({ page }) => {
    await page.goto("/");
    const breite = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(breite).toBeLessThanOrEqual(390);
    const ausserhalb = await page.evaluate(() =>
      [...document.querySelectorAll("header nav a")].filter((a) => a.getBoundingClientRect().right > window.innerWidth).length,
    );
    expect(ausserhalb).toBe(0);
  });
});
