import { defineConfig } from "tsdown"

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/layout.ts",
    "src/auto.ts",
    "src/attributes.ts",
    "src/hyphenation.ts",
  ],
  format: "esm",
  platform: "browser",
  target: "es2022",
  clean: true,
  dts: true,
  deps: {
    neverBundle: ["@chenglou/pretext", "hyphen"],
    onlyImport: ["@chenglou/pretext", "hyphen"],
  },
  copy: [
    { from: "src/styles.css", to: "dist", flatten: true },
    { from: "src/styles.css.d.ts", to: "dist", flatten: true },
  ],
  publint: {
    level: "error",
  },
  attw: {
    profile: "esm-only",
    level: "error",
  },
})
