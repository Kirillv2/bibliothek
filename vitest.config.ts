import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          include: ["src/**/*.test.{ts,tsx}"],
          exclude: ["**/*.int.test.{ts,tsx}"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          include: ["**/*.int.test.{ts,tsx}", "tests/integration/**/*.test.{ts,tsx}"],
          exclude: ["node_modules/**", "e2e/**"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "security",
          include: ["tests/security/**/*.test.{ts,tsx}"],
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      reporter: ["text", "html", "json-summary"],
    },
  },
});
