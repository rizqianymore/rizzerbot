import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs}"],
    ignores: ["node_modules/**", ".node_modules-*/**", "dist/**", "build/**"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        grecaptcha: "readonly",
      },
    },
    rules: {
      // Izinkan catch block yang hanya menangkap error tanpa pakai variabel (catch (_) {})
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "none",
        },
      ],
      // Izinkan catch block kosong (digunakan di seluruh kodebase untuk swallow error)
      "no-empty": ["error", { allowEmptyCatch: true }],
      // Jangan error untuk escaping karakter dalam regex regex yang tidak berbahaya
      "no-useless-escape": "off",
    },
  },
]);
