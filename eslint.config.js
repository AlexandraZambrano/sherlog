// ESLint configuration: the rules that every file must follow.
import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  // Folders and files that are not checked (generated code and this file itself).
  { ignores: ["node_modules", "dist", "coverage", "eslint.config.js"] },
  // General JavaScript mistakes: unused variables, unreachable code, and so on.
  eslint.configs.recommended,
  // TypeScript rules in their strictest form, using type information.
  tseslint.configs.strictTypeChecked,
  // Tells the rules where to find tsconfig.json so they can read the types.
  { languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } } },
);