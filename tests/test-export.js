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

console.log('=== Export Command Tests ===');

function testExportCapturesAllSettings() {
    console.log('\n[Test] Export captures all settings fields');
    const sandbox = createTestSandbox();
    fixProfilesMeta(sandbox);
    try {
        // Set up rich settings
        fs.writeFileSync(
            path.join(sandbox.claudeDir, 'settings.json'),
            JSON.stringify(
                {
                    enabledPlugins: { 'test-plugin@market': true },
                    hooks: { PreToolUse: [{ type: 'command', command: 'test' }] },
                    statusLine: 'My Status',
                    env: { VAR1: 'val1' },
                    permissions: { defaultMode: 'plan' },
                    alwaysThinkingEnabled: false,
                    autoUpdatesChannel: 'stable'
                },
                null,
                2
            )
        );

        const result = sandbox.run('export current');
        assert(result.ok, 'Export succeeds');

        // Read the profile
        const profile = JSON.parse(
            fs.readFileSync(path.join(sandbox.claudeDir, 'profiles', 'current', 'profile.json'), 'utf-8')
        );
        assert(profile.settings.enabledPlugins['test-plugin@market'] === true, 'enabledPlugins captured');
        assert(profile.settings.hooks.PreToolUse !== undefined, 'hooks captured');
        assert(profile.settings.statusLine === 'My Status', 'statusLine captured');
        assert(profile.settings.env.VAR1 === 'val1', 'env captured');
        assert(profile.settings.permissions.defaultMode === 'plan', 'permissions captured');
        assert(profile.settings.alwaysThinkingEnabled === false, 'alwaysThinkingEnabled captured');
        assert(profile.settings.autoUpdatesChannel === 'stable', 'autoUpdatesChannel captured');
    } finally {
        sandbox.cleanup();
    }
}

function testExportCapturesMcpServers() {
    console.log('\n[Test] Export captures MCP servers');
    const sandbox = createTestSandbox();
    fixProfilesMeta(sandbox);
    try {
        // Set up MCP servers in claude.json
        fs.writeFileSync(
            sandbox.claudeJson,
            JSON.stringify(
                {
                    mcpServers: {
                        'test-mcp': { command: 'node', args: ['mcp.js'] }
                    }
                },
                null,
                2
            )
        );

        const result = sandbox.run('export current');
        assert(result.ok, 'Export with MCP succeeds');

        const profile = JSON.parse(
            fs.readFileSync(path.join(sandbox.claudeDir, 'profiles', 'current', 'profile.json'), 'utf-8')
        );
        assert(profile.mcpServers['test-mcp'] !== undefined, 'MCP servers captured');
        assert(profile.mcpServers['test-mcp'].command === 'node', 'MCP server details correct');
    } finally {
        sandbox.cleanup();
    }
}

function testExportCapturesClaudeMd() {
    console.log('\n[Test] Export captures CLAUDE.md when present');
    const sandbox = createTestSandbox();
    fixProfilesMeta(sandbox);
    try {
        // Create CLAUDE.md
        fs.writeFileSync(path.join(sandbox.claudeDir, 'CLAUDE.md'), '# My Instructions');

        const result = sandbox.run('export current');
        assert(result.ok, 'Export succeeds');

        const claudeMd = path.join(sandbox.claudeDir, 'profiles', 'current', 'CLAUDE.md');
        assert(fs.existsSync(claudeMd), 'CLAUDE.md copied to profile');
        assert(fs.readFileSync(claudeMd, 'utf-8') === '# My Instructions', 'CLAUDE.md content correct');
    } finally {
        sandbox.cleanup();
    }
}

function testExportRemovesClaudeMdWhenAbsent() {
    console.log('\n[Test] Export removes CLAUDE.md from profile when absent from source');
    const sandbox = createTestSandbox();
    fixProfilesMeta(sandbox);
    try {
        // First, put a CLAUDE.md in the profile
        fs.writeFileSync(path.join(sandbox.claudeDir, 'profiles', 'current', 'CLAUDE.md'), '# Old');

        // Make sure there's no CLAUDE.md in the root
        const rootClaudeMd = path.join(sandbox.claudeDir, 'CLAUDE.md');
        if (fs.existsSync(rootClaudeMd)) fs.unlinkSync(rootClaudeMd);

        const result = sandbox.run('export current');
        assert(result.ok, 'Export succeeds');

        const profileClaudeMd = path.join(sandbox.claudeDir, 'profiles', 'current', 'CLAUDE.md');
        assert(!fs.existsSync(profileClaudeMd), 'CLAUDE.md removed from profile when absent from source');
    } finally {
        sandbox.cleanup();
    }
}

try {
    testExportCapturesAllSettings();
    testExportCapturesMcpServers();
    testExportCapturesClaudeMd();
    testExportRemovesClaudeMdWhenAbsent();
} catch (err) {
    console.error('Unexpected error:', err);
}

const exitCode = printResults();
process.exit(exitCode);
