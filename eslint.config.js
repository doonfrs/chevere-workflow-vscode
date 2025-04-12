module.exports = [{
    languageOptions: {
        ecmaVersion: 2020,
        sourceType: 'commonjs'
    },
    linterOptions: {
        reportUnusedDisableDirectives: true,
    },
    rules: {
        'semi': ['error', 'always'],
        'quotes': ['error', 'single']
    }
}];