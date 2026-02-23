// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";

/** @type {import("typescript-eslint").Config} */
export const baseConfig = tseslint.config(js.configs.recommended, ...tseslint.configs.recommended, {
  ignores: ["**/dist/**", "**/node_modules/**", "**/.turbo/**"],
});
