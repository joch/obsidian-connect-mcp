# Prompts Folder Support for Obsidian Dataview MCP

## Status: Complete

## Summary

Added a configurable prompts folder to the Obsidian plugin. Notes in this folder become MCP prompts that agents can discover and use.

## Implementation Details

### Plugin Settings (`src/settings.ts`)
- Added `promptsFolder` setting (default: `prompts`)
- Added UI in settings tab with help section explaining prompts usage
- Updated API endpoints list to include prompts endpoints

### Plugin HTTP API (`src/prompts-handler.ts`)
- Added `GET /prompts` - lists available prompts (name + description from frontmatter)
- Added `GET /prompts/:name` - returns full prompt content

### MCP Server (`mcp-server/src/index.ts`)
- Added `prompts` capability
- Registered `ListPromptsRequestSchema` handler
- Registered `GetPromptRequestSchema` handler

### MCP Client (`mcp-server/src/client.ts`)
- Added `listPrompts()` method
- Added `getPrompt(name)` method

## Prompt Note Format

```markdown
---
description: Short description shown in prompt list
---

Your prompt content here with DQL examples, instructions, etc.
```

- Filename (without .md) = prompt name
- `description` frontmatter = shown in list (optional)
- Full content = returned as prompt text

## Files Modified
- `src/settings.ts` - added promptsFolder setting + help UI
- `src/prompts-handler.ts` - new file for /prompts endpoints
- `src/main.ts` - register prompts routes
- `mcp-server/src/index.ts` - add prompts capability and handlers
- `mcp-server/src/client.ts` - add listPrompts/getPrompt methods

## Verification Steps

1. Create `prompts/gtd.md` in vault with description frontmatter:
   ```markdown
   ---
   description: Get Things Done workflow queries
   ---

   Use these DQL queries for GTD workflow...
   ```

2. Test HTTP endpoints:
   ```bash
   # List prompts
   curl -H "Authorization: Bearer YOUR_API_KEY" http://localhost:27124/prompts

   # Get specific prompt
   curl -H "Authorization: Bearer YOUR_API_KEY" http://localhost:27124/prompts/gtd
   ```

3. Restart MCP server and verify agent can list and get prompts via MCP protocol
