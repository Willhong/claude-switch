export default [
    {
        languageOptions: {
            ecmaVersion: 2020,
            sourceType: "module",
            globals: {
                console: "readonly",
                process: "readonly",
                Buffer: "readonly",
                __dirname: "readonly",
                __filename: "readonly",
                setTimeout: "readonly",
                clearTimeout: "readonly",
                setInterval: "readonly",
                clearInterval: "readonly"
            }
        },
        rules: {
            "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
            "no-empty": ["error", { "allowEmptyCatch": true }],
            "no-constant-condition": ["error", { "checkLoops": false }],
            "prefer-const": "warn",
            "eqeqeq": ["warn", "smart"]
        }
    }
];
