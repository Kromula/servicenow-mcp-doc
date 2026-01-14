#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import https from "https";
import { URL } from "url";
import dotenv from "dotenv";

dotenv.config();

class ServiceNowClient {
  constructor(instanceUrl, username, password) {
    // Handle both full URLs and instance names
    if (instanceUrl.includes("://")) {
      const url = new URL(instanceUrl);
      this.hostname = url.hostname;
      this.baseUrl = instanceUrl;
    } else {
      this.hostname = `${instanceUrl}.service-now.com`;
      this.baseUrl = `https://${this.hostname}`;
    }

    this.auth = Buffer.from(`${username}:${password}`).toString("base64");
  }

  async request(method, path, body = null, queryParams = {}) {
    return new Promise((resolve, reject) => {
      // Build query string
      const queryString = Object.keys(queryParams).length > 0
        ? "?" + Object.entries(queryParams)
            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
            .join("&")
        : "";

      const options = {
        hostname: this.hostname,
        path: path + queryString,
        method,
        headers: {
          Authorization: `Basic ${this.auth}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      };

      const req = https.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              resolve({ success: true, raw: data });
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on("error", reject);
      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  }

  // Table API operations
  async getRecords(tableName, limit = 10, query = "") {
    const params = { sysparm_limit: limit };
    if (query) params.sysparm_query = query;
    return this.request("GET", `/api/now/table/${tableName}`, null, params);
  }

  async getRecord(tableName, sysId) {
    return this.request("GET", `/api/now/table/${tableName}/${sysId}`);
  }

  async createRecord(tableName, data) {
    return this.request("POST", `/api/now/table/${tableName}`, data);
  }

  async updateRecord(tableName, sysId, data) {
    return this.request("PATCH", `/api/now/table/${tableName}/${sysId}`, data);
  }

  async deleteRecord(tableName, sysId) {
    return this.request("DELETE", `/api/now/table/${tableName}/${sysId}`);
  }

  // Specific operations
  async getIncidents(limit = 10, query = "") {
    return this.getRecords("incident", limit, query);
  }

  async createIncident(data) {
    return this.createRecord("incident", data);
  }

  async updateIncident(sysId, data) {
    return this.updateRecord("incident", sysId, data);
  }

  async getUIActions(tableName = "", limit = 50) {
    const query = tableName ? `table=${tableName}` : "";
    return this.getRecords("sys_ui_action", limit, query);
  }

  async createUIAction(data) {
    return this.createRecord("sys_ui_action", data);
  }

  async updateUIAction(sysId, data) {
    return this.updateRecord("sys_ui_action", sysId, data);
  }

  async getUIAction(sysId) {
    return this.getRecord("sys_ui_action", sysId);
  }

  async getTables(limit = 100) {
    return this.getRecords("sys_db_object", limit);
  }

  async getTableSchema(tableName) {
    const params = { sysparm_query: `name=${tableName}` };
    return this.request("GET", "/api/now/table/sys_db_object", null, params);
  }

  async getBusinessRules(tableName = "", limit = 50) {
    const query = tableName ? `collection=${tableName}` : "";
    return this.getRecords("sys_script", limit, query);
  }

  async createBusinessRule(data) {
    return this.createRecord("sys_script", data);
  }

  async getScriptIncludes(limit = 50) {
    return this.getRecords("sys_script_include", limit);
  }

  async executeScript(script) {
    // Uses the Script Execution API if available on instance
    return this.request("POST", "/api/now/script/execute", { script });
  }

  // Story Management (rm_story)
  async getStories(limit = 10, query = "") {
    return this.getRecords("rm_story", limit, query);
  }

  async getStory(sysIdOrNumber) {
    // Check if it's a story number (starts with letters) or sys_id (32 char hex)
    const isNumber = /^[A-Z]/.test(sysIdOrNumber);

    if (isNumber) {
      // Query by number field
      const result = await this.getRecords("rm_story", 1, `number=${sysIdOrNumber}`);
      if (result.result && result.result.length > 0) {
        return result.result[0];
      } else {
        throw new Error(`Story with number ${sysIdOrNumber} not found`);
      }
    } else {
      // Query by sys_id
      return this.getRecord("rm_story", sysIdOrNumber);
    }
  }

  async updateStoryBuildNotes(sysIdOrNumber, buildNotes, append = false) {
    // Check if it's a story number or sys_id
    const isNumber = /^[A-Z]/.test(sysIdOrNumber);
    let storyId = sysIdOrNumber;

    if (isNumber) {
      // Get the sys_id from the story number
      const story = await this.getStory(sysIdOrNumber);
      storyId = story.result ? story.result.sys_id : story.sys_id;
    }

    // If appending, get existing notes first
    if (append) {
      const story = await this.getRecord("rm_story", storyId);
      const existingNotes = story.result ? story.result.u_build_notes : story.u_build_notes || "";
      const updatedNotes = existingNotes + (existingNotes ? "\n\n" : "") + buildNotes;
      return this.updateRecord("rm_story", storyId, { u_build_notes: updatedNotes });
    }

    // Otherwise just set the notes
    return this.updateRecord("rm_story", storyId, { u_build_notes: buildNotes });
  }
}

// Initialize ServiceNow client
const instance = process.env.SERVICENOW_INSTANCE;
const username = process.env.SERVICENOW_USERNAME;
const password = process.env.SERVICENOW_PASSWORD;

if (!instance || !username || !password) {
  console.error("Missing required environment variables:");
  console.error("SERVICENOW_INSTANCE, SERVICENOW_USERNAME, SERVICENOW_PASSWORD");
  process.exit(1);
}

const client = new ServiceNowClient(instance, username, password);

// Create MCP server
const server = new Server(
  {
    name: "servicenow-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_records",
      description: "Get records from any ServiceNow table",
      inputSchema: {
        type: "object",
        properties: {
          table: {
            type: "string",
            description: "Table name (e.g., incident, sys_user, cmdb_ci)",
          },
          limit: {
            type: "number",
            description: "Maximum number of records to return",
            default: 10,
          },
          query: {
            type: "string",
            description: "Encoded query string (e.g., 'active=true^priority=1')",
          },
        },
        required: ["table"],
      },
    },
    {
      name: "get_record",
      description: "Get a single record by sys_id",
      inputSchema: {
        type: "object",
        properties: {
          table: {
            type: "string",
            description: "Table name",
          },
          sys_id: {
            type: "string",
            description: "Sys ID of the record",
          },
        },
        required: ["table", "sys_id"],
      },
    },
    {
      name: "create_record",
      description: "Create a new record in any ServiceNow table",
      inputSchema: {
        type: "object",
        properties: {
          table: {
            type: "string",
            description: "Table name",
          },
          data: {
            type: "object",
            description: "Record data as key-value pairs",
          },
        },
        required: ["table", "data"],
      },
    },
    {
      name: "update_record",
      description: "Update an existing record",
      inputSchema: {
        type: "object",
        properties: {
          table: {
            type: "string",
            description: "Table name",
          },
          sys_id: {
            type: "string",
            description: "Sys ID of the record to update",
          },
          data: {
            type: "object",
            description: "Fields to update as key-value pairs",
          },
        },
        required: ["table", "sys_id", "data"],
      },
    },
    {
      name: "delete_record",
      description: "Delete a record from ServiceNow",
      inputSchema: {
        type: "object",
        properties: {
          table: {
            type: "string",
            description: "Table name",
          },
          sys_id: {
            type: "string",
            description: "Sys ID of the record to delete",
          },
        },
        required: ["table", "sys_id"],
      },
    },
    {
      name: "get_incidents",
      description: "Get incident records with optional filters",
      inputSchema: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Maximum number of incidents",
            default: 10,
          },
          query: {
            type: "string",
            description: "Encoded query (e.g., 'active=true^state=1')",
          },
        },
      },
    },
    {
      name: "create_incident",
      description: "Create a new incident",
      inputSchema: {
        type: "object",
        properties: {
          short_description: {
            type: "string",
            description: "Brief description of the incident",
          },
          description: {
            type: "string",
            description: "Detailed description",
          },
          urgency: {
            type: "string",
            description: "Urgency level (1=High, 2=Medium, 3=Low)",
            enum: ["1", "2", "3"],
          },
          impact: {
            type: "string",
            description: "Impact level (1=High, 2=Medium, 3=Low)",
            enum: ["1", "2", "3"],
          },
          assignment_group: {
            type: "string",
            description: "Assignment group sys_id or name",
          },
        },
        required: ["short_description"],
      },
    },
    {
      name: "update_incident",
      description: "Update an existing incident",
      inputSchema: {
        type: "object",
        properties: {
          sys_id: {
            type: "string",
            description: "Incident sys_id",
          },
          state: {
            type: "string",
            description: "State (1=New, 2=In Progress, 6=Resolved, 7=Closed)",
          },
          assignment_group: {
            type: "string",
            description: "Assignment group",
          },
          assigned_to: {
            type: "string",
            description: "Assigned to user sys_id",
          },
          work_notes: {
            type: "string",
            description: "Work notes to add",
          },
          close_notes: {
            type: "string",
            description: "Closure notes",
          },
        },
        required: ["sys_id"],
      },
    },
    {
      name: "get_ui_actions",
      description: "Get UI Actions from ServiceNow, optionally filtered by table",
      inputSchema: {
        type: "object",
        properties: {
          table: {
            type: "string",
            description: "Filter by table name (e.g., incident, change_request)",
          },
          limit: {
            type: "number",
            description: "Maximum number of UI Actions to return",
            default: 50,
          },
        },
      },
    },
    {
      name: "get_ui_action",
      description: "Get a specific UI Action by sys_id",
      inputSchema: {
        type: "object",
        properties: {
          sys_id: {
            type: "string",
            description: "Sys ID of the UI Action",
          },
        },
        required: ["sys_id"],
      },
    },
    {
      name: "create_ui_action",
      description: "Create a new UI Action in ServiceNow",
      inputSchema: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Name of the UI Action",
          },
          table: {
            type: "string",
            description: "Table the UI Action applies to",
          },
          action_name: {
            type: "string",
            description: "Action name (used in scripting)",
          },
          script: {
            type: "string",
            description: "Server-side script to execute",
          },
          client_script_v2: {
            type: "string",
            description: "Client-side script (onClick)",
          },
          condition: {
            type: "string",
            description: "Condition script for when to show the action",
          },
          active: {
            type: "boolean",
            description: "Whether the UI Action is active",
            default: true,
          },
          form_button: {
            type: "boolean",
            description: "Show as form button",
            default: false,
          },
          form_context_menu: {
            type: "boolean",
            description: "Show in form context menu",
            default: false,
          },
          form_link: {
            type: "boolean",
            description: "Show as form link",
            default: false,
          },
          list_button: {
            type: "boolean",
            description: "Show as list button",
            default: false,
          },
          list_context_menu: {
            type: "boolean",
            description: "Show in list context menu",
            default: false,
          },
          list_link: {
            type: "boolean",
            description: "Show as list link",
            default: false,
          },
          order: {
            type: "number",
            description: "Display order",
            default: 100,
          },
          hint: {
            type: "string",
            description: "Tooltip/hint text",
          },
        },
        required: ["name", "table"],
      },
    },
    {
      name: "update_ui_action",
      description: "Update an existing UI Action",
      inputSchema: {
        type: "object",
        properties: {
          sys_id: {
            type: "string",
            description: "Sys ID of the UI Action to update",
          },
          data: {
            type: "object",
            description: "Fields to update (name, script, condition, etc.)",
          },
        },
        required: ["sys_id", "data"],
      },
    },
    {
      name: "get_tables",
      description: "List available tables in ServiceNow",
      inputSchema: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Maximum number of tables to return",
            default: 100,
          },
        },
      },
    },
    {
      name: "get_table_schema",
      description: "Get schema information for a specific table",
      inputSchema: {
        type: "object",
        properties: {
          table: {
            type: "string",
            description: "Table name",
          },
        },
        required: ["table"],
      },
    },
    {
      name: "get_business_rules",
      description: "Get Business Rules, optionally filtered by table",
      inputSchema: {
        type: "object",
        properties: {
          table: {
            type: "string",
            description: "Filter by table name",
          },
          limit: {
            type: "number",
            description: "Maximum number to return",
            default: 50,
          },
        },
      },
    },
    {
      name: "create_business_rule",
      description: "Create a new Business Rule",
      inputSchema: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Name of the Business Rule",
          },
          collection: {
            type: "string",
            description: "Table name",
          },
          script: {
            type: "string",
            description: "Script to execute",
          },
          when: {
            type: "string",
            description: "When to run (before, after, async, display)",
            enum: ["before", "after", "async", "display"],
          },
          active: {
            type: "boolean",
            description: "Whether active",
            default: true,
          },
        },
        required: ["name", "collection", "script"],
      },
    },
    {
      name: "get_stories",
      description: "Get stories (rm_story) with optional filters",
      inputSchema: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Maximum number of stories",
            default: 10,
          },
          query: {
            type: "string",
            description: "Encoded query (e.g., 'active=true^state=in_progress')",
          },
        },
      },
    },
    {
      name: "get_story",
      description: "Get a specific story by sys_id or story number (e.g., STRY0001234)",
      inputSchema: {
        type: "object",
        properties: {
          sys_id: {
            type: "string",
            description: "Story sys_id or story number (e.g., STRY0001234)",
          },
        },
        required: ["sys_id"],
      },
    },
    {
      name: "update_story_build_notes",
      description: "Update the u_build_notes HTML field for a story. Use this to document what was built and how.",
      inputSchema: {
        type: "object",
        properties: {
          sys_id: {
            type: "string",
            description: "Story sys_id or story number",
          },
          build_notes: {
            type: "string",
            description: "HTML content for build notes documenting what was built and how",
          },
          append: {
            type: "boolean",
            description: "If true, append to existing notes. If false, replace entirely.",
            default: false,
          },
        },
        required: ["sys_id", "build_notes"],
      },
    },
  ],
}));

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;

    switch (name) {
      case "get_records":
        result = await client.getRecords(args.table, args.limit, args.query || "");
        break;

      case "get_record":
        result = await client.getRecord(args.table, args.sys_id);
        break;

      case "create_record":
        result = await client.createRecord(args.table, args.data);
        break;

      case "update_record":
        result = await client.updateRecord(args.table, args.sys_id, args.data);
        break;

      case "delete_record":
        result = await client.deleteRecord(args.table, args.sys_id);
        break;

      case "get_incidents":
        result = await client.getIncidents(args.limit, args.query || "");
        break;

      case "create_incident":
        result = await client.createIncident(args);
        break;

      case "update_incident":
        result = await client.updateIncident(args.sys_id, args);
        break;

      case "get_ui_actions":
        result = await client.getUIActions(args.table || "", args.limit || 50);
        break;

      case "get_ui_action":
        result = await client.getUIAction(args.sys_id);
        break;

      case "create_ui_action":
        result = await client.createUIAction(args);
        break;

      case "update_ui_action":
        result = await client.updateUIAction(args.sys_id, args.data);
        break;

      case "get_tables":
        result = await client.getTables(args.limit || 100);
        break;

      case "get_table_schema":
        result = await client.getTableSchema(args.table);
        break;

      case "get_business_rules":
        result = await client.getBusinessRules(args.table || "", args.limit || 50);
        break;

      case "create_business_rule":
        result = await client.createBusinessRule(args);
        break;

      case "get_stories":
        result = await client.getStories(args.limit || 10, args.query || "");
        break;

      case "get_story":
        result = await client.getStory(args.sys_id);
        break;

      case "update_story_build_notes":
        result = await client.updateStoryBuildNotes(
          args.sys_id,
          args.build_notes,
          args.append || false
        );
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
const transport = new StdioServerTransport();
server.connect(transport);

console.error("ServiceNow MCP Server running on stdio");
