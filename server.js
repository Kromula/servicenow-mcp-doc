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
import { execFile, exec } from "child_process";
import { promisify } from "util";
import path from "path";
import { fileURLToPath } from "url";

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TOOLS_BASE = path.join(__dirname, "..");

// Tool Orchestrator for CLI tools
class ToolOrchestrator {
  constructor() {
    this.tools = {
      "script-checker": path.join(TOOLS_BASE, "servicenow-script-checker"),
      "data-loader": path.join(TOOLS_BASE, "servicenow-data-loader"),
      "ux-analyzer": path.join(TOOLS_BASE, "ServiceNow-UX-Analyzer"),
      "taxonomy-helper": path.join(TOOLS_BASE, "servicenow-taxonomy-helper"),
      "acl-manager": path.join(TOOLS_BASE, "servicenow-acl-manager"),
    };
  }

  async validateScripts(instance, options = {}) {
    const toolPath = this.tools["script-checker"];
    const { scriptType = "all", limit = 50, customOnly = false } = options;

    try {
      // Set environment for the instance
      const env = this._getInstanceEnv(instance);

      const args = [];
      if (scriptType !== "all") args.push("--type", scriptType);
      if (limit) args.push("--limit", limit.toString());
      if (customOnly) args.push("--custom-only");

      const result = await execFileAsync("node", [path.join(toolPath, "dist", "index.js"), ...args], {
        cwd: toolPath,
        env: { ...process.env, ...env },
        timeout: 300000, // 5 minutes
      });

      return {
        success: true,
        stdout: result.stdout,
        stderr: result.stderr,
        message: "Script validation completed successfully",
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        stdout: error.stdout || "",
        stderr: error.stderr || "",
      };
    }
  }

  async loadData(instance, recordType, count = 10, options = {}) {
    const toolPath = this.tools["data-loader"];

    try {
      const env = this._getInstanceEnv(instance);
      const args = ["--type", recordType, "--count", count.toString()];

      const result = await execFileAsync("node", [path.join(toolPath, "src", "index.js"), ...args], {
        cwd: toolPath,
        env: { ...process.env, ...env },
        timeout: 600000, // 10 minutes
      });

      return {
        success: true,
        recordType,
        count,
        stdout: result.stdout,
        stderr: result.stderr,
        message: `Generated ${count} ${recordType} records successfully`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        stdout: error.stdout || "",
        stderr: error.stderr || "",
      };
    }
  }

  async analyzeUX(instance, analysisType = "general", options = {}) {
    const toolPath = this.tools["ux-analyzer"];
    const { guideline } = options;

    const analysisTypeMap = {
      esc: "ESC",
      portal: "PORTAL",
      workspace: "WORKSPACE",
      general: "ESC",
    };

    try {
      const env = this._getInstanceEnv(instance);
      const extraEnv = {
        ANALYSIS_TYPE: analysisTypeMap[analysisType] || "ESC",
      };
      if (guideline) extraEnv.GUIDELINE_FILE = guideline;

      const result = await execFileAsync("node", [path.join(toolPath, "analyze-servicenow.js")], {
        cwd: toolPath,
        env: { ...process.env, ...env, ...extraEnv },
        timeout: 600000, // 10 minutes
      });

      return {
        success: true,
        analysisType,
        instance,
        stdout: result.stdout,
        stderr: result.stderr,
        message: "UX analysis completed successfully",
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        stdout: error.stdout || "",
        stderr: error.stderr || "",
      };
    }
  }

  async analyzeTaxonomy(instance, options = {}) {
    const toolPath = this.tools["taxonomy-helper"];

    try {
      const env = this._getInstanceEnv(instance);

      const result = await execFileAsync("node", [path.join(toolPath, "core", "analyze.js")], {
        cwd: toolPath,
        env: { ...process.env, ...env },
        timeout: 600000, // 10 minutes
      });

      return {
        success: true,
        instance,
        stdout: result.stdout,
        stderr: result.stderr,
        message: "Taxonomy analysis completed successfully",
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        stdout: error.stdout || "",
        stderr: error.stderr || "",
      };
    }
  }

