module.exports = {
  testMatch: ["**/tests/unit/**/*.ts", "**/tests/integration/**/*.ts"],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleDirectories: ['node_modules', 'src', 'tests/fixtures'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
}
