# All-in-One MCP Server Refactor

## Summary

Refactor the Obsidian Dataview MCP plugin from a two-process architecture (plugin + separate MCP server) to an all-in-one architecture where the MCP server runs inside the Obsidian plugin. Add security features, MCP resources, and improved editing tools.

## Architecture

### Current (being replaced)
```
Claude Code/Desktop
    ↓
mcp-server/ (separate Node.js process)
    ↓ HTTP calls
Obsidian Plugin (HTTP API on port 27124)
    ↓
Obsidian Vault
```

### New
```
Claude Code/Desktop
    ↓ (via mcp-remote npx bridge)
Obsidian Plugin (Express + MCP Server on port 27124)
    ↓
Obsidian Vault
```

Client configuration for Claude Code:
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

## MCP Capabilities

### Tools

| Tool | Description | Read-only safe |
|------|-------------|----------------|
| `vault_list` | List files/folders, optionally filtered by path | ✓ |
| `vault_read` | Read note content with frontmatter | ✓ |
| `vault_create` | Create new note | ✗ |
| `vault_update` | Replace entire file content | ✗ |
| `vault_edit` | Fuzzy find/replace text | ✗ |
| `vault_edit_line` | Insert/replace at line number | ✗ |
| `vault_patch` | Edit heading, block, or frontmatter | ✗ |
| `vault_delete` | Delete note (moves to trash) | ✗ |
| `vault_search` | Search notes by content | ✓ |
| `graph_info` | Get link statistics for a note | ✓ |
| `graph_links` | Get backlinks and forward links | ✓ |
| `dataview_query` | Execute DQL query | ✓ |
| `active_note` | Get currently open note | ✓ |

### Resources

| URI | Description |
|-----|-------------|
| `obsidian://vault-info` | Vault name, path, file counts, plugin version |
| `obsidian://dataview-reference` | DQL syntax guide (if Dataview installed) |

### Prompts

- Loaded from configured `promptsFolder`
- Filename (without .md) = prompt name
- `description` frontmatter = shown in list
- Full content = prompt text

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `port` | 27124 | Server port |
| `apiKey` | "" | Auth key (with Generate button) |
| `autoStart` | true | Start on plugin load |
| `readOnlyMode` | false | Block all write operations |
| `promptsFolder` | "prompts" | Folder for MCP prompts |

## Security Features

1. **API Key Auth** - Bearer token required for all requests except /health
2. **Read-Only Mode** - Single toggle that blocks create/update/delete operations
3. **.mcpignore file** - Gitignore-style patterns in vault root to block paths

## File Structure

### Delete
- `mcp-server/` - entire directory

### Create
- `src/mcp-server.ts` - MCP protocol handling, Express setup
- `src/security/security-manager.ts` - path validation, permissions
- `src/security/mcp-ignore.ts` - .mcpignore file support
- `src/tools/vault-tools.ts` - vault_list, vault_read, vault_create, vault_update, vault_delete, vault_search
- `src/tools/edit-tools.ts` - vault_edit, vault_edit_line, vault_patch
- `src/tools/graph-tools.ts` - graph_info, graph_links
- `src/tools/dataview-tools.ts` - dataview_query
- `src/tools/active-tools.ts` - active_note
- `src/resources.ts` - vault-info, dataview-reference
- `src/prompts.ts` - prompt loading from folder
- `src/utils/fuzzy-match.ts` - Levenshtein distance matching

### Modify
- `src/main.ts` - start MCP server instead of HTTP server
- `src/settings.ts` - new settings, Generate API key button
- `package.json` - add dependencies

### Keep (adapt as needed)
- `src/server.ts` - may be replaced or merged into mcp-server.ts

## Dependencies

Add to package.json:
```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.25.0",
    "express": "^5.0.0",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/cors": "^2.8.0"
  }
}
```

## Implementation Steps

### Phase 1: Core Infrastructure
1. Add dependencies to package.json
2. Create `src/mcp-server.ts` with Express + MCP SDK setup
3. Create `src/security/security-manager.ts` with read-only mode support
4. Create `src/security/mcp-ignore.ts` for .mcpignore parsing
5. Update `src/settings.ts` with new settings and Generate button
6. Update `src/main.ts` to start MCP server

### Phase 2: Vault Tools
7. Create `src/tools/vault-tools.ts`:
   - `vault_list` - list files/folders
   - `vault_read` - read note with frontmatter
   - `vault_create` - create note
   - `vault_update` - replace file content
   - `vault_delete` - delete note
   - `vault_search` - search by content

### Phase 3: Edit Tools
8. Create `src/utils/fuzzy-match.ts` - Levenshtein distance matching
9. Create `src/tools/edit-tools.ts`:
   - `vault_edit` - fuzzy find/replace
   - `vault_edit_line` - line-based insert/replace
   - `vault_patch` - heading/block/frontmatter editing

