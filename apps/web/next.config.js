import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Monorepo root `.env` (apps/web only loads `.env` in its own folder by default). */
const monorepoEnv = path.resolve(__dirname, "../../.env");
if (existsSync(monorepoEnv)) {
  dotenv.config({ path: monorepoEnv });
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@repo/ui", "@repo/shared-types", "@repo/database"],
};

export default nextConfig;
