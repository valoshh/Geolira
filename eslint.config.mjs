import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  { rules: { "react-hooks/set-state-in-effect": "off" } },
  globalIgnores([
    ".next/**",
    ".next-build/**",
    "out/**",
    ".data-cache/**",
    "public/geo/**",
    "public/data/**",
    "public/maplibre/**",
    "next-env.d.ts",
  ]),
]);
