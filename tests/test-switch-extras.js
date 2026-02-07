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

function createSwitchableProfile(sandbox, name, options = {}) {
    const dir = path.join(sandbox.claudeDir, 'profiles', name);
    fs.mkdirSync(dir, { recursive: true });
    for (const d of ['commands', 'skills', 'agents']) {
        fs.mkdirSync(path.join(dir, d), { recursive: true });
    }

    const profile = {
        name,
        description: `Test ${name}`,
        createdAt: new Date().toISOString(),
        settings: {
            enabledPlugins: { 'claude-switch@claude-switch': true },
            hooks: options.hooks || {},
            statusLine: options.statusLine || null,
            env: options.env || {},
            permissions: options.permissions || { defaultMode: 'default' },
            alwaysThinkingEnabled: true,
            autoUpdatesChannel: 'latest'
        },
        mcpServers: options.mcpServers || {},
        components: {
            commands: { mode: 'all', include: [] },
            skills: { mode: 'all', include: [] },
            agents: { mode: 'all', include: [] }
        }
    };
    fs.writeFileSync(path.join(dir, 'profile.json'), JSON.stringify(profile, null, 2));

    if (options.claudeMd) {
        fs.writeFileSync(path.join(dir, 'CLAUDE.md'), options.claudeMd);
    }

    const metaPath = path.join(sandbox.claudeDir, 'profiles', 'profiles.json');
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    if (!meta.profiles.includes(name)) {
        meta.profiles.push(name);
        fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
    }
}

// Ensure the current profile has proper settings for self-preservation
function fixCurrentProfile(sandbox) {
    const profPath = path.join(sandbox.claudeDir, 'profiles', 'current', 'profile.json');
    const profile = JSON.parse(fs.readFileSync(profPath, 'utf-8'));
    profile.settings = profile.settings || {};
    profile.settings.enabledPlugins = profile.settings.enabledPlugins || {};
    profile.settings.enabledPlugins['claude-switch@claude-switch'] = true;
    profile.settings.hooks = profile.settings.hooks || {};
    profile.settings.statusLine = profile.settings.statusLine || null;
    profile.settings.env = profile.settings.env || {};
    profile.settings.permissions = profile.settings.permissions || { defaultMode: 'default' };
    profile.settings.alwaysThinkingEnabled = profile.settings.alwaysThinkingEnabled ?? true;
    profile.settings.autoUpdatesChannel = profile.settings.autoUpdatesChannel || 'latest';
    profile.mcpServers = profile.mcpServers || {};
    profile.components = profile.components || {
        commands: { mode: 'all', include: [] },
        skills: { mode: 'all', include: [] },
        agents: { mode: 'all', include: [] }
    };
    fs.writeFileSync(profPath, JSON.stringify(profile, null, 2));
}

console.log('=== Switch Extras Tests (CLAUDE.md & MCP) ===');

// Test 1: CLAUDE.md is copied to target during switch
function testClaudeMdCopiedOnSwitch() {
    console.log('\n[Test] CLAUDE.md copied during switch');
    const sandbox = createTestSandbox();
    fixProfilesMeta(sandbox);
    fixCurrentProfile(sandbox);

    createSwitchableProfile(sandbox, 'with-claudemd', {
        claudeMd: '# Target CLAUDE.md\nSpecial instructions'
    });

    try {
        const result = sandbox.run('switch with-claudemd');
        assert(result.ok, 'Switch succeeds');

        const claudeMdPath = path.join(sandbox.claudeDir, 'CLAUDE.md');
        assert(fs.existsSync(claudeMdPath), 'CLAUDE.md exists after switch');
        assert(
            fs.readFileSync(claudeMdPath, 'utf-8') === '# Target CLAUDE.md\nSpecial instructions',
            'CLAUDE.md content from target profile'
        );
    } finally {
        sandbox.cleanup();
    }
}

