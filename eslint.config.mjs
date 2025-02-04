import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';

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
		},
		rules: {
			...pluginJs.configs.recommended.rules,
			...tseslint.configs.recommended.rules,

			// TypeScript Best Practices
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
	prettier,
];
