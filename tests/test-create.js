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

console.log('=== Create Command Tests ===');

// Test 1: Basic create
function testBasicCreate() {
    console.log('\n[Test] Basic create');
    const sandbox = createTestSandbox();
    fixProfilesMeta(sandbox);
    try {
        const result = sandbox.run('create test-basic --desc="Basic test"');
        assert(result.ok, 'Create succeeds');
        assert(result.output?.profile?.name === 'test-basic', 'Profile name correct');

        // Verify profile directory created
        const profileDir = path.join(sandbox.claudeDir, 'profiles', 'test-basic');
        assert(fs.existsSync(profileDir), 'Profile directory created');

        // Verify profile.json
        const profile = JSON.parse(fs.readFileSync(path.join(profileDir, 'profile.json'), 'utf-8'));
        assert(profile.name === 'test-basic', 'profile.json name correct');
        assert(profile.description === 'Basic test', 'Description correct');

        // Verify component dirs
        assert(fs.existsSync(path.join(profileDir, 'commands')), 'commands dir created');
        assert(fs.existsSync(path.join(profileDir, 'skills')), 'skills dir created');
        assert(fs.existsSync(path.join(profileDir, 'agents')), 'agents dir created');
    } finally {
        sandbox.cleanup();
    }
}

// Test 2: --from-current copies everything
function testFromCurrent() {
    console.log('\n[Test] Create --from-current');
    const sandbox = createTestSandbox();
    fixProfilesMeta(sandbox);
    try {
        // Set up some settings in the sandbox
        const settingsPath = path.join(sandbox.claudeDir, 'settings.json');
        fs.writeFileSync(
            settingsPath,
            JSON.stringify(
                {
                    enabledPlugins: { 'test-plugin@test': true },
                    hooks: { PreToolUse: [{ type: 'command', command: 'echo hi' }] },
                    statusLine: '🟢 Test',
                    env: { MY_VAR: 'test' },
                    permissions: { defaultMode: 'bypassPermissions' }
                },
                null,
                2
            )
        );

        const result = sandbox.run('create from-current-test --from-current');
        assert(result.ok, 'Create with --from-current succeeds');

        const profile = JSON.parse(
            fs.readFileSync(path.join(sandbox.claudeDir, 'profiles', 'from-current-test', 'profile.json'), 'utf-8')
        );
        assert(profile.settings.enabledPlugins['test-plugin@test'] === true, 'Plugins copied');
        assert(profile.settings.hooks.PreToolUse !== undefined, 'Hooks copied');
        assert(profile.settings.statusLine === '🟢 Test', 'StatusLine copied');
        assert(profile.settings.env.MY_VAR === 'test', 'Env copied');
        assert(profile.settings.permissions.defaultMode === 'bypassPermissions', 'Permissions copied');
    } finally {
        sandbox.cleanup();
    }
}

// Test 3: --clean creates whitelist mode
function testClean() {
    console.log('\n[Test] Create --clean');
    const sandbox = createTestSandbox();
    fixProfilesMeta(sandbox);
    try {
        const result = sandbox.run('create clean-test --clean');
        assert(result.ok, 'Create with --clean succeeds');

        const profile = JSON.parse(
            fs.readFileSync(path.join(sandbox.claudeDir, 'profiles', 'clean-test', 'profile.json'), 'utf-8')
        );
        assert(profile.components.commands.mode === 'whitelist', 'Commands in whitelist mode');
        assert(profile.components.skills.mode === 'whitelist', 'Skills in whitelist mode');
        assert(profile.components.agents.mode === 'whitelist', 'Agents in whitelist mode');
    } finally {
        sandbox.cleanup();
    }
}

// Test 4: --copy=plugins,hooks copies only specified
function testCopySpecific() {
    console.log('\n[Test] Create --copy=plugins,hooks');
    const sandbox = createTestSandbox();
    fixProfilesMeta(sandbox);
    try {
        const settingsPath = path.join(sandbox.claudeDir, 'settings.json');
        fs.writeFileSync(
            settingsPath,
            JSON.stringify(
                {
                    enabledPlugins: { 'my-plugin@market': true },
                    hooks: { PostToolUse: [{ type: 'command', command: 'echo done' }] },
                    statusLine: 'should not copy',
                    env: { SKIP: 'me' }
                },
                null,
                2
            )
        );

        const result = sandbox.run('create copy-test --copy=plugins,hooks');
        assert(result.ok, 'Create with --copy succeeds');

        const profile = JSON.parse(
            fs.readFileSync(path.join(sandbox.claudeDir, 'profiles', 'copy-test', 'profile.json'), 'utf-8')
        );
        assert(profile.settings.enabledPlugins['my-plugin@market'] === true, 'Plugins copied');
        assert(profile.settings.hooks.PostToolUse !== undefined, 'Hooks copied');
        assert(profile.settings.statusLine === null, 'StatusLine NOT copied (null default)');
        assert(Object.keys(profile.settings.env).length === 0, 'Env NOT copied (empty default)');
    } finally {
        sandbox.cleanup();
    }
}

