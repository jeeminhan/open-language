import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    // Layer 2 LLM evals live under tests/evals and are run explicitly,
    // never as part of the default gate.
    exclude: ["tests/evals/**", "node_modules/**"],
  },
});
