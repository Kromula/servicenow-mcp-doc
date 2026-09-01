# ServiceNow MCP Orchestrator

**Unified Model Context Protocol (MCP) server that orchestrates all your ServiceNow development tools.**

## Features

### 🎯 Tool Orchestration
- **Script Checker** - Validate scripts against best practices
- **Data Loader** - Generate realistic test data
- **UX Analyzer** - Automated accessibility and UX analysis
- **Taxonomy Helper** - AI-powered taxonomy recommendations

### 🔌 Direct API Access
- Full CRUD operations on any ServiceNow table
- Specialized incident, story, and change management
- UI Action creation and management
- Business Rules management
- Table schema exploration
- Direct ServiceNow REST API integration

### 🏢 Multi-Instance Support
- Switch between multiple ServiceNow instances
- Separate credentials per instance
- Configured via environment variables

## Quick Start

### 1. Install Dependencies
```bash
cd "C:\Coding Projects\servicenow-mcp-doc"
npm install
```

### 2. Configure Instances

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Edit `.env` with your ServiceNow credentials:
```env
# Instance 1
MY_INSTANCE_URL=your-instance
MY_INSTANCE_USERNAME=admin
MY_INSTANCE_PASSWORD=your_password

# Instance 2
FORVIS_INSTANCE_URL=forvis-dev
FORVIS_INSTANCE_USERNAME=admin
FORVIS_INSTANCE_PASSWORD=your_password
```

### 3. Test Setup
```bash
npm run test:orchestrator
```

### 4. Add to Claude Code

Add to `~/.claude.json` or `C:\Users\YOUR_USERNAME\.claude.json`:
```json
{
  "mcpServers": {
    "servicenow-orchestrator": {
      "command": "node",
      "args": ["C:\\Coding Projects\\servicenow-mcp-doc\\server.js"],
      "env": {}
    }
  }
}
```

**Windows**: Use double backslashes (`\\`) in paths.

### 5. Restart Claude Code

That's it! Claude now has access to all your ServiceNow tools.

## 📖 Full Documentation

See [ORCHESTRATOR-GUIDE.md](./ORCHESTRATOR-GUIDE.md) for complete setup and usage instructions.

## Available Tools

### 🛠️ Orchestrator Tools

#### Script Validation
- `validate_scripts` - Check scripts for best practice violations
  ```
  instance: my-instance | forvis-mazar-dev
  script_type: business_rule | client_script | ui_action | script_include | all
  limit: number
  custom_only: boolean
  ```

#### Test Data Generation
- `load_test_data` - Generate realistic ServiceNow records
  ```
  instance: my-instance | forvis-mazar-dev
  record_type: incident | change | problem | major-incident | story
  count: number
  ```

#### UX Analysis
- `analyze_ux` - Automated UX/accessibility testing
  ```
  instance: my-instance | forvis-mazar-dev
  analysis_type: general | esc | portal | workspace
  ```

#### Taxonomy Analysis
- `analyze_taxonomy` - AI-powered taxonomy recommendations
  ```
  instance: my-instance | forvis-mazar-dev
  ```

### 📊 General Table Operations
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

## Usage Examples

### Orchestrator Commands
- "Validate all business rules on my-instance"
- "Generate 25 test incidents on forvis-mazar-dev"
- "Analyze the Employee Service Center UX"
- "Check my custom client scripts for violations"
- "Review taxonomy on forvis-mazar-dev and suggest improvements"

### API Commands
- "Show me all UI Actions on the incident table"
- "List all open incidents assigned to my group"
- "Create an incident for the database timeout issue"
- "Get story STRY0010001 and show me the details"
- "Update the build notes for story STRY0010001 with implementation details"

### Combined Workflows
- "Validate scripts on my-instance, then create incidents for each violation"
- "Generate 10 test changes, then analyze the UX of the change form"
- "Get the latest story and append today's UX analysis to build notes"

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
