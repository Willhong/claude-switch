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

function createTestProfile(sandbox, name) {
    const dir = path.join(sandbox.claudeDir, 'profiles', name);
    fs.mkdirSync(dir, { recursive: true });
    for (const d of ['commands', 'skills', 'agents']) {
        fs.mkdirSync(path.join(dir, d), { recursive: true });
    }
    fs.writeFileSync(
        path.join(dir, 'profile.json'),
        JSON.stringify(
            {
                name,
                description: `Test profile ${name}`,
                createdAt: new Date().toISOString(),
                settings: { enabledPlugins: {} },
                mcpServers: {}
            },
            null,
            2
        )
    );
    // Add to profiles.json
    const metaPath = path.join(sandbox.claudeDir, 'profiles', 'profiles.json');
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    if (!meta.profiles.includes(name)) {
        meta.profiles.push(name);
        fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
    }
}

console.log('=== Rename Command Tests ===');

function testSuccessfulRename() {
    console.log('\n[Test] Successful rename');
    const sandbox = createTestSandbox();
    fixProfilesMeta(sandbox);
    createTestProfile(sandbox, 'old-name');
    try {
        const result = sandbox.run('rename old-name new-name');
        assert(result.ok, 'Rename succeeds');

        // Old directory gone, new exists
        assert(!fs.existsSync(path.join(sandbox.claudeDir, 'profiles', 'old-name')), 'Old dir removed');
        assert(fs.existsSync(path.join(sandbox.claudeDir, 'profiles', 'new-name')), 'New dir created');

        // profile.json updated
        const profile = JSON.parse(
            fs.readFileSync(path.join(sandbox.claudeDir, 'profiles', 'new-name', 'profile.json'), 'utf-8')
        );
        assert(profile.name === 'new-name', 'profile.json name updated');

        // profiles.json updated
        const meta = JSON.parse(fs.readFileSync(path.join(sandbox.claudeDir, 'profiles', 'profiles.json'), 'utf-8'));
        assert(meta.profiles.includes('new-name'), 'profiles.json has new name');
        assert(!meta.profiles.includes('old-name'), 'profiles.json removed old name');
    } finally {
        sandbox.cleanup();
    }
}

function testRenameActiveProfile() {
    console.log('\n[Test] Rename active profile');
    const sandbox = createTestSandbox();
    fixProfilesMeta(sandbox);
    createTestProfile(sandbox, 'my-active');
    // Set as active
    const metaPath = path.join(sandbox.claudeDir, 'profiles', 'profiles.json');
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    meta.activeProfile = 'my-active';
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));

    try {
        const result = sandbox.run('rename my-active renamed-active');
        assert(result.ok, 'Rename active profile succeeds');

        const updatedMeta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        assert(updatedMeta.activeProfile === 'renamed-active', 'activeProfile updated');
    } finally {
        sandbox.cleanup();
    }
}

function testCannotRenameCurrent() {
    console.log('\n[Test] Cannot rename current');
    const sandbox = createTestSandbox();
    fixProfilesMeta(sandbox);
    try {
        const result = sandbox.run('rename current something');
        assert(!result.ok, 'Cannot rename current');
    } finally {
        sandbox.cleanup();
    }
}

function testCannotRenameToExisting() {
    console.log('\n[Test] Cannot rename to existing name');
    const sandbox = createTestSandbox();
    fixProfilesMeta(sandbox);
    createTestProfile(sandbox, 'profile-a');
    createTestProfile(sandbox, 'profile-b');
    try {
        const result = sandbox.run('rename profile-a profile-b');
        assert(!result.ok, 'Cannot rename to existing name');
    } finally {
        sandbox.cleanup();
    }
}

function testInvalidNewName() {
    console.log('\n[Test] Invalid new name rejected');
    const sandbox = createTestSandbox();
    fixProfilesMeta(sandbox);
    createTestProfile(sandbox, 'valid-old');
    try {
        const result = sandbox.run('rename valid-old "bad name!"');
        assert(!result.ok, 'Invalid new name rejected');
    } finally {
        sandbox.cleanup();
    }
}

try {
    testSuccessfulRename();
    testRenameActiveProfile();
    testCannotRenameCurrent();
    testCannotRenameToExisting();
    testInvalidNewName();
} catch (err) {
    console.error('Unexpected error:', err);
}

const exitCode = printResults();
process.exit(exitCode);
