# Connect MCP

An Obsidian plugin that runs an MCP (Model Context Protocol) server, enabling AI agents like Claude to access your vault - read, edit, search notes, and run Dataview queries.

## Architecture

```
AI Agent (Claude Code/Desktop)
    ↓ (via mcp-remote bridge)
Obsidian Plugin (Express + MCP Server on port 27124)
    ↓
Obsidian Vault
```

The MCP server runs directly inside the Obsidian plugin - no separate server process needed.

## Prerequisites

- [Obsidian](https://obsidian.md/) desktop app
- [Dataview plugin](https://github.com/blacksmithgu/obsidian-dataview) installed in Obsidian (optional, for DQL queries)
- Node.js 18+

## Installation

### Option A: Install via BRAT (Recommended)

1. Install the [BRAT plugin](https://github.com/TfTHacker/obsidian42-brat) from Community Plugins
2. Open BRAT settings and click "Add Beta Plugin"
3. Enter: `joch/obsidian-connect-mcp`
4. Enable "Connect MCP" in Community Plugins

### Option B: Manual Installation

1. Build the plugin:
   ```bash
   npm install
   npm run build
   ```

2. Copy the plugin files to your Obsidian vault:
   ```bash
   mkdir -p /path/to/vault/.obsidian/plugins/obsidian-connect-mcp
   cp main.js manifest.json styles.css /path/to/vault/.obsidian/plugins/obsidian-connect-mcp/
   ```

3. In Obsidian, go to Settings → Community plugins → Enable "Connect MCP"

4. Configure the plugin:
   - Go to Settings → Connect MCP
   - Click "Generate" to create an **API Key**
   - Optionally change the port (default: 27124)
   - Click "Start Server" or enable auto-start

### 2. Configure Claude Code/Desktop

Add this to your Claude Code MCP settings:

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "http://localhost:27124/mcp",
        "--header",
        "Authorization:${AUTH}"
      ],
      "env": {
        "AUTH": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

Replace `YOUR_API_KEY` with the key generated in Obsidian settings.

## Available MCP Tools

### Vault Tools
| Tool | Description |
|------|-------------|
| `vault_list` | List files and folders in the vault |
| `vault_read` | Read a note's content and frontmatter |
| `vault_create` | Create a new note |
| `vault_update` | Replace entire file content |
| `vault_delete` | Delete a note (moves to trash) |
| `vault_search` | Search notes by content |

### Edit Tools
| Tool | Description |
|------|-------------|
| `vault_edit` | Find and replace text using fuzzy matching |
| `vault_edit_line` | Insert or replace content at a specific line |
| `vault_patch` | Edit a specific section: heading, block, or frontmatter |

### Graph Tools
| Tool | Description |
|------|-------------|
| `graph_info` | Get link statistics for a note |
| `graph_links` | Get backlinks and forward links for a note |

### Dataview Tools
| Tool | Description |
|------|-------------|
| `dataview_query` | Execute a Dataview DQL query |

### Active Tools
| Tool | Description |
|------|-------------|
| `active_note` | Get the currently open note in Obsidian |

## MCP Resources

| URI | Description |
|-----|-------------|
| `obsidian://vault-info` | Vault name, file counts, plugin status |
| `obsidian://dataview-reference` | DQL syntax quick reference |

## MCP Prompts

Prompts let you give AI agents context about your vault that they can discover and use automatically. Create markdown files in the `prompts` folder (configurable in settings) to help agents understand your vault structure, conventions, and useful queries.

### Why Use Prompts?

When an AI agent connects to your vault, it has no idea how you've organized things. Prompts solve this by providing:

- **Vault structure** - Describe your folder hierarchy and what goes where
- **Dataview queries** - Pre-built DQL queries for common searches in your vault
- **Naming conventions** - Explain your file naming patterns and metadata fields
- **Workflows** - Document how you use tags, links, or specific note types

### Prompt Format

```markdown
---
description: Brief description the agent sees when listing prompts
---

# My Vault Guide

## Folder Structure
- `projects/` - Active project notes with status frontmatter
- `archive/` - Completed projects
- `daily/` - Daily notes in YYYY-MM-DD format

## Useful Queries

Find incomplete tasks:
\`\`\`dataview
TASK FROM "projects" WHERE !completed
\`\`\`

Recent notes:
\`\`\`dataview
LIST FROM "" WHERE file.mtime > date(today) - dur(7 days) SORT file.mtime DESC
\`\`\`

## Conventions
- Projects use `status` field: active, waiting, done
- People notes are in `people/` with `birthday` and `company` fields
```

The filename (without `.md`) becomes the prompt name that agents can request.

## Security Features

### API Key Authentication
All requests require a valid API key in the Authorization header.

### Read-Only Mode
Enable in settings to block all write operations (create, update, delete).

### .mcpignore File
Create a `.mcpignore` file in your vault root to block access to sensitive paths:

```
# Block private folders
private/
journal/

# Block specific files
secrets.md
```

Uses gitignore-style patterns.

## Example DQL Queries

```sql
-- List notes with a tag
LIST FROM #project

-- Table of tasks
TABLE file.name, due, status FROM "Tasks" WHERE !completed

-- Notes modified today
LIST FROM "" WHERE file.mday = date(today)

-- Count notes by folder
TABLE length(rows) as Count FROM "" GROUP BY file.folder
```

## Verifying the Setup

```bash
# Health check (no auth required)
curl http://localhost:27124/health

# MCP info
curl http://localhost:27124/mcp
```

## Development

```bash
npm run dev  # Watch mode
```

## License

MIT
