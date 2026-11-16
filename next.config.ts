import type { NextConfig } from "next";

// NFR03, Issue #47: übliche Schutz-Header für jede Antwort.
// Annahme: Die CSP regelt nur Einbetten, Formular-Ziele, <base> und Plugins. Skripte regelt sie nicht,
// weil Next.js eigene Inline-Skripte nutzt; eine strenge script-src bräuchte Nonces auf jeder Seite.
const SICHERHEITS_HEADER = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // PGlite lädt seine WebAssembly-Dateien zur Laufzeit selbst und darf nicht gebündelt werden (ADR 002).
  serverExternalPackages: ["@electric-sql/pglite"],
  // NFR03: verrät nicht, mit welchem Framework die App gebaut ist
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SICHERHEITS_HEADER }];
  },
};

export default nextConfig;
