/** @type {import('jest').Config} */
const tsconfig = require("./tsconfig.json");

const config = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  testMatch: ["<rootDir>/__tests__/**/*.test.(ts|tsx)"],
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        tsconfig: {
          ...tsconfig.compilerOptions,
          // Next.js uses "preserve" (Babel handles JSX), but Jest runs
          // directly on ts-jest output — so we transform JSX here only.
          jsx: "react-jsx",
        },
        diagnostics: { ignoreCodes: [6143] },
      },
    ],
  },
};

module.exports = config;