#!/usr/bin/env node
/**
 * One-time setup: opens a browser, lets you log in via Google OAuth,
 * then saves the session cookies to playwright/.auth/user.json.
 *
 * Usage: npm run playwright:auth
 * Requires the dev server to be running: npm run dev
 */

import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const AUTH_DIR = path.join(ROOT, 'playwright', '.auth');
const AUTH_FILE = path.join(AUTH_DIR, 'user.json');
const LOGIN_URL = 'http://localhost:3000/login';
const TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

if (!existsSync(AUTH_DIR)) {
  await mkdir(AUTH_DIR, { recursive: true });
}

console.log('Launching browser...');
const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();

console.log(`Navigating to ${LOGIN_URL}`);
console.log('Please log in with Google. The browser will close automatically when done.\n');

await page.goto(LOGIN_URL);

// Poll until the URL moves away from /login (OAuth redirect completes)
const deadline = Date.now() + TIMEOUT_MS;
let loggedIn = false;

while (Date.now() < deadline) {
  await page.waitForTimeout(1000);
  const url = page.url();
  if (!url.includes('/login') && !url.includes('accounts.google.com')) {
    loggedIn = true;
    break;
  }
}

if (!loggedIn) {
  console.error('Timed out waiting for login. Please try again.');
  await browser.close();
  process.exit(1);
}

await page.waitForSelector('text=Here\'s what\'s happening', { timeout: TIMEOUT_MS });
await context.storageState({ path: AUTH_FILE });
console.log(`\nAuth state saved to: ${AUTH_FILE}`);
console.log('Restart Claude Code to reload the Playwright MCP server with the new session.');

await browser.close();
