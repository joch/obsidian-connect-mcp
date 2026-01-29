import { App } from "obsidian";
import { SecurityManager } from "../security/security-manager";

interface ToolResult {
	content: Array<{ type: string; text: string }>;
	isError?: boolean;
}

// Dataview API interface (subset of what we need)
interface DataviewApi {
	query(
		query: string,
		originFile?: string
	): Promise<{
		successful: boolean;
		value?: {
			type: string;
			headers?: string[];
			values?: unknown[];
		};
		error?: string;
	}>;
}

/**
 * Get the Dataview plugin API if available
 */
function getDataviewApi(app: App): DataviewApi | null {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const dataviewPlugin = (app as any).plugins?.plugins?.dataview;
	if (!dataviewPlugin?.api) {
		return null;
	}
	return dataviewPlugin.api as DataviewApi;
}

/**
 * Register dataview-related tools with the MCP server
 */
export function registerDataviewTools(
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
	// dataview_query - Execute a DQL query
	registerTool(
		{
			name: "dataview_query",
			description: "Execute a Dataview DQL query",
			inputSchema: {
				type: "object",
				properties: {
					query: {
						type: "string",
						description: "DQL query (LIST, TABLE, TASK, CALENDAR)",
					},
				},
				required: ["query"],
			},
		},
		async (args): Promise<ToolResult> => {
			try {
				const query = args.query as string;

				const api = getDataviewApi(app);
				if (!api) {
					return {
						content: [
							{
								type: "text",
								text: "Dataview plugin is not installed or enabled. Please install and enable the Dataview plugin to use DQL queries.",
							},
						],
						isError: true,
					};
				}

				const result = await api.query(query);

				if (!result.successful) {
					return {
						content: [
							{
								type: "text",
								text: `DQL query failed: ${result.error || "Unknown error"}`,
							},
						],
						isError: true,
					};
				}

				// Format the result based on query type
				const value = result.value;
				let formatted: unknown;

				if (value?.type === "list") {
					// List query result
					formatted = {
						type: "list",
						items: value.values?.map((item) => formatDataviewValue(item)),
					};
				} else if (value?.type === "table") {
					// Table query result
					formatted = {
						type: "table",
						headers: value.headers,
						rows: value.values?.map((row) => {
							if (Array.isArray(row)) {
								return row.map((cell) => formatDataviewValue(cell));
							}
							return formatDataviewValue(row);
						}),
					};
				} else if (value?.type === "task") {
					// Task query result
					formatted = {
						type: "task",
						tasks: value.values?.map((task) => formatDataviewValue(task)),
					};
				} else {
					// Unknown type, return raw
					formatted = value;
				}

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(formatted, null, 2),
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
 * Format Dataview values for JSON output
 */
function formatDataviewValue(value: unknown): unknown {
	if (value === null || value === undefined) {
		return null;
	}

	// Handle Dataview Link objects
	if (typeof value === "object" && value !== null) {
		const obj = value as Record<string, unknown>;

		// Dataview Link type
		if (obj.path && typeof obj.path === "string") {
			return {
				type: "link",
				path: obj.path,
				display: obj.display || obj.path,
			};
		}

		// Dataview Date type
		if (obj.ts && typeof obj.ts === "number") {
			return {
				type: "date",
				value: new Date(obj.ts).toISOString(),
			};
		}

		// Array
		if (Array.isArray(value)) {
			return value.map((item) => formatDataviewValue(item));
		}

		// Task object
		if ("text" in obj && "completed" in obj) {
			return {
				type: "task",
				text: obj.text,
				completed: obj.completed,
				path: obj.path,
				line: obj.line,
			};
		}
	}

	// Primitives
	return value;
}
