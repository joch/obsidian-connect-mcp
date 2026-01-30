import express, { Application, Request, Response } from "express";
import cors from "cors";
import { Server } from "http";
import { App } from "obsidian";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
	ListToolsRequestSchema,
	CallToolRequestSchema,
	ListResourcesRequestSchema,
	ReadResourceRequestSchema,
	ListPromptsRequestSchema,
	GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { randomUUID } from "crypto";
import { SecurityManager } from "./security/security-manager";
import type DataviewMcpPlugin from "./main";

export interface McpServerConfig {
	port: number;
	apiKey: string;
}

interface ToolDefinition {
	name: string;
	description: string;
	inputSchema: object;
}

interface ToolHandler {
	(args: Record<string, unknown>): Promise<{
		content: Array<{ type: string; text: string }>;
		isError?: boolean;
	}>;
}

interface ResourceDefinition {
	uri: string;
	name: string;
	description: string;
	mimeType: string;
}

interface ResourceHandler {
	(): Promise<string>;
}

interface PromptDefinition {
	name: string;
	description?: string;
}

// PromptHandler type removed - using inline type instead

export class McpHttpServer {
	private expressApp: Application;
	private server?: Server;
	private transports: Map<string, StreamableHTTPServerTransport> = new Map();
	private obsidianApp: App;
	private plugin: DataviewMcpPlugin;
	private config: McpServerConfig;
	private securityManager: SecurityManager;
	private isRunning = false;

	// Tool, resource, and prompt registries
	private tools: Map<string, { definition: ToolDefinition; handler: ToolHandler }> = new Map();
	private resources: Map<string, { definition: ResourceDefinition; handler: ResourceHandler }> =
		new Map();
	private promptsLoader?: () => Promise<PromptDefinition[]>;
	private promptHandler?: (name: string) => Promise<{ description?: string; content: string }>;

	constructor(app: App, plugin: DataviewMcpPlugin, config: McpServerConfig) {
		this.obsidianApp = app;
		this.plugin = plugin;
		this.config = config;
		this.securityManager = new SecurityManager(app);

		this.expressApp = express();
		this.setupMiddleware();
		this.setupRoutes();
	}

	/**
	 * Get the security manager
	 */
	getSecurityManager(): SecurityManager {
		return this.securityManager;
	}

	/**
	 * Register a tool
	 */
	registerTool(definition: ToolDefinition, handler: ToolHandler): void {
		this.tools.set(definition.name, { definition, handler });
	}

	/**
	 * Register a resource
	 */
	registerResource(definition: ResourceDefinition, handler: ResourceHandler): void {
		this.resources.set(definition.uri, { definition, handler });
	}

	/**
	 * Set prompts loader and handler
	 */
	setPromptsHandlers(
		loader: () => Promise<PromptDefinition[]>,
		handler: (name: string) => Promise<{ description?: string; content: string }>
	): void {
		this.promptsLoader = loader;
		this.promptHandler = handler;
	}

	private setupMiddleware(): void {
		this.expressApp.use(
			cors({
				origin: "*",
				methods: ["GET", "POST", "DELETE", "OPTIONS"],
				allowedHeaders: ["Content-Type", "Authorization", "Mcp-Session-Id"],
				exposedHeaders: ["Mcp-Session-Id"],
			})
		);

		// Don't parse JSON for /mcp endpoint - StreamableHTTPServerTransport needs raw body
		this.expressApp.use((req, res, next) => {
			if (req.path === "/mcp") {
				return next();
			}
			express.json()(req, res, next);
		});

		// Auth middleware
		this.expressApp.use((req: Request, res: Response, next) => {
			// Skip auth for OPTIONS and health check
			if (req.method === "OPTIONS" || req.url === "/health") {
				return next();
			}

			const authHeader = req.headers.authorization;
			if (!this.config.apiKey) {
				// No API key configured, allow access
				return next();
			}

			if (!authHeader || authHeader !== `Bearer ${this.config.apiKey}`) {
				res.status(401).json({ error: "Unauthorized" });
				return;
			}

			next();
		});
	}

	private setupRoutes(): void {
		// Health check
		this.expressApp.get("/health", (_req: Request, res: Response) => {
			res.json({
				status: "ok",
				plugin: "obsidian-connect-mcp",
				vault: this.obsidianApp.vault.getName(),
			});
		});

		// MCP info
		this.expressApp.get("/mcp", (_req: Request, res: Response) => {
			res.json({
				message: "MCP endpoint active",
				usage: "POST /mcp with MCP protocol messages",
				protocol: "Model Context Protocol",
				transport: "HTTP",
			});
		});

		// MCP protocol endpoint
		this.expressApp.post("/mcp", (req: Request, res: Response) => {
			void this.handleMcpRequest(req, res);
		});

		// Session deletion
		this.expressApp.delete("/mcp", (req: Request, res: Response) => {
			const sessionId = req.headers["mcp-session-id"] as string;
			if (sessionId && this.transports.has(sessionId)) {
				const transport = this.transports.get(sessionId)!;
				void transport.close();
				this.transports.delete(sessionId);
				res.json({ message: "Session closed" });
			} else {
				res.status(404).json({ error: "Session not found" });
			}
		});
	}

