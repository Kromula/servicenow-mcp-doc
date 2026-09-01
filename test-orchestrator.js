#!/usr/bin/env node

/**
 * Test script for ServiceNow MCP Orchestrator
 * Validates configuration and tool availability
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

console.log('\n🧪 ServiceNow MCP Orchestrator Test Suite\n');
console.log('='.repeat(50) + '\n');

let errors = 0;
let warnings = 0;

// Test 1: Check environment variables
console.log('1️⃣  Checking environment variables...');
const requiredEnvVars = [
  'MY_INSTANCE_URL',
  'MY_INSTANCE_USERNAME',
  'MY_INSTANCE_PASSWORD',
  'FORVIS_INSTANCE_URL',
  'FORVIS_INSTANCE_USERNAME',
  'FORVIS_INSTANCE_PASSWORD',
];

requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    console.log(`   ❌ Missing: ${varName}`);
    errors++;
  } else {
    const value = varName.includes('PASSWORD') ? '***' : process.env[varName];
    console.log(`   ✅ ${varName} = ${value}`);
  }
});

console.log('');

// Test 2: Check tool directories
console.log('2️⃣  Checking tool directories...');
const TOOLS_BASE = path.join(__dirname, '..');
const tools = {
  "script-checker": path.join(TOOLS_BASE, "servicenow-script-checker"),
  "data-loader": path.join(TOOLS_BASE, "servicenow-data-loader"),
  "ux-analyzer": path.join(TOOLS_BASE, "ServiceNow-UX-Analyzer"),
  "taxonomy-helper": path.join(TOOLS_BASE, "servicenow-taxonomy-helper"),
};

Object.entries(tools).forEach(([name, toolPath]) => {
  if (fs.existsSync(toolPath)) {
    console.log(`   ✅ ${name}: ${toolPath}`);
    
    // Check for package.json
    const packagePath = path.join(toolPath, 'package.json');
    if (!fs.existsSync(packagePath)) {
      console.log(`      ⚠️  No package.json found`);
      warnings++;
    }
  } else {
    console.log(`   ❌ ${name}: NOT FOUND at ${toolPath}`);
    errors++;
  }
});

console.log('');

// Test 3: Check entry points
console.log('3️⃣  Checking tool entry points...');
const entryPoints = {
  "script-checker": path.join(tools["script-checker"], "dist", "index.js"),
  "data-loader": path.join(tools["data-loader"], "src", "index.js"),
  "ux-analyzer": path.join(tools["ux-analyzer"], "analyze-servicenow.js"),
  "taxonomy-helper": path.join(tools["taxonomy-helper"], "core", "analyze.js"),
};

Object.entries(entryPoints).forEach(([name, entryPath]) => {
  if (fs.existsSync(entryPath)) {
    console.log(`   ✅ ${name}: ${path.basename(entryPath)}`);
  } else {
    console.log(`   ❌ ${name}: Entry point not found`);
    if (name === 'script-checker') {
      console.log(`      💡 Run 'npm run build' in servicenow-script-checker`);
    }
    errors++;
  }
});

console.log('');

// Test 4: Check .env file
console.log('4️⃣  Checking configuration files...');
const envPath = path.join(__dirname, '.env');
const envExamplePath = path.join(__dirname, '.env.example');

if (fs.existsSync(envPath)) {
  console.log('   ✅ .env file exists');
} else {
  console.log('   ❌ .env file not found');
  console.log('      💡 Copy .env.example to .env and configure');
  errors++;
}

if (fs.existsSync(envExamplePath)) {
  console.log('   ✅ .env.example exists');
} else {
  console.log('   ⚠️  .env.example not found');
  warnings++;
}

console.log('');

// Test 5: Check MCP SDK
console.log('5️⃣  Checking dependencies...');
try {
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  const hasMCP = packageJson.dependencies['@modelcontextprotocol/sdk'];
  if (hasMCP) {
    console.log(`   ✅ MCP SDK installed (${hasMCP})`);
  } else {
    console.log('   ❌ MCP SDK not in dependencies');
    errors++;
  }
  
  // Check if node_modules exists
  if (fs.existsSync(path.join(__dirname, 'node_modules'))) {
    console.log('   ✅ node_modules exists');
  } else {
    console.log('   ❌ node_modules not found');
    console.log('      💡 Run: npm install');
    errors++;
  }
} catch (error) {
  console.log('   ❌ Error reading package.json');
  errors++;
}

console.log('');

// Summary
console.log('='.repeat(50));
console.log('\n📊 Test Summary:\n');

if (errors === 0 && warnings === 0) {
  console.log('✅ All tests passed! Your orchestrator is ready to use.');
  console.log('\nNext steps:');
  console.log('1. Add to ~/.claude.json:');
  console.log('   {');
  console.log('     "mcpServers": {');
  console.log('       "servicenow-orchestrator": {');
  console.log('         "command": "node",');
  console.log('         "args": ["C:\\Coding Projects\\servicenow-mcp-doc\\server.js"]');
  console.log('       }');
  console.log('     }');
  console.log('   }');
  console.log('\n2. Restart Claude Code');
  console.log('\n3. Try: "Get the last 5 incidents from my-instance"');
} else {
  console.log(`❌ ${errors} error(s) found`);
  console.log(`⚠️  ${warnings} warning(s) found`);
  console.log('\nPlease fix the errors above before using the orchestrator.');
  console.log('See ORCHESTRATOR-GUIDE.md for detailed setup instructions.');
}

console.log('');

process.exit(errors > 0 ? 1 : 0);
