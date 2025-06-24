module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: [
    "@typescript-eslint",
    "import"
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
    // кастомные правила уровня проекта можно добавлять здесь
  }
}; 