	private createMcpServer(): McpServer {
		const mcpServer = new McpServer(
			{
				name: "obsidian-connect-mcp",
				version: "1.0.0",
			},
			{
				capabilities: {
					tools: {},
					resources: {},
					prompts: {},
				},
			}
		);

		// Access the underlying Server instance for setting request handlers
		const server = mcpServer.server;

		// List tools handler
		server.setRequestHandler(ListToolsRequestSchema, () => {
			const toolsList = Array.from(this.tools.values()).map((t) => t.definition);
			return Promise.resolve({ tools: toolsList });
		});

		// Call tool handler
		server.setRequestHandler(CallToolRequestSchema, async (request: { params: { name: string; arguments?: Record<string, unknown> } }) => {
			const { name, arguments: args } = request.params;
			const tool = this.tools.get(name);

			if (!tool) {
				return {
					content: [{ type: "text", text: `Unknown tool: ${name}` }],
					isError: true,
				};
			}

			try {
				return await tool.handler((args as Record<string, unknown>) || {});
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				return {
					content: [{ type: "text", text: `Error: ${message}` }],
					isError: true,
				};
			}
		});

		// List resources handler
		server.setRequestHandler(ListResourcesRequestSchema, () => {
			const resourcesList = Array.from(this.resources.values()).map((r) => r.definition);
			return Promise.resolve({ resources: resourcesList });
		});

		// Read resource handler
		server.setRequestHandler(ReadResourceRequestSchema, async (request: { params: { uri: string } }) => {
			const { uri } = request.params;
			const resource = this.resources.get(uri);

			if (!resource) {
				throw new Error(`Unknown resource: ${uri}`);
			}

			try {
				const content = await resource.handler();
				return {
					contents: [
						{
							uri,
							mimeType: resource.definition.mimeType,
							text: content,
						},
					],
				};
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				throw new Error(`Failed to read resource: ${message}`);
			}
		});

		// List prompts handler
		server.setRequestHandler(ListPromptsRequestSchema, async () => {
			if (!this.promptsLoader) {
				return { prompts: [] };
			}

			try {
				const prompts = await this.promptsLoader();
				return { prompts };
			} catch {
				return { prompts: [] };
			}
		});

		// Get prompt handler
		server.setRequestHandler(GetPromptRequestSchema, async (request: { params: { name: string } }) => {
			const { name } = request.params;

			if (!this.promptHandler) {
				throw new Error(`Prompt not found: ${name}`);
			}

			try {
				const prompt = await this.promptHandler(name);
				return {
					description: prompt.description,
					messages: [
						{
							role: "user" as const,
							content: {
								type: "text" as const,
								text: prompt.content,
							},
						},
					],
				};
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				throw new Error(`Failed to get prompt "${name}": ${message}`);
			}
		});

		return mcpServer;
	}

	private async handleMcpRequest(req: Request, res: Response): Promise<void> {
		try {
			const sessionId = req.headers["mcp-session-id"] as string | undefined;

			let transport: StreamableHTTPServerTransport;

			if (sessionId && this.transports.has(sessionId)) {
				// Existing session
				transport = this.transports.get(sessionId)!;
			} else if (sessionId && !this.transports.has(sessionId)) {
				// Client provided a session ID that doesn't exist (expired or invalid)
				// Return error so client knows to re-initialize
				res.status(400).json({
					jsonrpc: "2.0",
					error: {
						code: -32000,
						message: "Session expired or invalid. Please re-initialize.",
					},
					id: null,
				});
				return;
			} else {
				// New session (no session ID provided)
				const newSessionId = randomUUID();
				const mcpServer = this.createMcpServer();

				transport = new StreamableHTTPServerTransport({
					sessionIdGenerator: () => newSessionId,
				});

				await mcpServer.connect(transport);
				this.transports.set(newSessionId, transport);

				transport.onclose = () => {
					this.transports.delete(newSessionId);
				};
			}

			await transport.handleRequest(req, res);
		} catch (error) {
			console.warn("MCP request error:", error);
			if (!res.headersSent) {
				res.status(500).json({
					jsonrpc: "2.0",
					error: {
						code: -32603,
						message: error instanceof Error ? error.message : "Internal error",
					},
					id: null,
				});
			}
		}
	}

	async start(): Promise<void> {
		if (this.isRunning) {
			return;
		}

		// Initialize security manager
		await this.securityManager.initialize();
		this.securityManager.setReadOnlyMode(this.plugin.settings.readOnlyMode);

		return new Promise((resolve, reject) => {
			this.server = this.expressApp.listen(this.config.port, "127.0.0.1", () => {
				this.isRunning = true;
				console.debug(`MCP server started on http://127.0.0.1:${this.config.port}`);
				resolve();
			});

			this.server.on("error", (err) => {
				this.isRunning = false;
				reject(err);
			});
		});
	}

	async stop(): Promise<void> {
		if (!this.isRunning || !this.server) {
			return;
		}

		// Close all transports
		for (const [sessionId, transport] of this.transports) {
			void transport.close();
			this.transports.delete(sessionId);
		}

		return new Promise((resolve) => {
			this.server?.close(() => {
				this.isRunning = false;
				console.debug("MCP server stopped");
				resolve();
			});
		});
	}

	isServerRunning(): boolean {
		return this.isRunning;
	}
}
