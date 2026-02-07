#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { createTestSandbox, assert, printResults } = require('./test-helpers');

function fixProfilesMeta(sandbox) {
    const metaPath = path.join(sandbox.claudeDir, 'profiles', 'profiles.json');
    fs.writeFileSync(
        metaPath,
        JSON.stringify(
            {
                activeProfile: 'current',
                profiles: ['current']
            },
            null,
            2
        )
    );
}

console.log('=== Input Sanitization Tests ===');

function testDescriptionCapped() {
    console.log('\n[Test] Description capped at 200 chars');
    const sandbox = createTestSandbox();
    fixProfilesMeta(sandbox);
    try {
        const longDesc = 'a'.repeat(300);
        const result = sandbox.run(`create cap-test --desc="${longDesc}"`);
        assert(result.ok, 'Create with long desc succeeds');

        const profile = JSON.parse(
            fs.readFileSync(path.join(sandbox.claudeDir, 'profiles', 'cap-test', 'profile.json'), 'utf-8')
        );
        assert(profile.description.length <= 200, `Description capped (got ${profile.description.length})`);
    } finally {
        sandbox.cleanup();
    }
}

function testNormalDescriptionPreserved() {
    console.log('\n[Test] Normal description preserved');
    const sandbox = createTestSandbox();
    fixProfilesMeta(sandbox);
    try {
        const result = sandbox.run('create normal-test --desc="My great profile (v2.0)"');
        assert(result.ok, 'Create with normal desc succeeds');

        const profile = JSON.parse(
            fs.readFileSync(path.join(sandbox.claudeDir, 'profiles', 'normal-test', 'profile.json'), 'utf-8')
        );
        assert(profile.description === 'My great profile (v2.0)', 'Normal description preserved');
    } finally {
        sandbox.cleanup();
    }
}

function testProfileNameLengthLimit() {
    console.log('\n[Test] Profile name length limit (create)');
    const sandbox = createTestSandbox();
    fixProfilesMeta(sandbox);
    try {
        const longName = 'a'.repeat(60);
        const result = sandbox.run(`create ${longName}`);
        assert(!result.ok, 'Name over 50 chars rejected on create');
    } finally {
        sandbox.cleanup();
    }
}

function testProfileNameLengthLimitRename() {
    console.log('\n[Test] Profile name length limit (rename)');
    const sandbox = createTestSandbox();
    fixProfilesMeta(sandbox);
    try {
        // Create a short-named profile first
        const result1 = sandbox.run('create short-name');
        assert(result1.ok, 'Short name profile created');

        const longName = 'b'.repeat(60);
        const result2 = sandbox.run(`rename short-name ${longName}`);
        assert(!result2.ok, 'Name over 50 chars rejected on rename');
    } finally {
        sandbox.cleanup();
    }
}

function testShortNameAccepted() {
    console.log('\n[Test] Name at 50 chars accepted');
    const sandbox = createTestSandbox();
    fixProfilesMeta(sandbox);
    try {
        const name50 = 'a'.repeat(50);
        const result = sandbox.run(`create ${name50}`);
        assert(result.ok, 'Name at exactly 50 chars accepted');
    } finally {
        sandbox.cleanup();
    }
}

try {
    testDescriptionCapped();
    testNormalDescriptionPreserved();
    testProfileNameLengthLimit();
    testProfileNameLengthLimitRename();
    testShortNameAccepted();
} catch (err) {
    console.error('Unexpected error:', err);
}

const exitCode = printResults();
process.exit(exitCode);
