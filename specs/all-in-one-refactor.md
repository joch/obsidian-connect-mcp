# All-in-One MCP Server Refactor

## Status: Complete

## Summary

Refactored the Obsidian Dataview MCP plugin from a two-process architecture (plugin + separate MCP server) to an all-in-one architecture where the MCP server runs inside the Obsidian plugin. Added security features, MCP resources, and improved editing tools.

## Implementation Details

### Architecture Change
- **Before**: Plugin exposed HTTP API → separate MCP server process → AI agent
- **After**: Plugin runs MCP server directly (Express + MCP SDK) → AI agent via mcp-remote

### New Files Created
- `src/mcp-server.ts` - Express server with MCP protocol handling
- `src/security/security-manager.ts` - Path validation, read-only mode
- `src/security/mcp-ignore.ts` - .mcpignore file parsing
- `src/tools/vault-tools.ts` - vault_list, vault_read, vault_create, vault_update, vault_delete, vault_search
- `src/tools/edit-tools.ts` - vault_edit, vault_edit_line, vault_patch
- `src/tools/graph-tools.ts` - graph_info, graph_links
- `src/tools/dataview-tools.ts` - dataview_query
- `src/tools/active-tools.ts` - active_note
- `src/resources.ts` - vault-info, dataview-reference resources
- `src/prompts.ts` - prompts folder handling
- `src/utils/fuzzy-match.ts` - Levenshtein distance for fuzzy editing

### Modified Files
- `src/main.ts` - Uses new MCP server, registers all capabilities
- `src/settings.ts` - Added Generate API key button, read-only toggle
- `package.json` - Added @modelcontextprotocol/sdk, express, cors
- `esbuild.config.mjs` - Added node: prefix externals for Express 5
- `README.md` - Updated with new architecture and setup instructions

### Deleted Files
- `mcp-server/` - entire directory (no longer needed)
- `src/dataview-handler.ts` - replaced by tools
- `src/file-handler.ts` - replaced by tools
- `src/prompts-handler.ts` - replaced by prompts.ts
- `src/server.ts` - replaced by mcp-server.ts

## MCP Capabilities

### Tools (13 total)
| Tool | Description | Read-only safe |
|------|-------------|----------------|
| vault_list | List files/folders | ✓ |
| vault_read | Read note with frontmatter | ✓ |
| vault_create | Create new note | ✗ |
| vault_update | Replace file content | ✗ |
| vault_edit | Fuzzy find/replace | ✗ |
| vault_edit_line | Line-based insert/replace | ✗ |
| vault_patch | Edit heading/block/frontmatter | ✗ |
| vault_delete | Delete note (trash) | ✗ |
| vault_search | Search by content | ✓ |
| graph_info | Link statistics | ✓ |
| graph_links | Backlinks and forward links | ✓ |
| dataview_query | Execute DQL | ✓ |
| active_note | Get currently open note | ✓ |

### Resources (2 total)
| URI | Description |
|-----|-------------|
| obsidian://vault-info | Vault metadata and stats |
| obsidian://dataview-reference | DQL syntax guide |

### Prompts
- Loaded from configurable promptsFolder
- Filename = prompt name
- Description from frontmatter

## Security Features
1. **API Key Auth** - Required for all requests except /health
2. **Generate Button** - Easy API key creation in settings
3. **Read-Only Mode** - Blocks all write operations
4. **.mcpignore** - Gitignore-style patterns to block paths

## Client Configuration

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "npx",
      "args": ["mcp-remote", "http://localhost:27124/mcp"],
      "env": {
        "AUTH": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

## Verification
1. `npm run build` - Compiles successfully
2. Install in Obsidian, enable plugin
3. Generate API key in settings
4. `curl http://localhost:27124/health` - Returns OK
5. Configure Claude Code with mcp-remote
6. Test tools via Claude Code
