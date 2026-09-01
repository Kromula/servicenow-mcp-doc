# ServiceNow MCP Orchestrator Guide

## Overview

The ServiceNow MCP Orchestrator consolidates all your ServiceNow development tools into a single MCP server that Claude can use. This gives Claude access to:

1. **Script Checker** - Validate scripts against best practices
2. **Data Loader** - Generate realistic test data
3. **UX Analyzer** - Automated accessibility and UX analysis
4. **Taxonomy Helper** - AI-powered taxonomy recommendations
5. **ServiceNow API** - Direct table/record operations

## Setup

### 1. Install Dependencies

```bash
cd "C:\Coding Projects\servicenow-mcp-doc"
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and configure your instances:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Primary Instance
MY_INSTANCE_URL=your-instance
MY_INSTANCE_USERNAME=your_username
MY_INSTANCE_PASSWORD=your_password

# Forvis Mazar Dev Instance
FORVIS_INSTANCE_URL=forvis-dev-instance
FORVIS_INSTANCE_USERNAME=your_username
FORVIS_INSTANCE_PASSWORD=your_password
```

### 3. Add to Claude Code Configuration

Add this server to your `~/.claude.json` or `C:\Users\YOUR_USERNAME\.claude.json`:

```json
{
  "mcpServers": {
    "servicenow-orchestrator": {
      "command": "node",
      "args": ["C:\Coding Projects\servicenow-mcp-doc\server.js"],
      "env": {}
    }
  }
}
```

**Windows users**: Make sure to escape backslashes with double backslashes (\\).

### 4. Restart Claude Code

Restart Claude Code to load the new MCP server.

## Available Tools

### Script Validation
```
validate_scripts
  - instance: my-instance | forvis-mazar-dev
  - script_type: business_rule | client_script | ui_action | script_include | all
  - limit: number (default: 50)
  - custom_only: boolean (default: false)
```

**Example:**
> "Check all business rules on my-instance for best practice violations"

### Test Data Loading
```
load_test_data
  - instance: my-instance | forvis-mazar-dev
  - record_type: incident | change | problem | major-incident | story
  - count: number (default: 10)
```

**Example:**
> "Generate 25 test incidents on forvis-mazar-dev"

### UX Analysis
```
analyze_ux
  - instance: my-instance | forvis-mazar-dev
  - analysis_type: general | esc | portal | workspace
```

**Example:**
> "Analyze the Employee Service Center UX on my-instance"

### Taxonomy Analysis
```
analyze_taxonomy
  - instance: my-instance | forvis-mazar-dev
```

**Example:**
> "Analyze the taxonomy structure on forvis-mazar-dev and suggest improvements"

### ServiceNow API Tools

All the standard API tools are still available:
- `get_records` - Query any table
- `create_record` - Create records
- `update_record` - Update records
- `get_incidents` / `create_incident` / `update_incident`
- `get_ui_actions` / `create_ui_action` / `update_ui_action`
- `get_business_rules` / `create_business_rule`
- `get_stories` / `get_story` / `update_story_build_notes`
- And more...

## Testing

### Quick Test

1. Start Claude Code
2. Try a simple command:
```
Get the last 5 incidents from my-instance
```

3. Try an orchestrator tool:
```
Validate scripts on my-instance
```

## Instance Management

### Adding New Instances

To add a new instance:

1. **Update `.env` file**:
```env
NEW_INSTANCE_URL=new-instance
NEW_INSTANCE_USERNAME=admin
NEW_INSTANCE_PASSWORD=password
```

2. **Update `server.js` - `_getInstanceEnv()` method** around line 180:
```javascript
const instanceMap = {
  "my-instance": { ... },
  "forvis-mazar-dev": { ... },
  "new-instance": {
    SERVICENOW_INSTANCE: process.env.NEW_INSTANCE_URL,
    SERVICENOW_USERNAME: process.env.NEW_INSTANCE_USERNAME,
    SERVICENOW_PASSWORD: process.env.NEW_INSTANCE_PASSWORD,
  },
};
```

3. **Update tool schemas** - Add "new-instance" to the enum arrays in tool definitions (around lines 695-760).

## Troubleshooting

### Error: "Unknown instance: X"
- Check instance name is lowercase and matches `.env` variable prefix
- Verify instance defined in `_getInstanceEnv()` method in server.js
- Confirm credentials are set in `.env`

### Error: "Missing credentials for instance: X"
- Check `.env` file exists and has all required variables
- Ensure variable names match: `{PREFIX}_INSTANCE_URL/USERNAME/PASSWORD`
- Restart Claude Code after updating `.env`

### Tool Timeout
- Some operations can take 5-10 minutes
- Check logs in respective tool directories
- Increase timeout in server.js if needed

### CLI Tool Not Found
- Verify all tool directories exist in `C:\Coding Projects\`
- Check paths in `ToolOrchestrator` constructor (server.js lines 20-27)
- Run `npm install` in each tool directory

## Architecture

```
C:\Coding Projects/
├── servicenow-mcp-doc/          # Orchestrator (this tool)
│   ├── server.js                # MCP server with orchestration
│   ├── .env                     # Your credentials (not in git)
│   ├── .env.example             # Template
│   └── ORCHESTRATOR-GUIDE.md    # This file
│
├── servicenow-script-checker/   # Script validation
├── servicenow-data-loader/      # Test data generator
├── ServiceNow-UX-Analyzer/      # UX/accessibility analysis
└── servicenow-taxonomy-helper/  # Taxonomy recommendations
```

## Security Notes

- Never commit `.env` to version control
- Use dedicated API accounts with minimum permissions
- Consider ServiceNow OAuth for production
- Enable MFA on ServiceNow accounts

## Version History

- **1.0.0** - Initial orchestrator release
  - Multi-tool integration (4 tools)
  - Multi-instance support
  - Comprehensive error handling
