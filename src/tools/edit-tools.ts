import { App, TFile } from "obsidian";
import { SecurityManager } from "../security/security-manager";
import { findBestMatch } from "../utils/fuzzy-match";

interface ToolResult {
	content: Array<{ type: string; text: string }>;
	isError?: boolean;
}

/**
 * Register edit-related tools with the MCP server
 */
export function registerEditTools(
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
	// vault_edit - Fuzzy find/replace
	registerTool(
		{
			name: "vault_edit",
			description: "Find and replace text using fuzzy matching",
			inputSchema: {
				type: "object",
				properties: {
					path: { type: "string", description: "Note path" },
					oldText: { type: "string", description: "Text to find (fuzzy matched)" },
					newText: { type: "string", description: "Replacement text" },
					fuzzyThreshold: {
						type: "number",
						description: "Match threshold 0-1 (default: 0.7)",
					},
				},
				required: ["path", "oldText", "newText"],
			},
		},
		async (args): Promise<ToolResult> => {
			try {
				const path = security.validateWrite(args.path as string);
				const oldText = args.oldText as string;
				const newText = args.newText as string;
				const threshold = (args.fuzzyThreshold as number) ?? 0.7;

				const file = app.vault.getAbstractFileByPath(path);
				if (!file || !(file instanceof TFile)) {
					return {
						content: [{ type: "text", text: `File not found: ${path}` }],
						isError: true,
					};
				}

				const content = await app.vault.read(file);
				const match = findBestMatch(content, oldText, threshold);

				if (!match) {
					return {
						content: [
							{
								type: "text",
								text: `No match found for text with threshold ${threshold}. Try lowering the threshold or checking the search text.`,
							},
						],
						isError: true,
					};
				}

				// Perform the replacement
				const newContent =
					content.slice(0, match.start) + newText + content.slice(match.end);

				await app.vault.modify(file, newContent);

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									path,
									matched: match.match,
									similarity: Math.round(match.similarity * 100) + "%",
									replaced: true,
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

	// vault_edit_line - Insert/replace at line number
	registerTool(
		{
			name: "vault_edit_line",
			description: "Insert or replace content at a specific line",
			inputSchema: {
				type: "object",
				properties: {
					path: { type: "string", description: "Note path" },
					lineNumber: { type: "number", description: "Line number (1-based)" },
					content: { type: "string", description: "Content to insert/replace" },
					mode: {
						type: "string",
						enum: ["before", "after", "replace"],
						description: "Insert mode (default: replace)",
					},
				},
				required: ["path", "lineNumber", "content"],
			},
		},
		async (args): Promise<ToolResult> => {
			try {
				const path = security.validateWrite(args.path as string);
				const lineNumber = args.lineNumber as number;
				const newContent = args.content as string;
				const mode = (args.mode as string) || "replace";

				const file = app.vault.getAbstractFileByPath(path);
				if (!file || !(file instanceof TFile)) {
					return {
						content: [{ type: "text", text: `File not found: ${path}` }],
						isError: true,
					};
				}

				const content = await app.vault.read(file);
				const lines = content.split("\n");

				// Validate line number
				if (lineNumber < 1 || lineNumber > lines.length + 1) {
					return {
						content: [
							{
								type: "text",
								text: `Invalid line number: ${lineNumber}. File has ${lines.length} lines.`,
							},
						],
						isError: true,
					};
				}

				const index = lineNumber - 1;
				const newLines = newContent.split("\n");

				switch (mode) {
					case "before":
						lines.splice(index, 0, ...newLines);
						break;
					case "after":
						lines.splice(index + 1, 0, ...newLines);
						break;
					case "replace":
					default:
						lines.splice(index, 1, ...newLines);
						break;
				}

				await app.vault.modify(file, lines.join("\n"));

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									path,
									lineNumber,
									mode,
									linesInserted: newLines.length,
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

	// vault_patch - Edit heading, block, or frontmatter
	registerTool(
		{
			name: "vault_patch",
			description: "Edit a specific section: heading, block, or frontmatter field",
			inputSchema: {
				type: "object",
				properties: {
					path: { type: "string", description: "Note path" },
					targetType: {
						type: "string",
						enum: ["heading", "block", "frontmatter"],
						description: "What to target",
					},
					target: {
						type: "string",
						description:
							"Target identifier (heading path like 'Section::Subsection', block ID, or frontmatter field)",
					},
					operation: {
						type: "string",
						enum: ["append", "prepend", "replace"],
						description: "How to modify",
					},
					content: { type: "string", description: "Content to add/replace" },
				},
				required: ["path", "targetType", "target", "operation", "content"],
			},
		},
		async (args): Promise<ToolResult> => {
			try {
				const path = security.validateWrite(args.path as string);
				const targetType = args.targetType as "heading" | "block" | "frontmatter";
				const target = args.target as string;
				const operation = args.operation as "append" | "prepend" | "replace";
				const patchContent = args.content as string;

				const file = app.vault.getAbstractFileByPath(path);
				if (!file || !(file instanceof TFile)) {
					return {
						content: [{ type: "text", text: `File not found: ${path}` }],
						isError: true,
					};
				}

				const content = await app.vault.read(file);
				let newContent: string;

				switch (targetType) {
					case "heading":
						newContent = patchHeading(content, target, operation, patchContent);
						break;
					case "block":
						newContent = patchBlock(content, target, operation, patchContent);
						break;
					case "frontmatter":
						newContent = patchFrontmatter(content, target, operation, patchContent);
						break;
					default:
						return {
							content: [{ type: "text", text: `Unknown target type: ${targetType}` }],
							isError: true,
						};
				}

				await app.vault.modify(file, newContent);

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									path,
									targetType,
									target,
									operation,
									patched: true,
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

/**
 * Patch content under a heading
 * Heading path format: "Section" or "Section::Subsection"
 */
function patchHeading(
	content: string,
	headingPath: string,
	operation: "append" | "prepend" | "replace",
	patchContent: string
): string {
	const lines = content.split("\n");
	const headings = headingPath.split("::");

	let currentLevel = 0;
	let targetStart = -1;
	let targetEnd = -1;
	let headingIndex = 0;

	// Find the heading position
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i] || "";
		const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

		if (headingMatch && headingMatch[1] && headingMatch[2]) {
			const level = headingMatch[1].length;
			const text = headingMatch[2].trim();
			const targetHeading = headings[headingIndex];

			if (text === targetHeading && level > currentLevel) {
				currentLevel = level;
				headingIndex++;

				if (headingIndex === headings.length) {
					// Found the target heading
					targetStart = i;

					// Find the end (next heading of same or higher level, or EOF)
					for (let j = i + 1; j < lines.length; j++) {
						const nextLine = lines[j] || "";
						const nextHeading = nextLine.match(/^(#{1,6})\s+/);
						if (nextHeading && nextHeading[1] && nextHeading[1].length <= level) {
							targetEnd = j;
							break;
						}
					}
					if (targetEnd === -1) {
						targetEnd = lines.length;
					}
					break;
				}
			}
		}
	}

	if (targetStart === -1) {
		throw new Error(`Heading not found: ${headingPath}`);
	}

	// Apply the patch
	const headingLine = lines[targetStart];
	const contentLines = lines.slice(targetStart + 1, targetEnd);

	switch (operation) {
		case "replace":
			lines.splice(targetStart + 1, targetEnd - targetStart - 1, patchContent);
			break;
		case "prepend":
			lines.splice(targetStart + 1, 0, patchContent);
			break;
		case "append":
			lines.splice(targetEnd, 0, patchContent);
			break;
	}

	return lines.join("\n");
}

/**
 * Patch a block by ID (^block-id)
 */
function patchBlock(
	content: string,
	blockId: string,
	operation: "append" | "prepend" | "replace",
	patchContent: string
): string {
	// Find line with ^block-id
	const blockMarker = `^${blockId}`;
	const lines = content.split("\n");
	let blockLine = -1;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i] || "";
		if (line.includes(blockMarker)) {
			blockLine = i;
			break;
		}
	}

	if (blockLine === -1) {
		throw new Error(`Block not found: ${blockId}`);
	}

	const originalLine = lines[blockLine] || "";
	const markerIndex = originalLine.indexOf(blockMarker);
	const textBefore = originalLine.slice(0, markerIndex).trimEnd();
	const marker = originalLine.slice(markerIndex);

	switch (operation) {
		case "replace":
			lines[blockLine] = patchContent + " " + marker;
			break;
		case "prepend":
			lines[blockLine] = patchContent + " " + textBefore + " " + marker;
			break;
		case "append":
			lines[blockLine] = textBefore + " " + patchContent + " " + marker;
			break;
	}

	return lines.join("\n");
}

/**
 * Patch a frontmatter field
 */
function patchFrontmatter(
	content: string,
	field: string,
	operation: "append" | "prepend" | "replace",
	patchContent: string
): string {
	// Check for frontmatter
	if (!content.startsWith("---")) {
		// No frontmatter, create it
		return `---\n${field}: ${patchContent}\n---\n\n${content}`;
	}

	const endIndex = content.indexOf("---", 3);
	if (endIndex === -1) {
		throw new Error("Invalid frontmatter: missing closing ---");
	}

	const frontmatter = content.slice(4, endIndex);
	const rest = content.slice(endIndex + 3);
	const lines = frontmatter.split("\n");

	// Find the field
	let fieldLine = -1;
	const fieldPattern = new RegExp(`^${field}:\\s*`);

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i] || "";
		if (fieldPattern.test(line)) {
			fieldLine = i;
			break;
		}
	}

	if (fieldLine === -1) {
		// Field doesn't exist, add it
		lines.push(`${field}: ${patchContent}`);
	} else {
		const currentLine = lines[fieldLine] || "";
		const currentValue = currentLine.replace(fieldPattern, "");

		switch (operation) {
			case "replace":
				lines[fieldLine] = `${field}: ${patchContent}`;
				break;
			case "prepend":
				lines[fieldLine] = `${field}: ${patchContent}${currentValue}`;
				break;
			case "append":
				lines[fieldLine] = `${field}: ${currentValue}${patchContent}`;
				break;
		}
	}

	return `---\n${lines.join("\n")}---${rest}`;
}