// Test 2: CLAUDE.md is removed if target profile has none
function testClaudeMdRemovedWhenTargetHasNone() {
    console.log('\n[Test] CLAUDE.md removed when target has none');
    const sandbox = createTestSandbox();
    fixProfilesMeta(sandbox);
    fixCurrentProfile(sandbox);

    // Put a CLAUDE.md in the root
    fs.writeFileSync(path.join(sandbox.claudeDir, 'CLAUDE.md'), '# Old instructions');

    // Create profile WITHOUT CLAUDE.md
    createSwitchableProfile(sandbox, 'no-claudemd', {});

    try {
        const result = sandbox.run('switch no-claudemd');
        assert(result.ok, 'Switch succeeds');

        const claudeMdPath = path.join(sandbox.claudeDir, 'CLAUDE.md');
        assert(!fs.existsSync(claudeMdPath), 'CLAUDE.md removed after switch');
    } finally {
        sandbox.cleanup();
    }
}

// Test 3: MCP servers are written during switch
function testMcpServersWrittenOnSwitch() {
    console.log('\n[Test] MCP servers written during switch');
    const sandbox = createTestSandbox();
    fixProfilesMeta(sandbox);
    fixCurrentProfile(sandbox);

    createSwitchableProfile(sandbox, 'with-mcp', {
        mcpServers: {
            'my-mcp': { command: 'npx', args: ['-y', 'my-mcp-server'] }
        }
    });

    try {
        const result = sandbox.run('switch with-mcp');
        assert(result.ok, 'Switch succeeds');

        // Check CLAUDE_JSON (sandbox.claudeJson)
        const claudeJson = JSON.parse(fs.readFileSync(sandbox.claudeJson, 'utf-8'));
        assert(claudeJson.mcpServers['my-mcp'] !== undefined, 'MCP server written to claude.json');
        assert(claudeJson.mcpServers['my-mcp'].command === 'npx', 'MCP server details correct');
    } finally {
        sandbox.cleanup();
    }
}

// Test 4: CLAUDE.md synced back to active profile before switch
function testClaudeMdSyncedBeforeSwitch() {
    console.log('\n[Test] CLAUDE.md synced back before switch');
    const sandbox = createTestSandbox();
    fixProfilesMeta(sandbox);
    fixCurrentProfile(sandbox);

    // Modify CLAUDE.md after export (simulating user editing it)
    fs.writeFileSync(path.join(sandbox.claudeDir, 'CLAUDE.md'), '# Modified by user');

    // Create target profile
    createSwitchableProfile(sandbox, 'sync-test', {});

    try {
        const result = sandbox.run('switch sync-test');
        assert(result.ok, 'Switch succeeds');

        // Check that 'current' profile now has the modified CLAUDE.md
        const currentClaudeMd = path.join(sandbox.claudeDir, 'profiles', 'current', 'CLAUDE.md');
        assert(fs.existsSync(currentClaudeMd), 'CLAUDE.md synced back to current profile');
        assert(fs.readFileSync(currentClaudeMd, 'utf-8') === '# Modified by user', 'CLAUDE.md content synced back');
    } finally {
        sandbox.cleanup();
    }
}

// Test 5: MCP servers synced back before switch
function testMcpServersSyncedBeforeSwitch() {
    console.log('\n[Test] MCP servers synced back before switch');
    const sandbox = createTestSandbox();
    fixProfilesMeta(sandbox);
    fixCurrentProfile(sandbox);

    // Set up MCP servers in claude.json (simulating user adding one)
    fs.writeFileSync(
        sandbox.claudeJson,
        JSON.stringify(
            {
                mcpServers: { 'user-added-mcp': { command: 'node', args: ['server.js'] } }
            },
            null,
            2
        )
    );

    createSwitchableProfile(sandbox, 'mcp-sync-test', {});

    try {
        const result = sandbox.run('switch mcp-sync-test');
        assert(result.ok, 'Switch succeeds');

        // Check that 'current' profile now has the user-added MCP server
        const currentProfile = JSON.parse(
            fs.readFileSync(path.join(sandbox.claudeDir, 'profiles', 'current', 'profile.json'), 'utf-8')
        );
        assert(currentProfile.mcpServers['user-added-mcp'] !== undefined, 'MCP server synced back to current profile');
    } finally {
        sandbox.cleanup();
    }
}

try {
    testClaudeMdCopiedOnSwitch();
    testClaudeMdRemovedWhenTargetHasNone();
    testMcpServersWrittenOnSwitch();
    testClaudeMdSyncedBeforeSwitch();
    testMcpServersSyncedBeforeSwitch();
} catch (err) {
    console.error('Unexpected error:', err);
}

const exitCode = printResults();
process.exit(exitCode);
