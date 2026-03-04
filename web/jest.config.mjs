// jest.config.mjs
import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: "./",
});

const clientTestConfig = {
  displayName: "client",
  testMatch: ["/**/*.clienttest.[jt]s?(x)"],
  testEnvironment: "jest-environment-jsdom",
  testEnvironmentOptions: { globalsCleanup: "on" },
};

const serverTestConfig = {
  displayName: "sync-server",
  testMatch: ["/**/*.servertest.[jt]s?(x)"],
  testPathIgnorePatterns: ["async", "__e2e__"],
  testEnvironment: "jest-environment-node",
  testEnvironmentOptions: { globalsCleanup: "on" },
  setupFilesAfterEnv: ["<rootDir>/src/__tests__/after-teardown.ts"],
  globalTeardown: "<rootDir>/src/__tests__/teardown.ts",
};

const asyncServerTestConfig = {
  displayName: "async-server",
  testPathIgnorePatterns: ["__e2e__"],
  testMatch: ["/**/async/**/*.servertest.[jt]s?(x)"],
  testEnvironment: "jest-environment-node",
  testEnvironmentOptions: { globalsCleanup: "on" },
  setupFilesAfterEnv: ["<rootDir>/src/__tests__/after-teardown.ts"],
  globalTeardown: "<rootDir>/src/__tests__/teardown.ts",
};

const endToEndServerTestConfig = {
  displayName: "e2e-server",
  testMatch: ["/**/*.servertest.[jt]s?(x)"],
  testPathIgnorePatterns: ["__tests__"],
  testEnvironment: "jest-environment-node",
  testEnvironmentOptions: { globalsCleanup: "on" },
  setupFilesAfterEnv: ["<rootDir>/src/__tests__/after-teardown.ts"],
  globalTeardown: "<rootDir>/src/__tests__/teardown.ts",
};

// To avoid the "Cannot use import statement outside a module" errors while transforming ESM.
// jsonpath-plus is needed because @hanzo/shared barrel exports evals/utilities which imports it
const esModules = ["superjson", "jsonpath-plus", "@hanzo/iam"];

// @hanzo/iam is ESM-only; Jest CJS resolver can't follow its subpath "import" exports.
// Map each subpath to the actual dist file so Jest can find and transform them.
const iamModuleMapper = {
  "^@hanzo/iam/nextauth$": "<rootDir>/node_modules/@hanzo/iam/dist/nextauth.js",
  "^@hanzo/iam/browser$": "<rootDir>/node_modules/@hanzo/iam/dist/browser.js",
  "^@hanzo/iam/react$": "<rootDir>/node_modules/@hanzo/iam/dist/react.js",
  "^@hanzo/iam$": "<rootDir>/node_modules/@hanzo/iam/dist/index.js",
};

// Add any custom config to be passed to Jest
/** @type {import('jest').Config} */
const config = {
  // Ignore .next/standalone to avoid "Haste module naming collision" warning
  modulePathIgnorePatterns: ["<rootDir>/.next/"],
  // Jest 30 performance: recycle workers when memory exceeds limit
  workerIdleMemoryLimit: "512MB",
  // Add more setup options before each test is run
  projects: [
    {
      ...(await createJestConfig(clientTestConfig)()),
      transformIgnorePatterns: [`/web/node_modules/(?!(${esModules.join("|")})/)`],
      moduleNameMapper: iamModuleMapper,
    },
    {
      ...(await createJestConfig(serverTestConfig)()),
      transformIgnorePatterns: [`/web/node_modules/(?!(${esModules.join("|")})/)`],
      moduleNameMapper: iamModuleMapper,
    },
    {
      ...(await createJestConfig(asyncServerTestConfig)()),
      transformIgnorePatterns: [`/web/node_modules/(?!(${esModules.join("|")})/)`],
      moduleNameMapper: iamModuleMapper,
    },
    {
      ...(await createJestConfig(endToEndServerTestConfig)()),
      transformIgnorePatterns: [`/web/node_modules/(?!(${esModules.join("|")})/)`],
      moduleNameMapper: iamModuleMapper,
    },
  ],
};

export default config;
