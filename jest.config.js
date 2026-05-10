module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/lib'],
  passWithNoTests: true,
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: ['lib/**/*.ts', '!lib/**/*.d.ts'],
};
