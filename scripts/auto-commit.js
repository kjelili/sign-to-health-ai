#!/usr/bin/env node

/**
 * Auto-commit script
 * Watches for file changes and automatically commits them
 * 
 * Usage:
 *   node scripts/auto-commit.js
 *   npm run auto-commit
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const COMMIT_INTERVAL = 60000; // 60 seconds
const PROJECT_ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const ONCE_MODE = args.includes('--once');

let lastCommitTime = Date.now();
let pendingChanges = false;

function getCommitMessage() {
  const date = new Date().toISOString().replace('T', ' ').substring(0, 19);
  return `Auto-commit: ${date}`;
}

function hasChanges() {
  try {
    const status = execSync('git status --porcelain', { 
      cwd: PROJECT_ROOT,
      encoding: 'utf-8'
    });
    return status.trim().length > 0;
  } catch (error) {
    return false;
  }
}

function commitChanges() {
  if (!hasChanges()) {
    console.log('No changes to commit');
    return;
  }

  try {
    console.log('📝 Staging changes...');
    execSync('git add .', { cwd: PROJECT_ROOT, stdio: 'inherit' });
    
    console.log('💾 Committing changes...');
    const message = getCommitMessage();
    execSync(`git commit -m "${message}"`, { 
      cwd: PROJECT_ROOT, 
      stdio: 'inherit' 
    });
    
    console.log('✅ Committed:', message);
    lastCommitTime = Date.now();
    pendingChanges = false;
  } catch (error) {
    console.error('❌ Commit failed:', error.message);
  }
}

function checkAndCommit() {
  if (hasChanges()) {
    if (!pendingChanges) {
      console.log('🔍 Changes detected, will commit in', COMMIT_INTERVAL / 1000, 'seconds...');
      pendingChanges = true;
    }
    
    // Commit if enough time has passed
    if (Date.now() - lastCommitTime >= COMMIT_INTERVAL) {
      commitChanges();
    }
  }
}

// Run once or watch mode
if (ONCE_MODE) {
  // Single commit mode
  commitChanges();
} else {
  // Watch mode
  console.log('🚀 Auto-commit watcher started');
  console.log('⏱️  Commit interval:', COMMIT_INTERVAL / 1000, 'seconds');
  console.log('📁 Watching:', PROJECT_ROOT);
  console.log('Press Ctrl+C to stop\n');

  // Check immediately
  checkAndCommit();

  // Check every 10 seconds
  setInterval(checkAndCommit, 10000);
}
