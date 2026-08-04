// Jest setup file
// This file loads environment variables from test/test.env before running tests
// This ensures that all tests use consistent, controlled environment values
const dotenv = require('dotenv');
const path = require('path');

// Load test environment variables from test/test.env
// These values will override any existing environment variables for testing
dotenv.config({ path: path.join(__dirname, 'test', 'test.env') });

console.log('🧪 Test environment loaded from test/test.env');
