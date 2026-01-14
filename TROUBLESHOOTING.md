# Troubleshooting Guide

This guide covers common issues when setting up and using the ServiceNow MCP Server with Claude Code.

## Table of Contents
- [Connection Issues](#connection-issues)
- [Authentication Problems](#authentication-problems)
- [Verification Steps](#verification-steps)
- [Common Error Messages](#common-error-messages)

---

## Connection Issues

### MCP Server Shows "Failed to Connect"

If you run `claude mcp list` and see:
```
servicenow: node /path/to/server.js - ✗ Failed to connect
```

**Possible causes:**
1. Authentication credentials are incorrect
2. Special characters in password are being escaped
3. ServiceNow instance URL is incorrect
4. Network connectivity issues

**Solution steps:**

1. **Check MCP server configuration:**
   ```bash
   claude mcp get servicenow
   ```

   Look at the Environment section to verify your credentials are correct.

2. **Test connection manually** (see [Manual Connection Test](#manual-connection-test) below)

3. **Check for password special character issues** (see [Special Characters in Passwords](#special-characters-in-passwords))

---

## Authentication Problems

### Special Characters in Passwords

**Problem:** Passwords containing special characters like `!`, `$`, `@`, `#` may be escaped or misinterpreted by the shell.

**Symptoms:**
- MCP server shows "Failed to connect"
- Manual API tests return 401 Unauthorized
- Password appears with backslashes: `\!password` instead of `!password`

**Solution:**

When you see escaped characters in the password (like `\!` instead of `!`), you need to manually edit the Claude Code configuration:

1. **Check the current configuration:**
   ```bash
   claude mcp get servicenow
   ```

   If you see `SERVICENOW_PASSWORD=\!yourpassword`, the password is incorrectly escaped.

2. **Fix the configuration:**
   ```bash
   # Remove the existing server
   claude mcp remove servicenow -s local

   # Re-add with properly quoted password
   claude mcp add -s local servicenow -e SERVICENOW_INSTANCE='https://your-instance.service-now.com/' -e SERVICENOW_USERNAME='your-username' -e 'SERVICENOW_PASSWORD=!YourPassword123' -- node /path/to/server.js
   ```

   Note: The entire environment variable is wrapped in single quotes to prevent shell interpretation.

3. **If still failing, manually edit the config file:**

   Edit `~/.claude.json` (or the project-specific `.claude.json`) and find the servicenow server configuration. Change:
   ```json
   "SERVICENOW_PASSWORD": "\\!YourPassword123"
   ```
   to:
   ```json
   "SERVICENOW_PASSWORD": "!YourPassword123"
   ```

4. **Verify the fix:**
   ```bash
   claude mcp list
   ```

   You should now see: `servicenow: ... - ✓ Connected`

**Alternative approach:** Use the `.env` file in the server directory, where special characters don't need escaping:
```
SERVICENOW_INSTANCE=https://your-instance.service-now.com/
SERVICENOW_USERNAME=your-username
SERVICENOW_PASSWORD=!YourPassword123
```

### Invalid Instance URL

**Problem:** ServiceNow instance URL is formatted incorrectly.

**Correct formats:**
- `https://your-instance.service-now.com/`
- `your-instance.service-now.com`
- `https://your-instance.service-now.com` (trailing slash optional)

**Incorrect formats:**
- `your-instance` (missing domain)
- `http://your-instance.service-now.com/` (HTTP instead of HTTPS)

---

## Verification Steps

### Manual Connection Test

Test your ServiceNow connection directly using Node.js:

```javascript
// Save as test-connection.js or run directly
import https from 'https';

const instance = 'your-instance.service-now.com';
const username = 'your-username';
const password = 'your-password';

const auth = Buffer.from(`${username}:${password}`).toString('base64');

const options = {
  hostname: instance,
  path: '/api/now/table/incident?sysparm_limit=1',
  method: 'GET',
  headers: {
    'Authorization': `Basic ${auth}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
};

const req = https.request(options, (res) => {
  console.log('Status:', res.statusCode);
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('✓ Connection successful!');
    } else {
      console.log('✗ Error:', data);
    }
  });
});

req.on('error', (e) => {
  console.error('✗ Connection failed:', e.message);
});

req.end();
```

Run it:
```bash
node test-connection.js
```

**Expected output for success:**
```
Status: 200
✓ Connection successful!
```

**Expected output for authentication failure:**
```
Status: 401
✗ Error: {"error":{"message":"User Not Authenticated","detail":"Required to provide Auth information"},"status":"failure"}
```

### Check MCP Server Status

View detailed MCP server information:
```bash
claude mcp get servicenow
```

This shows:
- Connection status (✓ Connected or ✗ Failed to connect)
- Command and arguments being used
- Environment variables (including credentials)
- Configuration scope (local or global)

### Test MCP Server Directly

Test if the MCP server executable runs without errors:
```bash
cd /path/to/servicenow-mcp-doc
node server.js
```

The server should start and wait for MCP protocol messages. Press Ctrl+C to exit.

**Common startup errors:**
- `SyntaxError: Invalid or unexpected token` - Check that the shebang (`#!/usr/bin/env node`) is on the first line
- `MODULE_NOT_FOUND` - Run `npm install` to install dependencies
- `Error: Cannot find module 'dotenv'` - Install dependencies with `npm install`

---

## Common Error Messages

### "Failed to connect" with no additional details

**Cause:** MCP server is not starting properly or crashing immediately.

**Solution:**
1. Test the server directly: `node /path/to/server.js`
2. Check for syntax errors or missing dependencies
3. Ensure Node.js version is compatible (v18 or higher recommended)

### "User Not Authenticated" (401 error)

**Cause:** Invalid credentials or password special character issues.

**Solution:**
1. Verify username and password are correct
2. Check for escaped special characters (see [Special Characters in Passwords](#special-characters-in-passwords))
3. Test connection manually (see [Manual Connection Test](#manual-connection-test))
4. Verify the ServiceNow user has the necessary roles (e.g., `rest_api_explorer`, `itil`)

### "Connection timeout" or "ETIMEDOUT"

**Cause:** Network connectivity issues or incorrect instance URL.

**Solution:**
1. Verify the ServiceNow instance URL is correct
2. Check your network connection
3. Try accessing the instance in a browser: `https://your-instance.service-now.com/`
4. Check if you're behind a corporate firewall or VPN that might block the connection

### "ENOTFOUND" or "getaddrinfo ENOTFOUND"

**Cause:** Instance hostname cannot be resolved.

**Solution:**
1. Verify the instance URL format (should be `your-instance.service-now.com`)
2. Check if the instance name is spelled correctly
3. Verify DNS is working: `nslookup your-instance.service-now.com`

### Tools not appearing in Claude Code

**Cause:** MCP server is not properly connected or registered.

**Solution:**
1. Check MCP server status: `claude mcp list`
2. Restart Claude Code session
3. Verify the server is in the correct scope (local vs global)
4. Check project-specific MCP configuration in `.claude/settings.local.json`

---

## Getting Help

If you continue experiencing issues:

1. **Check the logs**: The MCP server outputs to stderr. Watch for error messages when starting.

2. **Verify ServiceNow instance access**: Ensure you can access your instance via the web interface.

3. **Test with a simple curl command**:
   ```bash
   curl -u "username:password" \
     "https://your-instance.service-now.com/api/now/table/incident?sysparm_limit=1" \
     -H "Accept: application/json"
   ```

4. **Create an issue**: If problems persist, create an issue on the GitHub repository with:
   - Output of `claude mcp get servicenow` (redact password)
   - Error messages you're seeing
   - Node.js version: `node --version`
   - Claude Code version: `claude --version`

---

## Quick Reference

### Useful Commands

```bash
# List all MCP servers and their status
claude mcp list

# Get detailed info about ServiceNow MCP server
claude mcp get servicenow

# Remove MCP server configuration
claude mcp remove servicenow -s local

# Add MCP server with environment variables
claude mcp add -s local servicenow \
  -e SERVICENOW_INSTANCE='https://instance.service-now.com/' \
  -e SERVICENOW_USERNAME='username' \
  -e 'SERVICENOW_PASSWORD=password' \
  -- node /path/to/server.js

# Test server directly
node /path/to/server.js
```

### Configuration Locations

- **Global config**: `~/.claude.json`
- **Project config**: `/path/to/project/.claude.json`
- **Project settings**: `/path/to/project/.claude/settings.local.json`
- **Environment file**: `/path/to/servicenow-mcp-doc/.env`
