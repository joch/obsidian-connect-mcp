import { App } from "obsidian";
import { isDataviewEnabled } from "./obsidian-internals";

interface ResourceDefinition {
	uri: string;
	name: string;
	description: string;
	mimeType: string;
}

interface ResourceHandler {
	(): Promise<string>;
}

/**
 * Register MCP resources
 */
export function registerResources(
	app: App,
	pluginVersion: string,
	registerResource: (definition: ResourceDefinition, handler: ResourceHandler) => void
): void {
	// vault-info resource
	registerResource(
		{
			uri: "obsidian://vault-info",
			name: "Vault Information",
			description: "Current vault status and metadata",
			mimeType: "application/json",
		},
		(): Promise<string> => {
			const files = app.vault.getMarkdownFiles();
			const allFiles = app.vault.getFiles();

			// Count folders
			const folders = new Set<string>();
			for (const file of allFiles) {
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

			// Check for Dataview
			const dataviewEnabled = isDataviewEnabled(app);

			return Promise.resolve(JSON.stringify(
				{
					vault: app.vault.getName(),
					plugin: "obsidian-connect-mcp",
					version: pluginVersion,
					stats: {
						markdownFiles: files.length,
						totalFiles: allFiles.length,
						folders: folders.size,
					},
					dataviewEnabled,
				},
				null,
				2
			));
		}
	);

	// dataview-reference resource
	registerResource(
		{
			uri: "obsidian://dataview-reference",
			name: "Dataview DQL Reference",
			description: "Quick reference for Dataview Query Language syntax",
			mimeType: "text/markdown",
		},
		(): Promise<string> => {
			const dataviewEnabled = isDataviewEnabled(app);

			if (!dataviewEnabled) {
				return Promise.resolve(`# Dataview Not Installed

The Dataview plugin is not installed or enabled in this vault.

To use DQL queries:
1. Install the Dataview plugin from Obsidian's Community Plugins
2. Enable the plugin in Settings > Community Plugins
3. Restart the MCP server

Once installed, you can use the \`dataview_query\` tool to run DQL queries.`);
			}

			return Promise.resolve(`# Dataview Query Language (DQL) Reference

## Query Types

### LIST
List notes matching criteria.
\`\`\`dql
LIST
FROM "folder"
WHERE field = value
SORT file.name ASC
LIMIT 10
\`\`\`

### TABLE
Display notes as a table with columns.
\`\`\`dql
TABLE file.ctime AS "Created", field1, field2
FROM "folder"
WHERE condition
SORT field DESC
\`\`\`

### TASK
List tasks from notes.
\`\`\`dql
TASK
FROM "folder"
WHERE !completed
\`\`\`

### CALENDAR
Display notes on a calendar (date field required).
\`\`\`dql
CALENDAR file.ctime
FROM "folder"
\`\`\`

## FROM Clauses

- \`FROM "folder"\` - Notes in folder
- \`FROM #tag\` - Notes with tag
- \`FROM [[note]]\` - Notes linking to note
- \`FROM outgoing([[note]])\` - Notes linked from note

## WHERE Operators

- \`=\`, \`!=\`, \`<\`, \`>\`, \`<=\`, \`>=\`
- \`contains(field, "text")\`
- \`startswith(field, "prefix")\`
- \`endswith(field, "suffix")\`
- \`AND\`, \`OR\`, \`!\` (NOT)

## Built-in Fields

- \`file.name\` - Filename without extension
- \`file.path\` - Full path
- \`file.folder\` - Parent folder
- \`file.ctime\` - Creation time
- \`file.mtime\` - Modification time
- \`file.size\` - File size in bytes
- \`file.tags\` - Array of tags
- \`file.outlinks\` - Outgoing links
- \`file.inlinks\` - Incoming links (backlinks)

## Functions

- \`date(today)\` - Current date
- \`date(now)\` - Current datetime
- \`duration("1 day")\` - Duration
- \`length(array)\` - Array length
- \`sum(array)\` - Sum of numbers
- \`min(array)\`, \`max(array)\`
- \`choice(condition, ifTrue, ifFalse)\`

## Examples

List recently modified notes:
\`\`\`dql
LIST
WHERE file.mtime > date(today) - dur(7 days)
SORT file.mtime DESC
LIMIT 20
\`\`\`

Table of projects with status:
\`\`\`dql
TABLE status, due-date, priority
FROM "Projects"
WHERE status != "completed"
SORT priority DESC
\`\`\`

Incomplete tasks from this week:
\`\`\`dql
TASK
FROM "Tasks"
WHERE !completed AND file.ctime > date(today) - dur(7 days)
\`\`\`
`);
		}
	);
}
