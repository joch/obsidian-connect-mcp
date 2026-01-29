import { App, TFile, TFolder, normalizePath } from "obsidian";
import { SecurityManager } from "../security/security-manager";

interface ToolResult {
	content: Array<{ type: string; text: string }>;
	isError?: boolean;
}

/**
 * Register all vault-related tools with the MCP server
 */
export function registerVaultTools(
	app: App,
	security: SecurityManager,
	registerTool: (
		definition: {
			name: string;
			description: string;
			inputSchema: object;
		},
		handler: (args: Record<string, unknown>) => Promise<ToolResult>
	) => void
): void {
	// vault_list - List files and folders
	registerTool(
		{
			name: "vault_list",
			description: "List files and folders in the vault",
			inputSchema: {
				type: "object",
				properties: {
					path: { type: "string", description: "Folder path (default: root)" },
				},
			},
		},
		async (args): Promise<ToolResult> => {
			const requestedPath = (args.path as string) || "";
			const files = app.vault.getMarkdownFiles();

			// Filter by path prefix and security
			const filtered = files.filter((f) => {
				if (requestedPath && !f.path.startsWith(requestedPath)) {
					return false;
				}
				return security.isAccessible(f.path);
			});

			// Group by folder for better structure
			const folders = new Set<string>();
			const fileList: string[] = [];

			for (const file of filtered) {
				fileList.push(file.path);
				// Track folders
				const parts = file.path.split("/");
				let current = "";
				for (let i = 0; i < parts.length - 1; i++) {
					const part = parts[i];
					if (part) {
						current = current ? `${current}/${part}` : part;
						folders.add(current);
					}
				}
			}

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(
							{
								folders: Array.from(folders).sort(),
								files: fileList.sort(),
								total: fileList.length,
							},
							null,
							2
						),
					},
				],
			};
		}
	);

	// vault_read - Read note content with frontmatter
	registerTool(
		{
			name: "vault_read",
			description: "Read a note's content and frontmatter",
			inputSchema: {
				type: "object",
				properties: {
					path: { type: "string", description: "Note path" },
				},
				required: ["path"],
			},
		},
		async (args): Promise<ToolResult> => {
			try {
				const path = security.validateRead(args.path as string);
				const file = app.vault.getAbstractFileByPath(path);

				if (!file || !(file instanceof TFile)) {
					return {
						content: [{ type: "text", text: `File not found: ${path}` }],
						isError: true,
					};
				}

				const content = await app.vault.read(file);
				const cache = app.metadataCache.getFileCache(file);

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									path,
									content,
									frontmatter: cache?.frontmatter || null,
								},
								null,
								2
							),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{ type: "text", text: error instanceof Error ? error.message : String(error) },
					],
					isError: true,
				};
			}
		}
	);

	// vault_create - Create new note
	registerTool(
		{
			name: "vault_create",
			description: "Create a new note",
			inputSchema: {
				type: "object",
				properties: {
					path: { type: "string", description: "Note path" },
					content: { type: "string", description: "Note content" },
				},
				required: ["path", "content"],
			},
		},
		async (args): Promise<ToolResult> => {
			try {
				const path = security.validateWrite(args.path as string);
				const content = args.content as string;

				// Ensure .md extension
				const normalizedPath = path.endsWith(".md") ? path : `${path}.md`;

				// Check if file already exists
				const existing = app.vault.getAbstractFileByPath(normalizedPath);
				if (existing) {
					return {
						content: [{ type: "text", text: `File already exists: ${normalizedPath}` }],
						isError: true,
					};
				}

				// Create parent folders if needed
				const parentPath = normalizedPath.split("/").slice(0, -1).join("/");
				if (parentPath) {
					const parentFolder = app.vault.getAbstractFileByPath(parentPath);
					if (!parentFolder) {
						await app.vault.createFolder(parentPath);
					}
				}

				await app.vault.create(normalizedPath, content);

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({ created: normalizedPath }, null, 2),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{ type: "text", text: error instanceof Error ? error.message : String(error) },
					],
					isError: true,
				};
			}
		}
	);

	// vault_update - Replace entire file content
	registerTool(
		{
			name: "vault_update",
			description: "Replace entire file content",
			inputSchema: {
				type: "object",
				properties: {
					path: { type: "string", description: "Note path" },
					content: { type: "string", description: "New content" },
				},
				required: ["path", "content"],
			},
		},
		async (args): Promise<ToolResult> => {
			try {
				const path = security.validateWrite(args.path as string);
				const content = args.content as string;

				const file = app.vault.getAbstractFileByPath(path);
				if (!file || !(file instanceof TFile)) {
					return {
						content: [{ type: "text", text: `File not found: ${path}` }],
						isError: true,
					};
				}

				await app.vault.modify(file, content);

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({ updated: path }, null, 2),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{ type: "text", text: error instanceof Error ? error.message : String(error) },
					],
					isError: true,
				};
			}
		}
	);

	// vault_delete - Delete note (moves to trash)
	registerTool(
		{
			name: "vault_delete",
			description: "Delete a note (moves to trash)",
			inputSchema: {
				type: "object",
				properties: {
					path: { type: "string", description: "Note path" },
				},
				required: ["path"],
			},
		},
		async (args): Promise<ToolResult> => {
			try {
				const path = security.validateWrite(args.path as string);

				const file = app.vault.getAbstractFileByPath(path);
				if (!file || !(file instanceof TFile)) {
					return {
						content: [{ type: "text", text: `File not found: ${path}` }],
						isError: true,
					};
				}

				// Use trash instead of delete for safety
				await app.vault.trash(file, true);

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({ deleted: path, movedToTrash: true }, null, 2),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{ type: "text", text: error instanceof Error ? error.message : String(error) },
					],
					isError: true,
				};
			}
		}
	);

	// vault_search - Search notes by content
	registerTool(
		{
			name: "vault_search",
			description: "Search notes by content",
			inputSchema: {
				type: "object",
				properties: {
					query: { type: "string", description: "Search query" },
					path: { type: "string", description: "Limit to folder (optional)" },
				},
				required: ["query"],
			},
		},
		async (args): Promise<ToolResult> => {
			const query = (args.query as string).toLowerCase();
			const pathFilter = args.path as string | undefined;

			const files = app.vault.getMarkdownFiles();
			const results: Array<{ path: string; matches: string[] }> = [];

			for (const file of files) {
				// Check security
				if (!security.isAccessible(file.path)) continue;

				// Check path filter
				if (pathFilter && !file.path.startsWith(pathFilter)) continue;

				try {
					const content = await app.vault.cachedRead(file);
					const lines = content.split("\n");
					const matchingLines: string[] = [];

					for (let i = 0; i < lines.length; i++) {
						const line = lines[i];
						if (line && line.toLowerCase().includes(query)) {
							// Include line number and context
							matchingLines.push(`${i + 1}: ${line.trim()}`);
						}
					}

					if (matchingLines.length > 0) {
						results.push({
							path: file.path,
							matches: matchingLines.slice(0, 5), // Limit matches per file
						});
					}
				} catch {
					// Skip files that can't be read
				}
			}

			// Limit total results
			const limitedResults = results.slice(0, 20);

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(
							{
								query,
								results: limitedResults,
								totalMatches: results.length,
								shown: limitedResults.length,
							},
							null,
							2
						),
					},
				],
			};
		}
	);
}
