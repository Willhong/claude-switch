#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const testsDir = __dirname;
const testFiles = fs
    .readdirSync(testsDir)
    .filter((f) => f.startsWith('test-') && f.endsWith('.js'))
    .sort();

console.log(`\nRunning ${testFiles.length} test file(s)...\n`);

let totalPassed = 0;
let totalFailed = 0;

for (const file of testFiles) {
    const filePath = path.join(testsDir, file);
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Running: ${file}`);
    console.log('='.repeat(60));

    try {
        execSync(`node "${filePath}"`, { stdio: 'inherit', timeout: 60000 });
        totalPassed++;
        // eslint-disable-next-line no-unused-vars
    } catch (err) {
        totalFailed++;
        console.log(`\n>>> FAILED: ${file}`);
    }
}

console.log(`\n${'='.repeat(60)}`);
console.log(
    `Test Runner Results: ${totalPassed} files passed, ${totalFailed} files failed (${testFiles.length} total)`
);
console.log('='.repeat(60));

process.exit(totalFailed > 0 ? 1 : 0);
