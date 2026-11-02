import js from "@eslint/js";
import tseslint from "typescript-eslint";

// Zone / dependency rules land in D13; this is the baseline only.
export default tseslint.config(
  {
    ignores: ["dist", "node_modules", "src-tauri", "design", "coverage"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
);
