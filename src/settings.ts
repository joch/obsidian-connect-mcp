import { App, PluginSettingTab, Setting } from "obsidian";
import type DataviewMcpPlugin from "./main";

export interface DataviewMcpSettings {
	port: number;
	apiKey: string;
	autoStart: boolean;
	readOnlyMode: boolean;
	promptsFolder: string;
}

export const DEFAULT_SETTINGS: DataviewMcpSettings = {
	port: 27124,
	apiKey: "",
	autoStart: true,
	readOnlyMode: false,
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

		containerEl.createEl("h2", { text: "Connect MCP" });

		// API Key with Generate button
		new Setting(containerEl)
			.setName("API Key")
			.setDesc("Secret key for authenticating MCP requests (required)")
			.addText((text) => {
				text
					.setPlaceholder("Click Generate or enter your own")
					.setValue(this.plugin.settings.apiKey)
					.onChange(async (value) => {
						this.plugin.settings.apiKey = value;
						await this.plugin.saveSettings();
					});
				text.inputEl.style.width = "250px";
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
			.setDesc("MCP server port (default: 27124)")
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
			.setDesc("Automatically start the MCP server when Obsidian opens")
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
			.setDesc("Block all write operations (create, update, delete)")
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
			.setName("Prompts folder")
			.setDesc("Folder containing prompt templates for MCP agents")
			.addText((text) =>
				text
					.setPlaceholder("prompts")
					.setValue(this.plugin.settings.promptsFolder)
					.onChange(async (value) => {
						this.plugin.settings.promptsFolder = value || "prompts";
						await this.plugin.saveSettings();
					})
			);

		// Server status and control
		new Setting(containerEl)
			.setName("Server Status")
			.setDesc(
				this.plugin.isServerRunning()
					? `Server running on port ${this.plugin.settings.port}`
					: "Server is stopped"
			)
			.addButton((button) =>
				button
					.setButtonText(this.plugin.isServerRunning() ? "Stop Server" : "Start Server")
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
		containerEl.createEl("h3", { text: "Client Configuration" });
		const configDesc = containerEl.createEl("p");
		configDesc.setText("Add this to your Claude Code MCP settings:");

		const configPre = containerEl.createEl("pre");
		configPre.style.backgroundColor = "var(--background-secondary)";
		configPre.style.padding = "10px";
		configPre.style.borderRadius = "5px";
		configPre.style.overflow = "auto";
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
		containerEl.createEl("h3", { text: "Prompts" });
		const promptsIntro = containerEl.createEl("p");
		promptsIntro.setText(
			`Prompts let you give AI agents context about your vault that they can discover and use automatically.`
		);

		const promptsWhy = containerEl.createEl("p");
		promptsWhy.style.marginTop = "8px";
		promptsWhy.setText(
			`Create notes in the "${this.plugin.settings.promptsFolder}" folder to help agents understand your vault structure, naming conventions, folder organization, and useful Dataview queries for your workflow.`
		);

		const promptsExamples = containerEl.createEl("p");
		promptsExamples.style.marginTop = "8px";
		promptsExamples.style.fontWeight = "bold";
		promptsExamples.setText("Example use cases:");

		const exampleList = containerEl.createEl("ul");
		exampleList.style.marginTop = "4px";
		exampleList.style.marginBottom = "12px";
		const examples = [
			"Vault structure overview - describe your folder hierarchy and what goes where",
			"Dataview queries - common DQL queries for finding tasks, projects, recent notes",
			"Note templates - explain your frontmatter conventions and metadata fields",
			"Workflows - describe how you use tags, links, or specific note types",
		];
		for (const example of examples) {
			const li = exampleList.createEl("li");
			li.setText(example);
		}

		const promptsFormat = containerEl.createEl("p");
		promptsFormat.style.fontWeight = "bold";
		promptsFormat.setText("Prompt format:");

		const promptFormat = containerEl.createEl("pre");
		promptFormat.style.backgroundColor = "var(--background-secondary)";
		promptFormat.style.padding = "10px";
		promptFormat.style.borderRadius = "5px";
		promptFormat.style.marginTop = "4px";
		promptFormat.setText(`---
description: Brief description for the agent to see
---

# My Vault Structure

## Folders
- Projects/ - Active project notes
- Archive/ - Completed projects
- Daily/ - Daily notes (YYYY-MM-DD format)

## Useful Dataview Queries
\`\`\`dataview
TABLE status, due FROM "Projects" WHERE status != "done"
\`\`\``);

		// Security help
		containerEl.createEl("h3", { text: "Security" });
		const securityHelp = containerEl.createEl("p");
		securityHelp.setText(
			"Create a .mcpignore file in your vault root to block paths (gitignore-style patterns):"
		);
		const ignoreExample = containerEl.createEl("pre");
		ignoreExample.style.backgroundColor = "var(--background-secondary)";
		ignoreExample.style.padding = "10px";
		ignoreExample.style.borderRadius = "5px";
		ignoreExample.setText(`# Block private folders
private/
journal/

# Block specific files
secrets.md`);
	}
}
