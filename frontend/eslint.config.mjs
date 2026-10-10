import nextCoreVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreVitals,
  ...nextTypescript,
  {
    ignores: [".next/**", ".next-*/**", "out/**", "build/**", "next-env.d.ts"],
  },
  {
    // Existing pages are migrated incrementally; keep these diagnostics visible.
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/refs": "warn",
    },
  },
];

export default eslintConfig;
