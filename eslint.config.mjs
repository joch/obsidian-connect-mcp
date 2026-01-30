import tseslint from 'typescript-eslint';
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { globalIgnores } from "eslint/config";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default tseslint.config(
	...tseslint.configs.recommended,
	{
		languageOptions: {
			globals: {
				...globals.browser,
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: [
						'eslint.config.mjs',
						'manifest.json'
					]
				},
				tsconfigRootDir: __dirname,
				extraFileExtensions: ['.json']
			},
		},
	},
	{
		files: ["**/*.ts"],
		plugins: {
			obsidianmd
		},
		rules: {
			...obsidianmd.configs.recommended,
			// Allow MCP, Dataview, Templater, MetaBind acronyms/names in UI text
			"obsidianmd/ui/sentence-case": ["error", {
				ignoreRegex: ["MCP", "Dataview", "Templater", "MetaBind", "Claude Code"]
			}]
		}
	},
	globalIgnores([
		"node_modules",
		"dist",
		"esbuild.config.mjs",
		"eslint.config.mjs",
		"version-bump.mjs",
		"versions.json",
		"main.js",
		"mcp-server",
	]),
);
