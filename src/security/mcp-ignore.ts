import { App, TFile } from "obsidian";

/**
 * Parses and applies .mcpignore rules (gitignore-style patterns)
 */
export class McpIgnoreManager {
	private patterns: string[] = [];
	private enabled = false;
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * Load patterns from .mcpignore file in vault root
	 */
	async load(): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(".mcpignore");
		if (!file || !(file instanceof TFile)) {
			this.patterns = [];
			this.enabled = false;
			return;
		}

		try {
			const content = await this.app.vault.read(file);
			this.patterns = this.parsePatterns(content);
			this.enabled = this.patterns.length > 0;
		} catch {
			this.patterns = [];
			this.enabled = false;
		}
	}

	/**
	 * Parse .mcpignore content into patterns
	 */
	private parsePatterns(content: string): string[] {
		return content
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line && !line.startsWith("#"));
	}

	/**
	 * Check if a path is excluded by .mcpignore
	 */
	isExcluded(path: string): boolean {
		if (!this.enabled) return false;

		// Always protect .mcpignore itself
		if (path === ".mcpignore") return true;

		for (const pattern of this.patterns) {
			if (this.matchesPattern(path, pattern)) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Match path against a gitignore-style pattern
	 */
	private matchesPattern(path: string, pattern: string): boolean {
		// Handle directory patterns (ending with /)
		const isDirectoryPattern = pattern.endsWith("/");
		const cleanPattern = isDirectoryPattern ? pattern.slice(0, -1) : pattern;

		// Convert gitignore pattern to regex
		let regexStr = cleanPattern
			.replace(/[.+^${}()|[\]\\]/g, "\\$&") // Escape special chars
			.replace(/\*\*/g, "{{GLOBSTAR}}") // Temp placeholder for **
			.replace(/\*/g, "[^/]*") // * matches anything except /
			.replace(/\?/g, "[^/]") // ? matches single char except /
			.replace(/{{GLOBSTAR}}/g, ".*"); // ** matches anything including /

		// If pattern doesn't start with /, it can match anywhere
		if (!pattern.startsWith("/")) {
			regexStr = `(^|/)${regexStr}`;
		} else {
			regexStr = `^${regexStr.slice(2)}`; // Remove leading \/ from escaped /
		}

		// If directory pattern, match the directory and anything inside
		if (isDirectoryPattern) {
			regexStr = `${regexStr}(/|$)`;
		} else {
			regexStr = `${regexStr}$`;
		}

		try {
			const regex = new RegExp(regexStr);
			return regex.test(path);
		} catch {
			return false;
		}
	}

	/**
	 * Check if .mcpignore is enabled
	 */
	isEnabled(): boolean {
		return this.enabled;
	}

	/**
	 * Get current patterns (for debugging)
	 */
	getPatterns(): string[] {
		return [...this.patterns];
	}
}