  async analyzeACL(instance, analysisType, target, options = {}) {
    const toolPath = this.tools["acl-manager"];

    try {
      const env = this._getInstanceEnv(instance);
      const args = [analysisType];

      switch (analysisType) {
        case "analyze-table":
          args.push("--table", target);
          if (options.includeFields) args.push("--include-fields");
          if (options.operations) args.push("--operations", options.operations);
          break;
        case "analyze-user":
          args.push("--user", target);
          break;
        case "analyze-role":
          args.push("--role", target);
          break;
        case "security-scan":
          if (target) args.push("--table", target);
          if (options.severity) args.push("--severity", options.severity);
          if (options.limit) args.push("--limit", options.limit.toString());
          break;
        default:
          throw new Error(`Unknown ACL analysis type: ${analysisType}`);
      }

      const result = await execFileAsync(
        "node",
        [path.join(toolPath, "src", "index.js"), ...args],
        {
          cwd: toolPath,
          env: { ...process.env, ...env },
          timeout: 300000, // 5 minutes
        }
      );

      let parsed;
      try {
        parsed = JSON.parse(result.stdout);
      } catch {
        parsed = { raw: result.stdout };
      }

      return {
        success: true,
        analysis_type: analysisType,
        target,
        instance,
        result: parsed,
        message: `ACL ${analysisType} completed successfully`,
      };
    } catch (error) {
      return {
        success: false,
        analysis_type: analysisType,
        target,
        error: error.message,
        stdout: error.stdout || "",
        stderr: error.stderr || "",
      };
    }
  }

