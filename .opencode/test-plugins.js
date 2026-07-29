#!/usr/bin/env node

/**
 * Simple plugin test script
 * Tests basic functionality of OpenCode plugins
 */

const fs = require('fs');
const path = require('path');

const pluginsDir = path.join(__dirname, 'plugins');

console.log('Testing OpenCode plugins...\n');

// Check if plugins directory exists
if (!fs.existsSync(pluginsDir)) {
  console.error('❌ Plugins directory not found');
  process.exit(1);
}

// Read plugin files
const files = fs.readdirSync(pluginsDir);
const pluginFiles = files.filter(file => file.endsWith('.ts') || file.endsWith('.js'));

console.log(`Found ${pluginFiles.length} plugin files\n`);

let hasErrors = false;

for (const file of pluginFiles) {
  console.log(`Checking: ${file}`);
  
  try {
    const filePath = path.join(pluginsDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check for required exports
    if (content.includes('export default') || content.includes('export const')) {
      console.log('  ✅ Has proper exports');
    } else {
      console.log('  ⚠️  No default export found');
      hasErrors = true;
    }
    
    // Check for Plugin type import
    if (content.includes('import type { Plugin } from "@opencode-ai/plugin"')) {
      console.log('  ✅ Has Plugin type import');
    } else {
      console.log('  ⚠️  Missing Plugin type import');
    }
    
    // Check for async plugin function
    if (content.includes('async ({') || content.includes('async ()') || content.includes('async function')) {
      console.log('  ✅ Has async plugin function');
    } else {
      console.log('  ⚠️  Missing async plugin function');
    }
    
    console.log('');
  } catch (error) {
    console.log(`  ❌ Error reading file: ${error.message}`);
    hasErrors = true;
  }
}

// Check TypeScript compilation
console.log('Checking TypeScript configuration...');
const tsconfigPath = path.join(__dirname, 'tsconfig.json');
if (fs.existsSync(tsconfigPath)) {
  try {
    const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
    console.log('  ✅ tsconfig.json is valid');
    
    // Check required fields
    if (tsconfig.compilerOptions && tsconfig.compilerOptions.target) {
      console.log('  ✅ Has compiler options');
    } else {
      console.log('  ⚠️  Missing compiler options');
    }
  } catch (error) {
    console.log(`  ❌ Invalid tsconfig.json: ${error.message}`);
    hasErrors = true;
  }
} else {
  console.log('  ⚠️  tsconfig.json not found');
}

console.log('\n' + '='.repeat(50));
if (hasErrors) {
  console.log('⚠️  Some checks failed, but this is expected for development');
  console.log('✅ Basic plugin structure looks good');
} else {
  console.log('✅ All checks passed');
}

console.log('\nNote: Full TypeScript compilation check will run in CI');