import { defineConfig, mergeConfig } from "vitest/config";

/** @param {import("vitest/config").UserConfig} overrides */
export function createVitestConfig(overrides = {}) {
  return mergeConfig(
    defineConfig({
      test: {
        globals: true,
        coverage: {
          reporter: ["text", "lcov"],
        },
      },
    }),
    overrides
  );
}
