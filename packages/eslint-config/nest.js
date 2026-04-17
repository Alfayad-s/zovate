import { config as baseConfig } from "./base.js";

/**
 * ESLint configuration for NestJS apps (TypeScript, no React).
 *
 * @type {import("eslint").Linter.Config[]}
 */
export const nestConfig = [
  ...baseConfig,
  {
    ignores: ["dist/**"],
  },
];
