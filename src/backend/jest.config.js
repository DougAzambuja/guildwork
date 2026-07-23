/** @type {import('jest').Config} */
module.exports = {
    testEnvironment:         'node',
    globalSetup:             '<rootDir>/tests/globalSetup.js',
    globalTeardown:          '<rootDir>/tests/globalTeardown.js',
    setupFilesAfterEnv:       ['<rootDir>/tests/testSetup.js'],
    testMatch:               ['<rootDir>/tests/**/*.test.js'],
    collectCoverageFrom: [
        'controllers/**/*.js',
        'services/**/*.js',
        'middleware/**/*.js',
        '!**/node_modules/**',
    ],
    coverageDirectory:  'coverage',
    coverageReporters:  ['text', 'lcov', 'html'],
    maxWorkers:         1,
    testTimeout:        30000,
    verbose:            true,
    forceExit:          true,
    detectOpenHandles:  true,
};
