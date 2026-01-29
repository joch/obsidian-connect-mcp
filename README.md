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

Create markdown files in the `prompts` folder (configurable in settings) to expose them as MCP prompts:

```markdown
---
description: Short description shown in prompt list
---

Your prompt content here with DQL examples, instructions, etc.
```

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
