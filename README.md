## ⚠️ PROJECT STATUS: PAUSED

> **Note:** This repository is currently on hold while I explore a new direction for the MCP architecture.

### What's Changing?

I'm evolving this MCP from a simple ServiceNow API wrapper into an **orchestration layer** that coordinates multiple ServiceNow development tools. This new approach may involve:

- Integration with local development tools
- Workflow automation across multiple utilities
- Personal configuration and credentials management

### Why Paused?

During this experimental phase, the repository may contain:
- ⚠️ Local file paths and environment-specific configurations
- ⚠️ Sensitive information not suitable for public sharing
- 🔧 Rapid architectural changes and breaking modifications

I'm taking time to evaluate whether this orchestrated approach is:
1. Stable enough for public use
2. Generalizable beyond my specific setup
3. Properly secured for public distribution

### Repository Status

✅ **This code remains available** as a starting point for building your own ServiceNow MCP server  
✅ The existing API wrapper functionality is stable and usable  
❌ Active development and documentation updates are paused  

### Timeline

I'll reassess this direction in the coming weeks. Possible outcomes:
- 🔄 Resume with the new orchestration architecture (if generalizable)
- 🔀 Split into separate repos (public MCP + private orchestrator)
- ⏮️ Revert to the original focused API wrapper approach

---

**Questions?** Feel free to fork this repo and adapt it for your needs! The existing codebase provides a solid foundation for ServiceNow MCP development.

---

# ServiceNow MCP Server

Model Context Protocol (MCP) server for ServiceNow integration with Claude Code.

## Features

- Full CRUD operations on any ServiceNow table
- Specialized incident management
- Story management (rm_story) with build notes support
- UI Action creation and management
- Business Rules management
- Table schema exploration
- Direct ServiceNow REST API integration

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure credentials in `.env`:
```
SERVICENOW_INSTANCE=https://your-instance.service-now.com/
SERVICENOW_USERNAME=your-username
SERVICENOW_PASSWORD=your-password
```

3. Test connection:
```bash
npm test
```

4. Add to Claude Code CLI:
```bash
claude mcp add servicenow -- node /Users/<usename>/Documents/Claude/servicenow-mcp-doc/server.js
```

Note: The `--` separator is required before the command.

## Available Tools

### General Table Operations
- `get_records` - Query any table
- `get_record` - Get single record by sys_id
- `create_record` - Create new records
- `update_record` - Update existing records
- `delete_record` - Delete records

### Incident Management
- `get_incidents` - Query incidents with filters
- `create_incident` - Create new incidents
- `update_incident` - Update incident state, assignment, etc.

### UI Actions
- `get_ui_actions` - List UI Actions (filterable by table)
- `get_ui_action` - Get specific UI Action details
- `create_ui_action` - Create new UI Action
- `update_ui_action` - Modify existing UI Action

### Business Rules
- `get_business_rules` - List Business Rules
- `create_business_rule` - Create new Business Rule

### Story Management
- `get_stories` - Query stories (rm_story) with filters
- `get_story` - Get specific story by sys_id or story number (e.g., STRY0001234)
- `update_story_build_notes` - Update the u_build_notes HTML field for documentation

### Schema Discovery
- `get_tables` - List available tables
- `get_table_schema` - Get table structure

## Usage with Claude Code

Once installed, you can ask Claude:

- "Show me all UI Actions on the incident table"
- "Create a new UI Action that sends an email notification"
- "List all open incidents assigned to my group"
- "Create an incident for the database timeout issue"
- "What tables are available in my ServiceNow instance?"
- "Get story STRY0010001 and show me the details"
- "List all active stories in progress"
- "Update the build notes for story STRY0010001 with implementation details"

## Security

- Never commit `.env` file to version control
- Use service accounts with appropriate permissions
- Consider OAuth 2.0 for production use

## Disclaimer

**This is NOT an official ServiceNow application.**

This tool is an independent, community-developed project and is:

❌ NOT developed by ServiceNow, Inc.
❌ NOT endorsed or supported by ServiceNow, Inc.
❌ NOT covered by any ServiceNow support agreements or warranties

ServiceNow, Inc. holds no liability or accountability for:

- The functionality, reliability, or security of this application
- Any data generated, modified, or deleted through use of this tool
- Any issues, damages, or losses resulting from use of this application
- Any support, maintenance, or updates to this software

This tool interacts with ServiceNow instances using publicly available APIs and the Model Context Protocol (MCP). Users are solely responsible for:

- Ensuring compliance with their organization's ServiceNow usage policies
- Proper configuration and security of service accounts
- Any data created or modified in their ServiceNow instances
- Following ServiceNow's terms of service and acceptable use policies

**Use at your own risk. Always test thoroughly in non-production environments.**
