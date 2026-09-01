claude mcp remove servicenow-console
claude mcp add servicenow-console `
  https://empdoconnor.service-now.com/sncapps/mcp-server/mcp/claudecode `
  --transport http `
  --client-id 4842d1b2a28c4242b016331708204c32 `
  --client-secret `
  --callback-port 33418
claude mcp get servicenow-console
