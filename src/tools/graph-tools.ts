import { App, TFile } from "obsidian";
import { SecurityManager } from "../security/security-manager";
import { getMetadataCacheWithBacklinks } from "../obsidian-internals";

interface ToolResult {
	content: Array<{ type: string; text: string }>;
	isError?: boolean;
}

/**
 * Register graph-related tools with the MCP server
 */
export function registerGraphTools(
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
	// graph_info - Get link statistics for a note
	registerTool(
		{
			name: "graph_info",
			description: "Get link statistics for a note",
			inputSchema: {
				type: "object",
				properties: {
					path: { type: "string", description: "Note path" },
				},
				required: ["path"],
			},
		},
		(args): Promise<ToolResult> => {
			try {
				const path = security.validateRead(args.path as string);

				const file = app.vault.getAbstractFileByPath(path);
				if (!file || !(file instanceof TFile)) {
					return Promise.resolve({
						content: [{ type: "text", text: `File not found: ${path}` }],
						isError: true,
					});
				}

				const cache = app.metadataCache.getFileCache(file);

				// Count outgoing links
				const outLinks = cache?.links?.length || 0;
				const embedLinks = cache?.embeds?.length || 0;

				// Count backlinks (files that link to this one)
				const metadataCache = getMetadataCacheWithBacklinks(app);
				const backlinks = metadataCache.getBacklinksForFile(file);
				const inLinks = backlinks?.count() || 0;

				// Get unresolved links
				const unresolvedLinks: string[] = [];
				if (cache?.links) {
					for (const link of cache.links) {
						const resolvedFile = app.metadataCache.getFirstLinkpathDest(
							link.link,
							file.path
						);
						if (!resolvedFile) {
							unresolvedLinks.push(link.link);
						}
					}
				}

				// Get tags
				const tags: string[] = [];
				if (cache?.tags) {
					for (const tag of cache.tags) {
						tags.push(tag.tag);
					}
				}
				// Also check frontmatter tags
				if (cache?.frontmatter?.tags) {
					const fmTags: unknown = cache.frontmatter.tags;
					if (Array.isArray(fmTags)) {
						for (const tag of fmTags) {
							if (typeof tag === "string" && !tags.includes(`#${tag}`)) {
								tags.push(`#${tag}`);
							}
						}
					}
				}

				return Promise.resolve({
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									path,
									inLinks,
									outLinks: outLinks + embedLinks,
									unresolvedLinks: unresolvedLinks.length,
									unresolvedLinksList: unresolvedLinks,
									tags,
								},
								null,
								2
							),
						},
					],
				});
			} catch (error) {
				return Promise.resolve({
					content: [
						{ type: "text", text: error instanceof Error ? error.message : String(error) },
					],
					isError: true,
				});
			}
		}
	);

	// graph_links - Get backlinks and forward links
	registerTool(
		{
			name: "graph_links",
			description: "Get backlinks and forward links for a note",
			inputSchema: {
				type: "object",
				properties: {
					path: { type: "string", description: "Note path" },
				},
				required: ["path"],
			},
		},
		(args): Promise<ToolResult> => {
			try {
				const path = security.validateRead(args.path as string);

				const file = app.vault.getAbstractFileByPath(path);
				if (!file || !(file instanceof TFile)) {
					return Promise.resolve({
						content: [{ type: "text", text: `File not found: ${path}` }],
						isError: true,
					});
				}

				const cache = app.metadataCache.getFileCache(file);

				// Get forward links (links from this file)
				const forwardLinks: string[] = [];
				if (cache?.links) {
					for (const link of cache.links) {
						const resolvedFile = app.metadataCache.getFirstLinkpathDest(
							link.link,
							file.path
						);
						if (resolvedFile && security.isAccessible(resolvedFile.path)) {
							forwardLinks.push(resolvedFile.path);
						}
					}
				}
				if (cache?.embeds) {
					for (const embed of cache.embeds) {
						const resolvedFile = app.metadataCache.getFirstLinkpathDest(
							embed.link,
							file.path
						);
						if (resolvedFile && security.isAccessible(resolvedFile.path)) {
							if (!forwardLinks.includes(resolvedFile.path)) {
								forwardLinks.push(resolvedFile.path);
							}
						}
					}
				}

				// Get backlinks (files that link to this one)
				const metadataCacheExt = getMetadataCacheWithBacklinks(app);
				const backlinksData = metadataCacheExt.getBacklinksForFile(file);
				const backlinks: string[] = [];
				if (backlinksData) {
					for (const [sourcePath] of backlinksData.data) {
						if (security.isAccessible(sourcePath)) {
							backlinks.push(sourcePath);
						}
					}
				}

				return Promise.resolve({
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									path,
									backlinks: backlinks.sort(),
									forwardLinks: forwardLinks.sort(),
								},
								null,
								2
							),
						},
					],
				});
			} catch (error) {
				return Promise.resolve({
					content: [
						{ type: "text", text: error instanceof Error ? error.message : String(error) },
					],
					isError: true,
				});
			}
		}
	);
}
