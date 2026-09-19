import { defineConfig } from "vitest/config";
import tsConfigPaths from "vite-tsconfig-paths";

// Kept separate from vite.config.ts so the test runner does not load the
// TanStack Start / Cloudflare plugins — the unit tests only exercise pure
// server-side helpers.
export default defineConfig({
  plugins: [tsConfigPaths({ projects: ["./tsconfig.json"] })],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    clearMocks: true,
  },
});
