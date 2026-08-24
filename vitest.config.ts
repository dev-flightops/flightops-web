import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next", "tests/e2e/**", "storybook-static"],
    // Vitest's 5s default is wall-clock, not CPU time. That is tight
    // for component tests on a developer box that is also running the
    // dev stack — 16 containers plus `next dev` alongside 7 vitest
    // workers on 8 cores, which is the normal working setup here.
    //
    // This is NOT covering for a flaky suite. CI has never failed on
    // this; it runs on a quiet GitHub-hosted runner. The one test that
    // was genuinely slow — mel-deferral-dialog, 24s on its own — was
    // fixed rather than accommodated, and 10s still fails a test that
    // actually hangs.
    testTimeout: 10_000,
  },
});
