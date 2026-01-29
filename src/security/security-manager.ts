import { App, normalizePath } from "obsidian";
import { McpIgnoreManager } from "./mcp-ignore";

/**
 * Manages security for vault operations
 */
export class SecurityManager {
	private app: App;
	private ignoreManager: McpIgnoreManager;
	private _readOnlyMode = false;

	constructor(app: App) {
		this.app = app;
		this.ignoreManager = new McpIgnoreManager(app);
	}

	/**
	 * Initialize security manager (load .mcpignore, etc.)
	 */
	async initialize(): Promise<void> {
		await this.ignoreManager.load();
	}

	/**
	 * Set read-only mode
	 */
	setReadOnlyMode(enabled: boolean): void {
		this._readOnlyMode = enabled;
	}

	/**
	 * Check if read-only mode is enabled
	 */
	get readOnlyMode(): boolean {
		return this._readOnlyMode;
	}

	/**
	 * Validate a read operation
	 * @throws Error if operation is blocked
	 */
	validateRead(path: string): string {
		const normalized = normalizePath(path);

		if (this.ignoreManager.isExcluded(normalized)) {
			throw new Error(`Access denied: path is blocked by .mcpignore`);
		}

		return normalized;
	}

	/**
	 * Validate a write operation (create, update, delete)
	 * @throws Error if operation is blocked
	 */
	validateWrite(path: string): string {
		if (this._readOnlyMode) {
			throw new Error(`Write operation blocked: read-only mode is enabled`);
		}

		const normalized = normalizePath(path);

		if (this.ignoreManager.isExcluded(normalized)) {
			throw new Error(`Access denied: path is blocked by .mcpignore`);
		}

		// Prevent writing to .mcpignore
		if (normalized === ".mcpignore") {
			throw new Error(`Access denied: cannot modify .mcpignore`);
		}

		return normalized;
	}

	/**
	 * Reload .mcpignore patterns
	 */
	async reloadIgnorePatterns(): Promise<void> {
		await this.ignoreManager.load();
	}

	/**
	 * Check if a path is accessible (for listing)
	 */
	isAccessible(path: string): boolean {
		try {
			this.validateRead(path);
			return true;
		} catch {
			return false;
		}
	}
}
