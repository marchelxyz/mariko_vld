module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: [
    "@typescript-eslint",
    "import",
    "react-hooks"
  ],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "@feature-sliced",
    "plugin:import/typescript"
  ],
  env: {
    browser: true,
    node: true,
    es2022: true
  },
  settings: {
    "feature-sliced": {
      alias: {
        app: "@app",
        pages: "@pages",
        widgets: "@widgets",
        features: "@features",
        entities: "@entities",
        shared: "@shared"
      }
    },
    "import/resolver": {
      typescript: {}
    }
  },
  rules: {
    "import/order": "off",
    "import/no-internal-modules": "off",
    "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/no-explicit-any": "off",
    "react-hooks/exhaustive-deps": "off",
    "boundaries/element-types": "off",
  }
}; 
