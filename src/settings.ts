import { App, PluginSettingTab, Setting } from "obsidian";
import type DataviewMcpPlugin from "./main";

export interface DataviewMcpSettings {
	port: number;
	apiKey: string;
	autoStart: boolean;
	readOnlyMode: boolean;
	allowCommandExecution: boolean;
	promptsFolder: string;
}

export const DEFAULT_SETTINGS: DataviewMcpSettings = {
	port: 27124,
	apiKey: "",
	autoStart: true,
	readOnlyMode: false,
	allowCommandExecution: false,
	promptsFolder: "prompts",
};

/**
 * Generate a random API key
 */
function generateApiKey(): string {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	let result = "";
	for (let i = 0; i < 32; i++) {
		result += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return result;
}

export class DataviewMcpSettingTab extends PluginSettingTab {
	plugin: DataviewMcpPlugin;

	constructor(app: App, plugin: DataviewMcpPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// API Key with Generate button
		new Setting(containerEl)
			.setName("API key")
			.setDesc("Secret key for authenticating MCP requests (required).")
			.addText((text) => {
				text
					.setPlaceholder("Click generate or enter your own")
					.setValue(this.plugin.settings.apiKey)
					.onChange(async (value) => {
						this.plugin.settings.apiKey = value;
						await this.plugin.saveSettings();
					});
				text.inputEl.addClass("connect-mcp-api-key-input");
			})
			.addButton((button) =>
				button.setButtonText("Generate").onClick(async () => {
					this.plugin.settings.apiKey = generateApiKey();
					await this.plugin.saveSettings();
					this.display(); // Refresh to show new key
				})
			);

		new Setting(containerEl)
			.setName("Port")
			.setDesc("MCP server port (default: 27124).")
			.addText((text) =>
				text
					.setPlaceholder("27124")
					.setValue(String(this.plugin.settings.port))
					.onChange(async (value) => {
						const port = parseInt(value, 10);
						if (!isNaN(port) && port > 0 && port < 65536) {
							this.plugin.settings.port = port;
							await this.plugin.saveSettings();
						}
					})
			);

		new Setting(containerEl)
			.setName("Auto-start server")
			.setDesc("Automatically start the MCP server when Obsidian opens.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoStart)
					.onChange(async (value) => {
						this.plugin.settings.autoStart = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Read-only mode")
			.setDesc("Block all write operations (create, update, delete).")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.readOnlyMode)
					.onChange(async (value) => {
						this.plugin.settings.readOnlyMode = value;
						await this.plugin.saveSettings();
						this.plugin.updateSecurityMode();
					})
			);

		new Setting(containerEl)
			.setName("Allow command execution")
			.setDesc("Allow agents to execute Obsidian commands (Templater, MetaBind, etc.). Requires server restart.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.allowCommandExecution)
					.onChange(async (value) => {
						this.plugin.settings.allowCommandExecution = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Prompts folder")
			.setDesc("Folder containing prompt templates for MCP agents.")
			.addText((text) =>
				text
					.setPlaceholder("Prompts")
					.setValue(this.plugin.settings.promptsFolder)
					.onChange(async (value) => {
						this.plugin.settings.promptsFolder = value || "prompts";
						await this.plugin.saveSettings();
					})
			);

		// Server status and control
		new Setting(containerEl)
			.setName("Server status")
			.setDesc(
				this.plugin.isServerRunning()
					? `Server running on port ${this.plugin.settings.port}.`
					: "Server is stopped."
			)
			.addButton((button) =>
				button
					.setButtonText(this.plugin.isServerRunning() ? "Stop server" : "Start server")
					.onClick(async () => {
						if (this.plugin.isServerRunning()) {
							await this.plugin.stopServer();
						} else {
							await this.plugin.startServer();
						}
						this.display();
					})
			);

		// Client configuration
		new Setting(containerEl).setName("Client configuration").setHeading();

		new Setting(containerEl).setDesc("Add this to your Claude Code MCP settings:");

		const configPre = containerEl.createEl("pre");
		configPre.addClass("connect-mcp-code-block");
		configPre.setText(`{
  "mcpServers": {
    "obsidian": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "http://localhost:${this.plugin.settings.port}/mcp",
        "--header",
        "Authorization:\${AUTH}"
      ],
      "env": {
        "AUTH": "Bearer ${this.plugin.settings.apiKey || "YOUR_API_KEY"}"
      }
    }
  }
}`);

		// Prompts help
		new Setting(containerEl).setName("Prompts").setHeading();

		new Setting(containerEl).setDesc(
			`Prompts let you give AI agents context about your vault that they can discover and use automatically. Create notes in the "${this.plugin.settings.promptsFolder}" folder to help agents understand your vault structure, naming conventions, folder organization, and useful Dataview queries for your workflow.`
		);

		const exampleSetting = new Setting(containerEl);
		exampleSetting.setDesc("Example use cases: vault structure overview, Dataview queries, note templates, workflows.");

		const promptFormat = containerEl.createEl("pre");
		promptFormat.addClass("connect-mcp-code-block");
		promptFormat.setText(`---
description: Brief description for the agent to see
---

# My vault structure

## Folders
- Projects/ - Active project notes
- Archive/ - Completed projects
- Daily/ - Daily notes (YYYY-MM-DD format)

## Useful Dataview queries
\`\`\`dataview
TABLE status, due FROM "Projects" WHERE status != "done"
\`\`\``);

		// Security help
		new Setting(containerEl).setName("Security").setHeading();

		new Setting(containerEl).setDesc(
			"Create a .mcpignore file in your vault root to block paths (gitignore-style patterns)."
		);

		const ignoreExample = containerEl.createEl("pre");
		ignoreExample.addClass("connect-mcp-code-block");
		ignoreExample.setText(`# Block private folders
private/
journal/

# Block specific files
secrets.md`);
	}
}
