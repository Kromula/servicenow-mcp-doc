#!/usr/bin/env node
import https from "https";
import { URL } from "url";
import dotenv from "dotenv";

dotenv.config();

const instance = process.env.SERVICENOW_INSTANCE;
const username = process.env.SERVICENOW_USERNAME;
const password = process.env.SERVICENOW_PASSWORD;

if (!instance || !username || !password) {
  console.error("Missing required environment variables");
  process.exit(1);
}

// Parse instance URL
const url = new URL(instance);
const auth = Buffer.from(`${username}:${password}`).toString("base64");

console.log("Testing ServiceNow connection...");
console.log(`Instance: ${instance}`);
console.log(`Username: ${username}`);
console.log("");

// Test connection with a simple table query
const options = {
  hostname: url.hostname,
  path: "/api/now/table/sys_user?sysparm_limit=1",
  method: "GET",
  headers: {
    Authorization: `Basic ${auth}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  },
};

const req = https.request(options, (res) => {
  let data = "";
  res.on("data", (chunk) => (data += chunk));
  res.on("end", () => {
    if (res.statusCode === 200) {
      console.log("✓ Connection successful!");
      console.log(`✓ HTTP Status: ${res.statusCode}`);

      try {
        const parsed = JSON.parse(data);
        console.log(`✓ Received ${parsed.result?.length || 0} user record(s)`);
        console.log("\nServiceNow MCP Server is ready to use!");
      } catch (e) {
        console.log("✓ Response received but couldn't parse JSON");
      }
    } else {
      console.error(`✗ Connection failed with status ${res.statusCode}`);
      console.error(`Response: ${data}`);
      process.exit(1);
    }
  });
});

req.on("error", (error) => {
  console.error("✗ Connection failed:");
  console.error(error.message);
  process.exit(1);
});

req.end();
