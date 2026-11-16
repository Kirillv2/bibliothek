// NFR03 · Sicherheits-Header für jede Antwort (Issue #47)
// Geprüft wird die Next.js-Konfiguration; die echte Antwort prüft zusätzlich e2e/NFR03_sicherheits-header.spec.ts.
import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

async function headerFuerAllePfade(): Promise<Map<string, string>> {
  const regeln = (await nextConfig.headers?.()) ?? [];
  const regel = regeln.find((r) => r.source === "/:path*");
  return new Map((regel?.headers ?? []).map((h) => [h.key.toLowerCase(), h.value]));
}

describe("NFR03 Sicherheits-Header", () => {
  it("die App verrät das Framework nicht (kein X-Powered-By)", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });

  it("Einbetten in fremde Seiten ist verboten (Clickjacking)", async () => {
    const header = await headerFuerAllePfade();
    expect(header.get("x-frame-options")).toBe("DENY");
    expect(header.get("content-security-policy")).toContain("frame-ancestors 'none'");
  });

  it("Formulare senden nur an die eigene Herkunft, kein fremdes <base>, keine Plugins", async () => {
    const csp = (await headerFuerAllePfade()).get("content-security-policy") ?? "";
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("object-src 'none'");
  });

  it("Inhaltstyp wird nicht erraten, Referrer nur gekürzt nach außen", async () => {
    const header = await headerFuerAllePfade();
    expect(header.get("x-content-type-options")).toBe("nosniff");
    expect(header.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
  });
});
