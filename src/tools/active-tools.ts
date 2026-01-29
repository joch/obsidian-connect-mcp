import { App, MarkdownView, TFile } from "obsidian";
import { SecurityManager } from "../security/security-manager";

interface ToolResult {
	content: Array<{ type: string; text: string }>;
	isError?: boolean;
}

/**
 * Register active note tools with the MCP server
 */
export function registerActiveTools(
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
	// active_note - Get the currently open note
	registerTool(
		{
			name: "active_note",
			description: "Get the currently open note in Obsidian",
			inputSchema: {
				type: "object",
				properties: {},
			},
		},
		async (): Promise<ToolResult> => {
			try {
				// Get the active markdown view
				const activeView = app.workspace.getActiveViewOfType(MarkdownView);

				if (!activeView) {
					return {
						content: [
							{
								type: "text",
								text: JSON.stringify({ active: false, message: "No note is currently open" }, null, 2),
							},
						],
					};
				}

				const file = activeView.file;
				if (!file || !(file instanceof TFile)) {
					return {
						content: [
							{
								type: "text",
								text: JSON.stringify({ active: false, message: "No file is associated with the current view" }, null, 2),
							},
						],
					};
				}

				// Check security
				if (!security.isAccessible(file.path)) {
					return {
						content: [
							{
								type: "text",
								text: JSON.stringify({ active: true, blocked: true, message: "Access to active note is blocked by security settings" }, null, 2),
							},
						],
					};
				}

				const content = await app.vault.read(file);
				const cache = app.metadataCache.getFileCache(file);

				// Get cursor position if available
				const editor = activeView.editor;
				let cursor = null;
				if (editor) {
					const pos = editor.getCursor();
					cursor = {
						line: pos.line + 1, // 1-indexed
						ch: pos.ch,
					};
				}

				// Get selection if any
				let selection = null;
				if (editor) {
					const selectedText = editor.getSelection();
					if (selectedText) {
						selection = selectedText;
					}
				}

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									active: true,
									path: file.path,
									content,
									frontmatter: cache?.frontmatter || null,
									cursor,
									selection,
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
}
