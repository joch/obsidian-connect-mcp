import { App, TFile } from "obsidian";

interface PromptDefinition {
	name: string;
	description?: string;
}

interface PromptContent {
	description?: string;
	content: string;
}

/**
 * Create prompts handlers for the MCP server
 */
export function createPromptsHandlers(
	app: App,
	promptsFolder: string
): {
	listPrompts: () => PromptDefinition[];
	getPrompt: (name: string) => Promise<PromptContent>;
} {
	return {
		/**
		 * List all prompts from the configured folder
		 */
		listPrompts(): PromptDefinition[] {
			const folder = app.vault.getAbstractFileByPath(promptsFolder);
			if (!folder) {
				return [];
			}

			const files = app.vault.getMarkdownFiles();
			const promptFiles = files.filter(
				(f) => f.path.startsWith(promptsFolder + "/") && f.path.endsWith(".md")
			);

			const prompts: PromptDefinition[] = [];

			for (const file of promptFiles) {
				const cache = app.metadataCache.getFileCache(file);
				prompts.push({
					name: file.basename,
					description: cache?.frontmatter?.description as string | undefined,
				});
			}

			return prompts.sort((a, b) => a.name.localeCompare(b.name));
		},

		/**
		 * Get a specific prompt by name
		 */
		async getPrompt(name: string): Promise<PromptContent> {
			const path = `${promptsFolder}/${name}.md`;
			const file = app.vault.getAbstractFileByPath(path);

			if (!file || !(file instanceof TFile)) {
				throw new Error(`Prompt not found: ${name}`);
			}

			const content = await app.vault.read(file);
			const cache = app.metadataCache.getFileCache(file);

			// Strip frontmatter from content if present
			let promptContent = content;
			if (content.startsWith("---")) {
				const endIndex = content.indexOf("---", 3);
				if (endIndex !== -1) {
					promptContent = content.slice(endIndex + 3).trim();
				}
			}

			return {
				description: cache?.frontmatter?.description as string | undefined,
				content: promptContent,
			};
		},
	};
}
