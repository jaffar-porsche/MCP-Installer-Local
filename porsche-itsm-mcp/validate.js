#!/usr/bin/env node

// Simple validation script to check if the server can start
import { createConfig } from './dist/config/index.js';

try {
  console.log('🔍 Validating environment configuration...');
  const config = createConfig();
  console.log('✅ Configuration loaded successfully');
  console.log('📋 Configuration summary:');
  console.log(`   • API Base URL: ${config.api.baseUrl}`);
  console.log(`   • Tenant ID: ${config.auth.tenantId}`);
  console.log(`   • Scope: ${config.auth.scope}`);
  console.log('🚀 Ready to start MCP server!');
} catch (error) {
  console.error('❌ Configuration validation failed:', error.message);
  console.error('💡 Make sure to:');
  console.error('   1. Copy .env.example to .env');
  console.error('   2. Fill in all required environment variables');
  console.error('   3. Ensure your credentials are valid');
  process.exit(1);
}
