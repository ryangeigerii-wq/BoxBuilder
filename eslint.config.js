/**
 * ESLint flat config for BoxBuilder (ESLint v9+)
 * Migrated from legacy .eslintrc.cjs.
 */
import prettierPlugin from "eslint-plugin-prettier";

export default [
    {
        ignores: [
            "**/__pycache__/**",
            "**/*.py",
            "venv/**",
            ".venv/**",
            "app/static/js/vendor/**",
            "cache/**",
            "node_modules/**",
            "dist/**"
        ]
    },
    {
        files: ["app/static/js/**/*.{js,mjs,cjs}", "eslint.config.js"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            globals: {
                THREE: "readonly",
                performance: "readonly",
                requestAnimationFrame: "readonly",
                cancelAnimationFrame: "readonly"
            }
        },
        plugins: {
            prettier: prettierPlugin
        },
        rules: {
            "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
            "no-console": ["warn", { allow: ["error", "warn"] }],
            // Temporarily downgraded to warn to allow incremental formatting adoption without blocking commits.
            "prettier/prettier": ["warn"]
        }
    }
];