### Phase 4: Graph & Dataview Tools
10. Create `src/tools/graph-tools.ts`:
    - `graph_info` - link statistics
    - `graph_links` - backlinks and forward links
11. Create `src/tools/dataview-tools.ts`:
    - `dataview_query` - execute DQL
12. Create `src/tools/active-tools.ts`:
    - `active_note` - get currently open note

### Phase 5: Resources & Prompts
13. Create `src/resources.ts`:
    - `obsidian://vault-info`
    - `obsidian://dataview-reference`
14. Create `src/prompts.ts` - load prompts from folder

### Phase 6: Cleanup
15. Delete `mcp-server/` directory
16. Update README with new setup instructions
17. Test end-to-end with Claude Code

## Tool Specifications

### vault_list
```typescript
{
  name: "vault_list",
  description: "List files and folders in the vault",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Folder path (default: root)" }
    }
  }
}
```

### vault_read
```typescript
{
  name: "vault_read",
  description: "Read a note's content and frontmatter",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Note path" }
    },
    required: ["path"]
  }
}
```

### vault_create
```typescript
{
  name: "vault_create",
  description: "Create a new note",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Note path" },
      content: { type: "string", description: "Note content" }
    },
    required: ["path", "content"]
  }
}
```

### vault_update
```typescript
{
  name: "vault_update",
  description: "Replace entire file content",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Note path" },
      content: { type: "string", description: "New content" }
    },
    required: ["path", "content"]
  }
}
```

### vault_edit
```typescript
{
  name: "vault_edit",
  description: "Find and replace text using fuzzy matching",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Note path" },
      oldText: { type: "string", description: "Text to find (fuzzy matched)" },
      newText: { type: "string", description: "Replacement text" },
      fuzzyThreshold: { type: "number", description: "Match threshold 0-1 (default: 0.7)" }
    },
    required: ["path", "oldText", "newText"]
  }
}
```

### vault_edit_line
```typescript
{
  name: "vault_edit_line",
  description: "Insert or replace content at a specific line",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Note path" },
      lineNumber: { type: "number", description: "Line number (1-based)" },
      content: { type: "string", description: "Content to insert/replace" },
      mode: { type: "string", enum: ["before", "after", "replace"], description: "Insert mode (default: replace)" }
    },
    required: ["path", "lineNumber", "content"]
  }
}
```

### vault_patch
```typescript
{
  name: "vault_patch",
  description: "Edit a specific section: heading, block, or frontmatter field",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Note path" },
      targetType: { type: "string", enum: ["heading", "block", "frontmatter"], description: "What to target" },
      target: { type: "string", description: "Target identifier (heading path like 'Section::Subsection', block ID, or frontmatter field)" },
      operation: { type: "string", enum: ["append", "prepend", "replace"], description: "How to modify" },
      content: { type: "string", description: "Content to add/replace" }
    },
    required: ["path", "targetType", "target", "operation", "content"]
  }
}
```

### vault_delete
```typescript
{
  name: "vault_delete",
  description: "Delete a note (moves to trash)",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Note path" }
    },
    required: ["path"]
  }
}
```

### vault_search
```typescript
{
  name: "vault_search",
  description: "Search notes by content",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query" },
      path: { type: "string", description: "Limit to folder (optional)" }
    },
    required: ["query"]
  }
}
```

### graph_info
```typescript
{
  name: "graph_info",
  description: "Get link statistics for a note",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Note path" }
    },
    required: ["path"]
  }
}
// Returns: { inLinks: number, outLinks: number, unresolvedLinks: number, tags: string[] }
```

### graph_links
```typescript
{
  name: "graph_links",
  description: "Get backlinks and forward links for a note",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Note path" }
    },
    required: ["path"]
  }
}
// Returns: { backlinks: string[], forwardLinks: string[] }
```

### dataview_query
```typescript
{
  name: "dataview_query",
  description: "Execute a Dataview DQL query",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "DQL query (LIST, TABLE, TASK, CALENDAR)" }
    },
    required: ["query"]
  }
}
```

### active_note
```typescript
{
  name: "active_note",
  description: "Get the currently open note in Obsidian",
  inputSchema: {
    type: "object",
    properties: {}
  }
}
// Returns: { path: string, content: string, frontmatter: object } or null
```

## Verification

1. Build plugin: `npm run build`
2. Install in Obsidian test vault
3. Configure API key in settings
4. Test with curl:
   ```bash
   # Health check
   curl http://localhost:27124/health

   # MCP info
   curl http://localhost:27124/mcp
   ```
5. Configure Claude Code with mcp-remote
6. Test all tools via Claude Code
7. Test read-only mode blocks writes
8. Test .mcpignore blocks paths
