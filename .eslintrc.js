module.exports = {
    env: {
        browser: true,
        es6: true,
        node: true,
        commonjs: true
    },
    extends: ['prettier', 'plugin:prettier/recommended'],
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint', 'json-format'],
    parserOptions: {
        sourceType: 'module',
        extends: './tsconfig.json',
        include: ['src/**/*.ts']
    },
    rules: {
        'no-var': 'error',
        'no-useless-concat': 'error',
        'prefer-template': 'error',
        'lines-between-class-members': ['error', 'always'],
        'prettier/prettier': 'error',
        '@typescript-eslint/naming-convention': [
            'error',
            {
                selector: 'typeLike',
                format: ['StrictPascalCase']
            },
            {
                selector: ['variable', 'parameter'],
                format: [
                    'camelCase',
                    'snake_case',
                    'UPPER_CASE',
                    'StrictPascalCase'
                ]
            },
            {
                selector: ['function', 'method'],
                format: ['camelCase']
            },
            {
                selector: ['classProperty', 'typeProperty'],
                format: ['camelCase', 'snake_case']
            },
            { selector: ['objectLiteralMethod'], format: null }
        ]
    },
    settings: {
        'json/sort-package-json': 'standard'
    }
};
