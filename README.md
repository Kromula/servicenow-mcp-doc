# ServiceNow MCP Server

Model Context Protocol (MCP) server for ServiceNow integration with Claude Code.

## Features

- Full CRUD operations on any ServiceNow table
- Specialized incident management
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

4. Add to Claude Code:
```bash
claude mcp add --transport stdio servicenow --scope user -- node "/path/to/servicenow-mcp/server.js"
```

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
