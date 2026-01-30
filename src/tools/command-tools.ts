import { App } from "obsidian";
import { SecurityManager } from "../security/security-manager";
import { getAppInternals } from "../obsidian-internals";

interface ToolResult {
	content: Array<{ type: string; text: string }>;
	isError?: boolean;
}

/**
 * Register command execution tools with the MCP server
 */
export function registerCommandTools(
	app: App,
	security: SecurityManager,
	allowCommandExecution: boolean,
	registerTool: (
		definition: {
			name: string;
			description: string;
			inputSchema: object;
		},
		handler: (args: Record<string, unknown>) => Promise<ToolResult>
	) => void
): void {
	// Skip registration if command execution is disabled
	if (!allowCommandExecution) {
		return;
	}
	// command_list - List available commands
	registerTool(
		{
			name: "command_list",
			description:
				"List available Obsidian commands. Optionally filter by plugin name (e.g., 'templater', 'metabind').",
			inputSchema: {
				type: "object",
				properties: {
					filter: {
						type: "string",
						description:
							"Filter commands by ID containing this string (case-insensitive)",
					},
				},
			},
		},
		async (args): Promise<ToolResult> => {
			try {
				// Check if read-only mode blocks command listing (it shouldn't, but check anyway)
				if (security.readOnlyMode) {
					// Allow listing commands even in read-only mode
				}

				const filter = (args.filter as string | undefined)?.toLowerCase();

				const appInternals = getAppInternals(app);
				const commands = appInternals.commands.listCommands();

				const filtered = filter
					? commands.filter(
							(cmd) =>
								cmd.id.toLowerCase().includes(filter) ||
								cmd.name.toLowerCase().includes(filter)
						)
					: commands;

				// Sort by id for consistent output
				filtered.sort((a, b) => a.id.localeCompare(b.id));

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									total: filtered.length,
									commands: filtered.map((cmd) => ({
										id: cmd.id,
										name: cmd.name,
									})),
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
						{
							type: "text",
							text: error instanceof Error ? error.message : String(error),
						},
					],
					isError: true,
				};
			}
		}
	);

	// command_execute - Execute a command by ID
	registerTool(
		{
			name: "command_execute",
			description:
				"Execute an Obsidian command by its ID. Use command_list to discover available commands. This can run Templater templates, MetaBind actions, and any other plugin commands.",
			inputSchema: {
				type: "object",
				properties: {
					commandId: {
						type: "string",
						description:
							"The command ID to execute (e.g., 'templater-obsidian:insert-templater')",
					},
				},
				required: ["commandId"],
			},
		},
		async (args): Promise<ToolResult> => {
			try {
				const commandId = args.commandId as string;

				// Check read-only mode - block command execution as it could modify files
				if (security.readOnlyMode) {
					return {
						content: [
							{
								type: "text",
								text: "Command execution is blocked in read-only mode",
							},
						],
						isError: true,
					};
				}

				// Verify the command exists
				const appInternals = getAppInternals(app);
				const commands = appInternals.commands.listCommands();
				const command = commands.find((cmd) => cmd.id === commandId);

				if (!command) {
					return {
						content: [
							{
								type: "text",
								text: `Command not found: ${commandId}. Use command_list to see available commands.`,
							},
						],
						isError: true,
					};
				}

				// Execute the command
				await appInternals.commands.executeCommandById(commandId);

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									executed: true,
									commandId,
									commandName: command.name,
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
						{
							type: "text",
							text: `Failed to execute command: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
					isError: true,
				};
			}
		}
	);
}
