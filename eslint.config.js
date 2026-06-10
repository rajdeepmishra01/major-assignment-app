import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: [
      "apps/frontend/dist/**",
      "node_modules/**",
      "**/node_modules/**"
    ]
  },
  js.configs.recommended,
  {
    files: ["apps/**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      },
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "warn"
    }
  }
];