// Test 5: --copy=all copies everything
function testCopyAll() {
    console.log('\n[Test] Create --copy=all');
    const sandbox = createTestSandbox();
    fixProfilesMeta(sandbox);
    try {
        const settingsPath = path.join(sandbox.claudeDir, 'settings.json');
        fs.writeFileSync(
            settingsPath,
            JSON.stringify(
                {
                    enabledPlugins: { 'all-plugin@test': true },
                    hooks: { Test: ['hook'] },
                    statusLine: 'test-line',
                    env: { ALL_VAR: 'yes' },
                    permissions: { defaultMode: 'plan' }
                },
                null,
                2
            )
        );

        const result = sandbox.run('create all-copy --copy=all');
        assert(result.ok, 'Create with --copy=all succeeds');

        const profile = JSON.parse(
            fs.readFileSync(path.join(sandbox.claudeDir, 'profiles', 'all-copy', 'profile.json'), 'utf-8')
        );
        assert(profile.settings.enabledPlugins['all-plugin@test'] === true, 'All: plugins copied');
        assert(profile.settings.env.ALL_VAR === 'yes', 'All: env copied');
    } finally {
        sandbox.cleanup();
    }
}

// Test 6: Invalid copy items throw error
function testInvalidCopyItems() {
    console.log('\n[Test] Create with invalid --copy items');
    const sandbox = createTestSandbox();
    fixProfilesMeta(sandbox);
    try {
        const result = sandbox.run('create bad-copy --copy=plugins,baditem');
        assert(!result.ok, 'Invalid copy items rejected');
    } finally {
        sandbox.cleanup();
    }
}

// Test 7: Duplicate name rejection
function testDuplicateName() {
    console.log('\n[Test] Duplicate name rejected');
    const sandbox = createTestSandbox();
    fixProfilesMeta(sandbox);
    try {
        const result = sandbox.run('create current');
        assert(!result.ok, 'Duplicate name rejected');
    } finally {
        sandbox.cleanup();
    }
}

// Test 8: Description default generation
function testDefaultDescription() {
    console.log('\n[Test] Default description');
    const sandbox = createTestSandbox();
    fixProfilesMeta(sandbox);
    try {
        // With copy items, default desc should be "Copied: plugins, hooks"
        const result = sandbox.run('create desc-test --copy=plugins,hooks');
        assert(result.ok, 'Create succeeds');

        const profile = JSON.parse(
            fs.readFileSync(path.join(sandbox.claudeDir, 'profiles', 'desc-test', 'profile.json'), 'utf-8')
        );
        assert(profile.description.startsWith('Copied:'), 'Default desc starts with "Copied:"');

        // Without copy items, default desc should be "Custom profile"
        const result2 = sandbox.run('create desc-test2');
        assert(result2.ok, 'Create without copy succeeds');

        const profile2 = JSON.parse(
            fs.readFileSync(path.join(sandbox.claudeDir, 'profiles', 'desc-test2', 'profile.json'), 'utf-8')
        );
        assert(profile2.description === 'Custom profile', 'Default desc is "Custom profile"');
    } finally {
        sandbox.cleanup();
    }
}

// Test 9: Profile command auto-copy
function testProfileCommandAutoCopy() {
    console.log('\n[Test] Profile command auto-copy');
    const sandbox = createTestSandbox();
    fixProfilesMeta(sandbox);
    try {
        // Create a profile command in the source (current)
        const profileCmdDir = path.join(sandbox.claudeDir, 'profiles', 'current', 'commands', 'profile');
        fs.mkdirSync(profileCmdDir, { recursive: true });
        fs.writeFileSync(path.join(profileCmdDir, 'index.md'), '# Profile Command');

        const result = sandbox.run('create auto-copy-test');
        assert(result.ok, 'Create succeeds');

        const copiedCmd = path.join(sandbox.claudeDir, 'profiles', 'auto-copy-test', 'commands', 'profile', 'index.md');
        assert(fs.existsSync(copiedCmd), 'Profile command auto-copied');
    } finally {
        sandbox.cleanup();
    }
}

// Run all tests
try {
    testBasicCreate();
    testFromCurrent();
    testClean();
    testCopySpecific();
    testCopyAll();
    testInvalidCopyItems();
    testDuplicateName();
    testDefaultDescription();
    testProfileCommandAutoCopy();
} catch (err) {
    console.error('Unexpected error:', err);
}

const exitCode = printResults();
process.exit(exitCode);
