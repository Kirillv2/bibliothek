import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // PGlite lädt seine WebAssembly-Dateien zur Laufzeit selbst und darf nicht gebündelt werden (ADR 002).
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
