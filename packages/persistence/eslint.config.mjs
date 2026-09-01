import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    files: ["src/**/*.{js,mjs}", "test/**/*.ts", "*.ts"],
    rules: {
      "no-console": ["error", { allow: ["info", "error"] }],
    },
  },
]);
