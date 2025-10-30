#!/usr/bin/env node

import { randomBytes } from 'crypto';

/**
 * Generate a cryptographically secure random token for AUTH_TOKEN
 * Usage: npm run generate-token
 */

function generateToken(length: number = 32): string {
  return randomBytes(length).toString('base64url');
}

const token = generateToken();

console.log('\n🔐 Generated AUTH_TOKEN:');
console.log('━'.repeat(60));
console.log(token);
console.log('━'.repeat(60));
console.log('\nAdd this to your .env file:');
console.log(`AUTH_TOKEN=${token}`);
console.log('\n⚠️  Keep this token secure and never commit it to git!');
console.log('\nAlternatively, generate with OpenSSL:');
console.log('  openssl rand -hex 32\n');
