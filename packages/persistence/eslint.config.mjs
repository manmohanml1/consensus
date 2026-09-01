import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig([
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{js,mjs,ts}", "test/**/*.ts", "*.ts"],
    rules: {
      "no-console": ["error", { allow: ["info", "error"] }],
    },
  },
]);
