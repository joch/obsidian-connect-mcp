import { Notice, Plugin } from "obsidian";
import { McpHttpServer } from "./mcp-server";
import { DataviewMcpSettings, DEFAULT_SETTINGS, DataviewMcpSettingTab } from "./settings";
import { registerVaultTools } from "./tools/vault-tools";
import { registerEditTools } from "./tools/edit-tools";
import { registerGraphTools } from "./tools/graph-tools";
import { registerDataviewTools } from "./tools/dataview-tools";
import { registerActiveTools } from "./tools/active-tools";
import { registerCommandTools } from "./tools/command-tools";
import { registerResources } from "./resources";
import { createPromptsHandlers } from "./prompts";

export default class DataviewMcpPlugin extends Plugin {
	settings: DataviewMcpSettings = DEFAULT_SETTINGS;
	private mcpServer: McpHttpServer | null = null;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.addSettingTab(new DataviewMcpSettingTab(this.app, this));

		this.addCommand({
			id: "start-server",
			name: "Start server",
			callback: (): void => {
				void this.startServer();
			},
		});

		this.addCommand({
			id: "stop-server",
			name: "Stop server",
			callback: (): void => {
				void this.stopServer();
			},
		});

		if (this.settings.autoStart && this.settings.apiKey) {
			// Delay start to ensure other plugins (like Dataview) are loaded
			setTimeout(() => {
				void this.startServer();
			}, 1000);
		}
	}

	onunload(): void {
		void this.stopServer();
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<DataviewMcpSettings>
		);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	async startServer(): Promise<void> {
		if (this.mcpServer?.isServerRunning()) {
			new Notice("Server is already running");
			return;
		}

		if (!this.settings.apiKey) {
			new Notice("Please set an API key in plugin settings");
			return;
		}

		this.mcpServer = new McpHttpServer(this.app, this, {
			port: this.settings.port,
			apiKey: this.settings.apiKey,
		});

		// Register tools, resources, and prompts
		this.registerCapabilities();

		try {
			await this.mcpServer.start();
			new Notice(`MCP server started on port ${this.settings.port}`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			new Notice(`Failed to start MCP server: ${message}`);
			this.mcpServer = null;
		}
	}

	async stopServer(): Promise<void> {
		if (this.mcpServer) {
			await this.mcpServer.stop();
			this.mcpServer = null;
			new Notice("Server stopped");
		}
	}

	isServerRunning(): boolean {
		return this.mcpServer?.isServerRunning() ?? false;
	}

	updateSecurityMode(): void {
		if (this.mcpServer) {
			this.mcpServer.getSecurityManager().setReadOnlyMode(this.settings.readOnlyMode);
		}
	}

	private registerCapabilities(): void {
		if (!this.mcpServer) return;

		// Register vault tools
		registerVaultTools(
			this.app,
			this.mcpServer.getSecurityManager(),
			this.mcpServer.registerTool.bind(this.mcpServer)
		);

		// Register edit tools
		registerEditTools(
			this.app,
			this.mcpServer.getSecurityManager(),
			this.mcpServer.registerTool.bind(this.mcpServer)
		);

		// Register graph tools
		registerGraphTools(
			this.app,
			this.mcpServer.getSecurityManager(),
			this.mcpServer.registerTool.bind(this.mcpServer)
		);

		// Register dataview tools
		registerDataviewTools(
			this.app,
			this.mcpServer.getSecurityManager(),
			this.mcpServer.registerTool.bind(this.mcpServer)
		);

		// Register active note tools
		registerActiveTools(
			this.app,
			this.mcpServer.getSecurityManager(),
			this.mcpServer.registerTool.bind(this.mcpServer)
		);

		// Register command tools (only if enabled in settings)
		registerCommandTools(
			this.app,
			this.mcpServer.getSecurityManager(),
			this.settings.allowCommandExecution,
			this.mcpServer.registerTool.bind(this.mcpServer)
		);

		// Register resources
		registerResources(
			this.app,
			"1.0.0",
			this.mcpServer.registerResource.bind(this.mcpServer)
		);

		// Register prompts handlers
		const promptsHandlers = createPromptsHandlers(this.app, this.settings.promptsFolder);
		this.mcpServer.setPromptsHandlers(
			promptsHandlers.listPrompts,
			promptsHandlers.getPrompt
		);
	}
}
