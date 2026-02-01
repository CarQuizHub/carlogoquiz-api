import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';
import importPlugin from 'eslint-plugin-import';
import unusedImports from 'eslint-plugin-unused-imports';

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
	{
		files: ['**/*.{js,mjs,cjs,ts,tsx}'],
		languageOptions: {
			globals: { ...globals.browser, ...globals.node },
			parser: tseslint.parser,
			parserOptions: {
				project: './tsconfig.json',
				sourceType: 'module',
			},
		},
		plugins: {
			'@typescript-eslint': tseslint.plugin,
			prettier: prettierPlugin,
			import: importPlugin,
			'unused-imports': unusedImports,
		},
		rules: {
			...pluginJs.configs.recommended.rules,
			...tseslint.configs.recommended.rules,

			// TypeScript Best Practices
			'no-undef': 'off',
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
			'@typescript-eslint/explicit-function-return-type': 'error',
			'@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
			'@typescript-eslint/no-inferrable-types': 'warn',
			'@typescript-eslint/no-non-null-assertion': 'error',

			// Code Consistency & Formatting
			'prettier/prettier': 'error',
			'import/order': ['error', { groups: ['builtin', 'external', 'internal'], 'newlines-between': 'always' }],
			'unused-imports/no-unused-imports': 'error',
		},
		settings: {
			'import/resolver': {
				typescript: {
					alwaysTryTypes: true,
				},
			},
		},
	},
	{
		files: ['**/*.test.ts', '**/*.spec.ts', '**/*.test.tsx', '**/*.spec.tsx'],
		rules: {
			'@typescript-eslint/explicit-function-return-type': 'off',
			'@typescript-eslint/no-explicit-any': 'off',
		},
	},
	prettier,
];