  _getInstanceEnv(instance) {
    // Map instance names to environment variables
    const instanceMap = {
      "my-instance": {
        SERVICENOW_URL: process.env.MY_INSTANCE_URL || "my-instance",
        SERVICENOW_USERNAME: process.env.MY_INSTANCE_USERNAME,
        SERVICENOW_PASSWORD: process.env.MY_INSTANCE_PASSWORD,
      },
      "forvis-mazar-dev": {
        SERVICENOW_URL: process.env.FORVIS_INSTANCE_URL || "forvis-mazar-dev",
        SERVICENOW_USERNAME: process.env.FORVIS_INSTANCE_USERNAME,
        SERVICENOW_PASSWORD: process.env.FORVIS_INSTANCE_PASSWORD,
      },
    };

    const env = instanceMap[instance];
    if (!env) {
      throw new Error(`Unknown instance: ${instance}. Valid instances: ${Object.keys(instanceMap).join(", ")}`);
    }

    if (!env.SERVICENOW_USERNAME || !env.SERVICENOW_PASSWORD) {
      throw new Error(`Missing credentials for instance: ${instance}. Check your .env file.`);
    }

    return env;
  }
}

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

  async createAtfSteps(testSysId, steps) {
    return this.request("POST", "/api/now/claude_atf_step_builder/steps", {
      test_sys_id: testSysId,
      steps,
    });
  }

  async runAtfTestSuite(testSuiteSysId, options = {}) {
    const params = { test_suite_sys_id: testSuiteSysId, run_in_cloud: options.run_in_cloud ?? false };
    for (const key of ["browser_name", "browser_version", "os_name", "os_version", "is_performance_run"]) {
      if (options[key] !== undefined) params[key] = options[key];
    }
    return this.request("POST", "/api/sn_cicd/testsuite/run", null, params);
  }

  async getCicdProgress(progressId) {
    return this.request("GET", `/api/sn_cicd/progress/${progressId}`);
  }

  async getAtfSuiteResults(resultId) {
    return this.request("GET", `/api/sn_cicd/testsuite/results/${resultId}`);
  }

  async runAtfSuiteAndWait(testSuiteSysId, options = {}) {
    const started = await this.runAtfTestSuite(testSuiteSysId, options);

    const findLink = (obj, key) => {
      if (!obj || typeof obj !== "object") return undefined;
      if (obj.links && obj.links[key] && obj.links[key].id) return obj.links[key].id;
      for (const v of Object.values(obj)) {
        if (v && typeof v === "object") {
          const found = findLink(v, key);
          if (found) return found;
        }
      }
      return undefined;
    };

    const progressId = findLink(started, "progress");
    if (!progressId) {
      return { started, progress: null, results: null, timed_out: false };
    }

    const pendingLabels = ["pending", "running", "in progress", "in_progress"];
    let progress = await this.getCicdProgress(progressId);
    let timedOut = true;

    for (let attempt = 0; attempt < 40; attempt++) {
      const statusLabel = (progress?.result?.status_label || "").toString().toLowerCase();
      if (!pendingLabels.includes(statusLabel)) {
        timedOut = false;
        break;
      }
      await new Promise((r) => setTimeout(r, 3000));
      progress = await this.getCicdProgress(progressId);
    }

    const resultId = findLink(progress, "results") || findLink(progress, "result");
    const results = resultId ? await this.getAtfSuiteResults(resultId) : null;

    return { started, progress, results, timed_out: timedOut };
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

  // -------------------------------------------------------------------------
  // ACL Operations
  // -------------------------------------------------------------------------

  async getACLs(tableName = "", operation = "", active = null, limit = 50) {
    const conditions = [];
    if (tableName) conditions.push(`nameSTARTSWITH${tableName}`);
    if (operation) conditions.push(`operation=${operation}`);
    if (active !== null) conditions.push(`active=${active}`);
    const query = conditions.join("^");
    const params = {
      sysparm_limit: limit,
      sysparm_fields: "sys_id,name,operation,active,advanced,condition,script,admin_overrides,description,type",
    };
    if (query) params.sysparm_query = query;
    return this.request("GET", "/api/now/table/sys_security_acl", null, params);
  }

  async getACL(sysId) {
    return this.getRecord("sys_security_acl", sysId);
  }

  async createACL(data) {
    const { roles = [], ...aclData } = data;
    // Create the ACL record
    const aclResult = await this.createRecord("sys_security_acl", aclData);
    const aclSysId = aclResult.result?.sys_id;

    if (!aclSysId) {
      return { success: false, error: "ACL creation did not return a sys_id", raw: aclResult };
    }

    // Assign roles if provided
    const roleResults = [];
    for (const roleName of roles) {
      try {
        const roleSearch = await this.getRecords("sys_user_role", 1, `name=${roleName}`);
        const roleSysId = roleSearch.result?.[0]?.sys_id;
        if (roleSysId) {
          const roleLink = await this.createRecord("sys_security_acl_role", {
            sys_security_acl: aclSysId,
            sys_user_role: roleSysId,
          });
          roleResults.push({ role: roleName, sys_id: roleSysId, linked: roleLink.result?.sys_id });
        } else {
          roleResults.push({ role: roleName, error: `Role '${roleName}' not found` });
        }
      } catch (e) {
        roleResults.push({ role: roleName, error: e.message });
      }
    }

    return {
      success: true,
      acl: aclResult.result,
      roles_assigned: roleResults,
    };
  }

  async updateACL(sysId, data) {
    return this.updateRecord("sys_security_acl", sysId, data);
  }

  async deleteACL(sysId) {
    return this.deleteRecord("sys_security_acl", sysId);
  }

  async getACLRoles(aclSysId) {
    const params = {
      sysparm_query: `sys_security_acl=${aclSysId}`,
      sysparm_fields: "sys_id,sys_user_role,sys_user_role.name,sys_name",
      sysparm_limit: 50,
    };
    return this.request("GET", "/api/now/table/sys_security_acl_role", null, params);
  }

  async addRoleToACL(aclSysId, roleNameOrSysId) {
    // Determine if input is a role name or sys_id
    const isGuid = /^[a-f0-9]{32}$/i.test(roleNameOrSysId);
    let roleSysId = roleNameOrSysId;

    if (!isGuid) {
      const roleSearch = await this.getRecords("sys_user_role", 1, `name=${roleNameOrSysId}`);
      roleSysId = roleSearch.result?.[0]?.sys_id;
      if (!roleSysId) {
        throw new Error(`Role '${roleNameOrSysId}' not found`);
      }
    }

    return this.createRecord("sys_security_acl_role", { sys_security_acl: aclSysId, sys_user_role: roleSysId });
  }

  async removeRoleFromACL(aclRoleSysId) {
    return this.deleteRecord("sys_security_acl_role", aclRoleSysId);
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
const orchestrator = new ToolOrchestrator();

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
      name: "create_atf_steps",
      description:
        "Create one or more ATF test steps with their input variables populated (script, field_values, assert_type, view, form_ui, etc.). Calls the privileged 'Claude ATF Step Builder' Scripted REST API at /api/now/claude_atf_step_builder/steps, which writes the sys_variable_value rows that the standard Table API cannot due to ACL restrictions. The endpoint must be installed on the target instance (see servicenow-dev-helper/setup/claude-atf-step-builder/).",
      inputSchema: {
        type: "object",
        properties: {
          test_sys_id: {
            type: "string",
            description: "sys_id of the parent sys_atf_test record",
          },
          steps: {
            type: "array",
            description:
              "Ordered array of step definitions. Each item: { step_config: <sys_atf_step_config sys_id>, order?: <number>, table?: <string>, notes?: <string>, inputs?: { <element_name>: <value>, ... } }. Use 'inputs' to pass element-name -> value pairs for the step config's variables (e.g. { script: '...', field_values: 'state=3', assert_type: 'form_submitted_to_server' }).",
            items: {
              type: "object",
              properties: {
                step_config: { type: "string" },
                order: { type: "number" },
                table: { type: "string" },
                notes: { type: "string" },
                inputs: { type: "object" },
              },
              required: ["step_config"],
            },
          },
        },
        required: ["test_sys_id", "steps"],
      },
    },
    {
      name: "run_atf_suite",
      description:
        "Run a sys_atf_test_suite via ServiceNow's native CI/CD REST API (/api/sn_cicd/testsuite/run), poll progress, and return pass/fail results. No custom endpoint install required (unlike create_atf_steps), but the calling user needs the sn_cicd.sys_ci_automation or admin role. Pure server-side-script suites run with no further setup. Suites containing UI-driven steps (Open a New Form, Set Field Values, etc.) require a configured test runner — ServiceNow's Cloud Runner product (run_in_cloud=true), a configured headless browser, or a live scheduled Client Test Runner session — otherwise the run will hang or fail waiting for a runner.",
      inputSchema: {
        type: "object",
        properties: {
          test_suite_sys_id: {
            type: "string",
            description: "sys_id of the sys_atf_test_suite record to run",
          },
          run_in_cloud: {
            type: "boolean",
            description: "true to execute via ServiceNow's Cloud Runner product; false (default) to use the manual test runner. Only relevant for suites with UI-driven steps.",
            default: false,
          },
          browser_name: {
            type: "string",
            description: "Browser to use for UI-driven steps (e.g. chrome, firefox, edge). Must match a scheduled client test runner.",
          },
          os_name: {
            type: "string",
            description: "Operating system to run under for UI-driven steps. Must match a scheduled client test runner.",
          },
        },
        required: ["test_suite_sys_id"],
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
    // ServiceNow Tool Orchestrator
    {
      name: "validate_scripts",
      description: "Validate ServiceNow scripts against best practices using the script-checker tool. Returns detailed analysis with violations and recommendations.",
      inputSchema: {
        type: "object",
        properties: {
          instance: {
            type: "string",
            description: "Instance name (my-instance or forvis-mazar-dev)",
            enum: ["my-instance", "forvis-mazar-dev"],
          },
          script_type: {
            type: "string",
            description: "Type of scripts to check (business_rule, client_script, ui_action, script_include, all)",
            enum: ["business_rule", "client_script", "ui_action", "script_include", "all"],
            default: "all",
          },
          limit: {
            type: "number",
            description: "Maximum number of scripts to analyze",
            default: 50,
          },
          custom_only: {
            type: "boolean",
            description: "Only analyze custom scripts (not out-of-box ServiceNow scripts)",
            default: false,
          },
        },
        required: ["instance"],
      },
    },
    {
      name: "load_test_data",
      description: "Generate and load realistic test data into ServiceNow using the data-loader tool. Supports incidents, changes, problems, major-incidents, and stories.",
      inputSchema: {
        type: "object",
        properties: {
          instance: {
            type: "string",
            description: "Instance name (my-instance or forvis-mazar-dev)",
            enum: ["my-instance", "forvis-mazar-dev"],
          },
          record_type: {
            type: "string",
            description: "Type of records to generate",
            enum: ["incident", "change", "problem", "major-incident", "story"],
          },
          count: {
            type: "number",
            description: "Number of records to generate",
            default: 10,
          },
        },
        required: ["instance", "record_type"],
      },
    },
    {
      name: "analyze_ux",
      description: "Perform automated UX/UI analysis of ServiceNow using Playwright. Analyzes accessibility, responsiveness, and user experience.",
      inputSchema: {
        type: "object",
        properties: {
          instance: {
            type: "string",
            description: "Instance name (my-instance or forvis-mazar-dev)",
            enum: ["my-instance", "forvis-mazar-dev"],
          },
          analysis_type: {
            type: "string",
            description: "Type of UX analysis to perform",
            enum: ["general", "esc", "portal", "workspace"],
            default: "general",
          },
          guideline: {
            type: "string",
            description: "Guideline file to run the analysis against",
            enum: [
              "servicenow-ux-guidelines.md",
              "Design-Visual-UX-Guidelines.md",
              "wcag-2.2-level-aa.md",
              "wcag-2.2-level-aaa.md",
            ],
          },
        },
        required: ["instance"],
      },
    },
    {
      name: "analyze_taxonomy",
      description: "Analyze ServiceNow Employee Center taxonomy and provide AI-powered recommendations for organization and categorization.",
      inputSchema: {
        type: "object",
        properties: {
          instance: {
            type: "string",
            description: "Instance name (my-instance or forvis-mazar-dev)",
            enum: ["my-instance", "forvis-mazar-dev"],
          },
        },
        required: ["instance"],
      },
    },

    // -----------------------------------------------------------------------
    // ACL Management Tools
    // -----------------------------------------------------------------------
    {
      name: "get_acls",
      description: "List ACL rules from ServiceNow, with optional filters by table, operation, and active status. References Guidelines.md for interpretation.",
      inputSchema: {
        type: "object",
        properties: {
          table: {
            type: "string",
            description: "Filter by table name prefix (e.g., 'incident' returns all incident ACLs including field-level)",
          },
          operation: {
            type: "string",
            description: "Filter by operation",
            enum: ["read", "write", "create", "delete", "execute", "report_on", "import", "export"],
          },
          active: {
            type: "boolean",
            description: "Filter by active status (true=active only, false=inactive only, omit=all)",
          },
          limit: {
            type: "number",
            description: "Maximum number of ACLs to return",
            default: 50,
          },
        },
      },
    },
    {
      name: "get_acl",
      description: "Get a single ACL record by sys_id, including all fields (condition, script, roles).",
      inputSchema: {
        type: "object",
        properties: {
          sys_id: {
            type: "string",
            description: "Sys ID of the ACL record",
          },
        },
        required: ["sys_id"],
      },
    },
    {
      name: "create_acl",
      description: "Create a new ACL rule in ServiceNow and assign roles to it. Use natural language intent to determine the correct parameters per Guidelines.md. Example: create read ACL on incident table for itil role.",
      inputSchema: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Table name (e.g., 'incident') or table.field (e.g., 'incident.u_sensitive_notes')",
          },
          operation: {
            type: "string",
            description: "Operation to control",
            enum: ["read", "write", "create", "delete", "execute", "report_on", "import", "export"],
          },
          roles: {
            type: "array",
            items: { type: "string" },
            description: "Array of role names to assign (e.g., ['itil', 'incident_manager']). Users need ANY ONE of these roles.",
          },
          description: {
            type: "string",
            description: "Human-readable description explaining why this ACL exists (required by guidelines)",
          },
          active: {
            type: "boolean",
            description: "Whether the ACL is active",
            default: true,
          },
          admin_overrides: {
            type: "boolean",
            description: "Whether admin role bypasses this ACL. Set false for sensitive data per guidelines.",
            default: true,
          },
          advanced: {
            type: "boolean",
            description: "Set true if using a script condition",
            default: false,
          },
          condition: {
            type: "string",
            description: "Condition script (non-advanced). E.g., 'current.opened_by == gs.getUserID()'",
          },
          script: {
            type: "string",
            description: "Advanced script (when advanced=true). Must include try/catch and set answer=true/false.",
          },
          type: {
            type: "string",
            description: "ACL type. Defaults to 'record' for table-level ACLs.",
            default: "record",
          },
        },
        required: ["name", "operation"],
      },
    },
    {
      name: "update_acl",
      description: "Update fields on an existing ACL rule (description, condition, script, active status, admin_overrides, etc.).",
      inputSchema: {
        type: "object",
        properties: {
          sys_id: {
            type: "string",
            description: "Sys ID of the ACL to update",
          },
          data: {
            type: "object",
            description: "Fields to update. Valid keys: active, admin_overrides, advanced, condition, script, description",
          },
        },
        required: ["sys_id", "data"],
      },
    },
    {
      name: "deactivate_acl",
      description: "Deactivate an ACL rule (sets active=false). Preferred over deletion per guidelines — keeps the rule for audit trail.",
      inputSchema: {
        type: "object",
        properties: {
          sys_id: {
            type: "string",
            description: "Sys ID of the ACL to deactivate",
          },
          reason: {
            type: "string",
            description: "Reason for deactivation — will be appended to the ACL description",
          },
        },
        required: ["sys_id"],
      },
    },
    {
      name: "delete_acl",
      description: "Permanently delete an ACL rule. Use deactivate_acl first and only delete after 30+ days per guidelines. Never delete out-of-box ACLs.",
      inputSchema: {
        type: "object",
        properties: {
          sys_id: {
            type: "string",
            description: "Sys ID of the ACL to delete",
          },
        },
        required: ["sys_id"],
      },
    },
    {
      name: "get_acl_roles",
      description: "Get all roles assigned to a specific ACL rule.",
      inputSchema: {
        type: "object",
        properties: {
          acl_sys_id: {
            type: "string",
            description: "Sys ID of the ACL",
          },
        },
        required: ["acl_sys_id"],
      },
    },
    {
      name: "add_role_to_acl",
      description: "Add a role to an existing ACL rule. Accepts role name (e.g., 'itil') or role sys_id.",
      inputSchema: {
        type: "object",
        properties: {
          acl_sys_id: {
            type: "string",
            description: "Sys ID of the ACL",
          },
          role: {
            type: "string",
            description: "Role name (e.g., 'itil') or role sys_id",
          },
        },
        required: ["acl_sys_id", "role"],
      },
    },
    {
      name: "remove_role_from_acl",
      description: "Remove a role from an ACL rule by deleting the sys_security_acl_role link record.",
      inputSchema: {
        type: "object",
        properties: {
          acl_role_sys_id: {
            type: "string",
            description: "Sys ID of the sys_security_acl_role record (not the ACL itself — use get_acl_roles to find it)",
          },
        },
        required: ["acl_role_sys_id"],
      },
    },
    {
      name: "analyze_acl_table",
      description: "Perform a full ACL analysis for a ServiceNow table. Returns all ACLs (active/inactive), their roles, operations covered/missing, and security notes. References Guidelines.md.",
      inputSchema: {
        type: "object",
        properties: {
          instance: {
            type: "string",
            description: "Instance name (my-instance or forvis-mazar-dev)",
            enum: ["my-instance", "forvis-mazar-dev"],
          },
          table: {
            type: "string",
            description: "Table name to analyze (e.g., 'incident', 'sc_request')",
          },
          include_fields: {
            type: "boolean",
            description: "Include field-level ACLs in analysis",
            default: false,
          },
          operations: {
            type: "string",
            description: "Comma-separated list of operations to focus on (e.g., 'read,write'). Omit for all.",
          },
        },
        required: ["instance", "table"],
      },
    },
    {
      name: "analyze_acl_user",
      description: "Analyze effective ACL access for a specific user. Returns all roles (direct + via groups), and every table/operation the user can access based on those roles.",
      inputSchema: {
        type: "object",
        properties: {
          instance: {
            type: "string",
            description: "Instance name (my-instance or forvis-mazar-dev)",
            enum: ["my-instance", "forvis-mazar-dev"],
          },
          user: {
            type: "string",
            description: "Username (e.g., 'john.doe') or user sys_id",
          },
        },
        required: ["instance", "user"],
      },
    },
    {
      name: "analyze_acl_role",
      description: "Analyze all ACL rules associated with a specific role. Returns every table and operation this role grants access to.",
      inputSchema: {
        type: "object",
        properties: {
          instance: {
            type: "string",
            description: "Instance name (my-instance or forvis-mazar-dev)",
            enum: ["my-instance", "forvis-mazar-dev"],
          },
          role: {
            type: "string",
            description: "Role name (e.g., 'itil', 'sn_request_read')",
          },
        },
        required: ["instance", "role"],
      },
    },
    {
      name: "security_scan_acls",
      description: "Run a security vulnerability scan against ACL rules. Checks for open-access ACLs, script vulnerabilities, duplicate rules, missing descriptions, and more. References Guidelines.md Section 12.",
      inputSchema: {
        type: "object",
        properties: {
          instance: {
            type: "string",
            description: "Instance name (my-instance or forvis-mazar-dev)",
            enum: ["my-instance", "forvis-mazar-dev"],
          },
          table: {
            type: "string",
            description: "Scope scan to a specific table (e.g., 'incident'). Omit to scan all ACLs.",
          },
          severity: {
            type: "string",
            description: "Comma-separated severity levels to include: critical,high,medium,low",
            default: "critical,high,medium,low",
          },
          limit: {
            type: "number",
            description: "Maximum number of ACLs to scan",
            default: 200,
          },
        },
        required: ["instance"],
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

      case "create_atf_steps":
        result = await client.createAtfSteps(args.test_sys_id, args.steps);
        break;

      case "run_atf_suite":
        result = await client.runAtfSuiteAndWait(args.test_suite_sys_id, {
          run_in_cloud: args.run_in_cloud,
          browser_name: args.browser_name,
          os_name: args.os_name,
        });
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

      // Tool Orchestrator cases
      case "validate_scripts":
        result = await orchestrator.validateScripts(args.instance, {
          scriptType: args.script_type,
          limit: args.limit,
          customOnly: args.custom_only,
        });
        break;

      case "load_test_data":
        result = await orchestrator.loadData(args.instance, args.record_type, args.count);
        break;

      case "analyze_ux":
        result = await orchestrator.analyzeUX(args.instance, args.analysis_type, { guideline: args.guideline });
        break;

      case "analyze_taxonomy":
        result = await orchestrator.analyzeTaxonomy(args.instance);
        break;

      // ACL Management
      case "get_acls":
        result = await client.getACLs(
          args.table || "",
          args.operation || "",
          args.active !== undefined ? args.active : null,
          args.limit || 50
        );
        break;

      case "get_acl":
        result = await client.getACL(args.sys_id);
        break;

      case "create_acl":
        result = await client.createACL(args);
        break;

      case "update_acl":
        result = await client.updateACL(args.sys_id, args.data);
        break;

      case "deactivate_acl": {
        // Optionally append reason to description
        const updateData = { active: false };
        if (args.reason) {
          const existing = await client.getACL(args.sys_id);
          const currentDesc = existing?.result?.description || "";
          const deactivationNote = `[DEACTIVATED ${new Date().toISOString().split("T")[0]}: ${args.reason}]`;
          updateData.description = currentDesc
            ? `${currentDesc} | ${deactivationNote}`
            : deactivationNote;
        }
        result = await client.updateACL(args.sys_id, updateData);
        break;
      }

      case "delete_acl":
        result = await client.deleteACL(args.sys_id);
        break;

      case "get_acl_roles":
        result = await client.getACLRoles(args.acl_sys_id);
        break;

      case "add_role_to_acl":
        result = await client.addRoleToACL(args.acl_sys_id, args.role);
        break;

      case "remove_role_from_acl":
        result = await client.removeRoleFromACL(args.acl_role_sys_id);
        break;

      // ACL Analysis (delegated to servicenow-acl-manager tool)
      case "analyze_acl_table":
        result = await orchestrator.analyzeACL(args.instance, "analyze-table", args.table, {
          includeFields: args.include_fields,
          operations: args.operations,
        });
        break;

      case "analyze_acl_user":
        result = await orchestrator.analyzeACL(args.instance, "analyze-user", args.user);
        break;

      case "analyze_acl_role":
        result = await orchestrator.analyzeACL(args.instance, "analyze-role", args.role);
        break;

      case "security_scan_acls":
        result = await orchestrator.analyzeACL(
          args.instance,
          "security-scan",
          args.table || "",
          {
            severity: args.severity || "critical,high,medium,low",
            limit: args.limit || 200,
          }
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
