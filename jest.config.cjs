module.exports = {
    // Use jsdom globally to support DOM-dependent builder tests (multi-port, default population).
    testEnvironment: 'jsdom',
    roots: ['<rootDir>/app/static/js/tests'],
    // Only pick up consolidated *.spec.js files to avoid legacy/utility scripts.
    testMatch: ['**/app/static/js/tests/**/*.spec.js'],
    verbose: false,
    collectCoverage: false,
};
