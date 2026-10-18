import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/.wrangler/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/drizzle/**',
      '**/next-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    files: ['**/sw.js', '**/public/**/*.js'],
    languageOptions: {
      globals: {
        self: 'readonly',
        fetch: 'readonly',
        caches: 'readonly',
        clients: 'readonly',
        URL: 'readonly',
        Response: 'readonly',
      },
    },
  },
  {
    files: ['apps/extension/src/**/*.js'],
    languageOptions: {
      globals: {
        chrome: 'readonly',
        window: 'readonly',
        document: 'readonly',
        location: 'readonly',
        navigator: 'readonly',
        Clipboard: 'readonly',
        Navigator: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        setTimeout: 'readonly',
      },
    },
  },
);
