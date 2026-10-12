import js from "@eslint/js";

export default [
  {
    ignores: [
      "**/node_modules/**",
      ".node_modules*/**",
      "**/.node_modules*/**",
      "database/**",
      "temp/**",
      "tmp/**",
      "assets/**",
      "bin/**",
      "logs/**",
      "dist/**",
      "build/**",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: {
        // Node.js runtime
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        AbortController: "readonly",
        AbortSignal: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        setImmediate: "readonly",
        queueMicrotask: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        fetch: "readonly",
        TextEncoder: "readonly",
        TextDecoder: "readonly",
        structuredClone: "readonly",
        globalThis: "readonly",
        btoa: "readonly",
        atob: "readonly",
        performance: "readonly",
        FileReader: "readonly",
        // Global browser — dipakai di dalam callback page.evaluate() Puppeteer.
        window: "readonly",
        navigator: "readonly",
        document: "readonly",
        location: "readonly",
        grecaptcha: "readonly",
      },
    },
    rules: {
      // Aturan inti: jaga kualitas tanpa terlalu galak agar tidak
      // membanjiri codebase lama dengan warning.
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "no-console": "off",
      "no-empty": ["warn", { allowEmptyCatch: true }],
      "prefer-const": "warn",
      "no-var": "error",
      eqeqeq: ["warn", "smart"],
      // Aturan opini baru ESLint v10 — nonaktif agar tidak memaksa
      // penulisan { cause } di seluruh blok catch legacy.
      "preserve-caught-error": "off",
      // Aturan opini baru ESLint v10 — menandai pola defensif idiomatik
      // seperti `let x = null; try { x = ... } catch { x = null; }`
      // yang menyebar di seluruh codebase dan bukan bug.
      "no-useless-assignment": "off",
      "no-misleading-character-class": "off",
    },
  },
];
