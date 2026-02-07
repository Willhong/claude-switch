#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { createTestSandbox, assert, printResults } = require('./test-helpers');

// Helper: set up sandbox with active profile and target profiles
function setupSpreadTest() {
    const sandbox = createTestSandbox();

    // Create a second profile "target1" directly in the sandbox
    const target1Dir = path.join(sandbox.claudeDir, 'profiles', 'target1');
    fs.mkdirSync(target1Dir, { recursive: true });
    for (const d of ['commands', 'skills', 'agents']) {
        fs.mkdirSync(path.join(target1Dir, d), { recursive: true });
    }
    fs.writeFileSync(
        path.join(target1Dir, 'profile.json'),
        JSON.stringify(
            {
                name: 'target1',
                description: 'Target 1',
                createdAt: new Date().toISOString(),
                settings: { enabledPlugins: {}, hooks: {}, env: {}, permissions: { defaultMode: 'default' } },
                mcpServers: {}
            },
            null,
            2
        )
    );

    // Create a third profile "target2"
    const target2Dir = path.join(sandbox.claudeDir, 'profiles', 'target2');
    fs.mkdirSync(target2Dir, { recursive: true });
    for (const d of ['commands', 'skills', 'agents']) {
        fs.mkdirSync(path.join(target2Dir, d), { recursive: true });
    }
    fs.writeFileSync(
        path.join(target2Dir, 'profile.json'),
        JSON.stringify(
            {
                name: 'target2',
                description: 'Target 2',
                createdAt: new Date().toISOString(),
                settings: { enabledPlugins: {}, hooks: {}, env: {}, permissions: { defaultMode: 'default' } },
                mcpServers: {}
            },
            null,
            2
        )
    );

    // Update profiles.json to include targets (must be array of strings)
    const profilesJsonPath = path.join(sandbox.claudeDir, 'profiles', 'profiles.json');
    const profilesJson = {
        activeProfile: 'current',
        profiles: ['current', 'target1', 'target2']
    };
    fs.writeFileSync(profilesJsonPath, JSON.stringify(profilesJson, null, 2));

    return sandbox;
}

console.log('=== Spread Command Tests ===');

// Test 1: Component spread - commands (md file)
function testSpreadCommandMdFile() {
    console.log('\n[Test] Spread command - .md file');
    const sandbox = setupSpreadTest();
    try {
        // Create a command .md file in active profile's commands dir
        const cmdDir = path.join(sandbox.claudeDir, 'profiles', 'current', 'commands');
        fs.writeFileSync(path.join(cmdDir, 'test-cmd.md'), '# Test Command\nDo something');

        const result = sandbox.run('spread commands test-cmd --all');
        assert(result.ok, 'Spread command succeeds');

        // Verify file was copied to targets
        const t1File = path.join(sandbox.claudeDir, 'profiles', 'target1', 'commands', 'test-cmd.md');
        const t2File = path.join(sandbox.claudeDir, 'profiles', 'target2', 'commands', 'test-cmd.md');
        assert(fs.existsSync(t1File), 'File copied to target1');
        assert(fs.existsSync(t2File), 'File copied to target2');
        assert(fs.readFileSync(t1File, 'utf-8') === '# Test Command\nDo something', 'Content matches');
    } finally {
        sandbox.cleanup();
    }
}

// Test 2: Component spread - commands (directory)
function testSpreadCommandDirectory() {
    console.log('\n[Test] Spread command - directory');
    const sandbox = setupSpreadTest();
    try {
        const cmdDir = path.join(sandbox.claudeDir, 'profiles', 'current', 'commands', 'my-dir-cmd');
        fs.mkdirSync(cmdDir, { recursive: true });
        fs.writeFileSync(path.join(cmdDir, 'index.md'), '# Dir Command');
        fs.writeFileSync(path.join(cmdDir, 'helper.md'), '# Helper');

        const result = sandbox.run('spread commands my-dir-cmd --all');
        assert(result.ok, 'Spread directory command succeeds');

        const t1Dir = path.join(sandbox.claudeDir, 'profiles', 'target1', 'commands', 'my-dir-cmd');
        assert(fs.existsSync(t1Dir), 'Directory copied to target1');
        assert(fs.existsSync(path.join(t1Dir, 'index.md')), 'File inside dir copied');
        assert(fs.existsSync(path.join(t1Dir, 'helper.md')), 'Second file inside dir copied');
    } finally {
        sandbox.cleanup();
    }
}

// Test 3: Component spread - skills (.skill file)
function testSpreadSkillFile() {
    console.log('\n[Test] Spread skill - .skill file');
    const sandbox = setupSpreadTest();
    try {
        const skillDir = path.join(sandbox.claudeDir, 'profiles', 'current', 'skills');
        fs.writeFileSync(path.join(skillDir, 'my-skill.skill'), 'skill content');

        const result = sandbox.run('spread skills my-skill --profiles=target1');
        assert(result.ok, 'Spread skill succeeds');

        const t1File = path.join(sandbox.claudeDir, 'profiles', 'target1', 'skills', 'my-skill.skill');
        assert(fs.existsSync(t1File), '.skill file copied to target1');

        // Should NOT be in target2
        const t2File = path.join(sandbox.claudeDir, 'profiles', 'target2', 'skills', 'my-skill.skill');
        assert(!fs.existsSync(t2File), '.skill file NOT in target2 (not targeted)');
    } finally {
        sandbox.cleanup();
    }
}

// Test 4: --force overwrite behavior
function testSpreadForce() {
    console.log('\n[Test] Spread --force overwrite');
    const sandbox = setupSpreadTest();
    try {
        // Create source and existing target
        const srcDir = path.join(sandbox.claudeDir, 'profiles', 'current', 'commands');
        fs.writeFileSync(path.join(srcDir, 'existing.md'), 'NEW content');

        const tgtDir = path.join(sandbox.claudeDir, 'profiles', 'target1', 'commands');
        fs.writeFileSync(path.join(tgtDir, 'existing.md'), 'OLD content');

        // Without force - should skip
        const result1 = sandbox.run('spread commands existing --profiles=target1');
        assert(result1.ok, 'Spread without force succeeds');
        assert(
            fs.readFileSync(path.join(tgtDir, 'existing.md'), 'utf-8') === 'OLD content',
            'Without force: not overwritten'
        );

        // With force - should overwrite
        const result2 = sandbox.run('spread commands existing --profiles=target1 --force');
        assert(result2.ok, 'Spread with force succeeds');
        assert(fs.readFileSync(path.join(tgtDir, 'existing.md'), 'utf-8') === 'NEW content', 'With force: overwritten');
    } finally {
        sandbox.cleanup();
    }
}

// Test 5: Keyed spread - hooks
function testSpreadHooks() {
    console.log('\n[Test] Spread keyed - hooks');
    const sandbox = setupSpreadTest();
    try {
        // Add a hook to active profile
        const profilePath = path.join(sandbox.claudeDir, 'profiles', 'current', 'profile.json');
        const profile = JSON.parse(fs.readFileSync(profilePath, 'utf-8'));
        profile.settings = profile.settings || {};
        profile.settings.hooks = { PreToolUse: [{ type: 'command', command: 'echo test' }] };
        fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2));

        const result = sandbox.run('spread hooks PreToolUse --all');
        assert(result.ok, 'Spread hooks succeeds');

        // Verify target has the hook
        const t1Profile = JSON.parse(
            fs.readFileSync(path.join(sandbox.claudeDir, 'profiles', 'target1', 'profile.json'), 'utf-8')
        );
        assert(t1Profile.settings.hooks.PreToolUse !== undefined, 'Hook copied to target1');
        assert(
            JSON.stringify(t1Profile.settings.hooks.PreToolUse) ===
                JSON.stringify([{ type: 'command', command: 'echo test' }]),
            'Hook value is deep clone'
        );
    } finally {
        sandbox.cleanup();
    }
}

// Test 6: Keyed spread - mcp
function testSpreadMcp() {
    console.log('\n[Test] Spread keyed - mcp');
    const sandbox = setupSpreadTest();
    try {
        const profilePath = path.join(sandbox.claudeDir, 'profiles', 'current', 'profile.json');
        const profile = JSON.parse(fs.readFileSync(profilePath, 'utf-8'));
        profile.mcpServers = { 'test-server': { command: 'node', args: ['server.js'] } };
        fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2));

        const result = sandbox.run('spread mcp test-server --all');
        assert(result.ok, 'Spread mcp succeeds');

        const t1Profile = JSON.parse(
            fs.readFileSync(path.join(sandbox.claudeDir, 'profiles', 'target1', 'profile.json'), 'utf-8')
        );
        assert(t1Profile.mcpServers['test-server'] !== undefined, 'MCP server copied to target1');
    } finally {
        sandbox.cleanup();
    }
}

// Test 7: Keyed spread - env
function testSpreadEnv() {
    console.log('\n[Test] Spread keyed - env');
    const sandbox = setupSpreadTest();
    try {
        const profilePath = path.join(sandbox.claudeDir, 'profiles', 'current', 'profile.json');
        const profile = JSON.parse(fs.readFileSync(profilePath, 'utf-8'));
        profile.settings = profile.settings || {};
        profile.settings.env = { MY_VAR: 'my_value' };
        fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2));

        const result = sandbox.run('spread env MY_VAR --all');
        assert(result.ok, 'Spread env succeeds');

        const t1Profile = JSON.parse(
            fs.readFileSync(path.join(sandbox.claudeDir, 'profiles', 'target1', 'profile.json'), 'utf-8')
        );
        assert(t1Profile.settings.env.MY_VAR === 'my_value', 'Env var copied to target1');
    } finally {
        sandbox.cleanup();
    }
}

// Test 8: Value spread - statusline
function testSpreadStatusline() {
    console.log('\n[Test] Spread value - statusline');
    const sandbox = setupSpreadTest();
    try {
        const profilePath = path.join(sandbox.claudeDir, 'profiles', 'current', 'profile.json');
        const profile = JSON.parse(fs.readFileSync(profilePath, 'utf-8'));
        profile.settings = profile.settings || {};
        profile.settings.statusLine = '🔵 Dev Mode';
        fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2));

        const result = sandbox.run('spread statusline --all');
        assert(result.ok, 'Spread statusline succeeds');

        const t1Profile = JSON.parse(
            fs.readFileSync(path.join(sandbox.claudeDir, 'profiles', 'target1', 'profile.json'), 'utf-8')
        );
        assert(t1Profile.settings.statusLine === '🔵 Dev Mode', 'Statusline copied to target1');
    } finally {
        sandbox.cleanup();
    }
}

// Test 9: Value spread - permissions
function testSpreadPermissions() {
    console.log('\n[Test] Spread value - permissions');
    const sandbox = setupSpreadTest();
    try {
        const profilePath = path.join(sandbox.claudeDir, 'profiles', 'current', 'profile.json');
        const profile = JSON.parse(fs.readFileSync(profilePath, 'utf-8'));
        profile.settings = profile.settings || {};
        profile.settings.permissions = { defaultMode: 'bypassPermissions', allow: ['Bash'] };
        fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2));

        // Use --force since target profiles already have default permissions
        const result = sandbox.run('spread permissions --all --force');
        assert(result.ok, 'Spread permissions succeeds');

        const t1Profile = JSON.parse(
            fs.readFileSync(path.join(sandbox.claudeDir, 'profiles', 'target1', 'profile.json'), 'utf-8')
        );
        assert(t1Profile.settings.permissions.defaultMode === 'bypassPermissions', 'Permissions copied to target1');
    } finally {
        sandbox.cleanup();
    }
}

// Test 10: Value spread - claudemd (file copy, not JSON)
function testSpreadClaudemd() {
    console.log('\n[Test] Spread value - claudemd');
    const sandbox = setupSpreadTest();
    try {
        const srcClaudeMd = path.join(sandbox.claudeDir, 'profiles', 'current', 'CLAUDE.md');
        fs.writeFileSync(srcClaudeMd, '# My Profile CLAUDE.md\nCustom instructions');

        const result = sandbox.run('spread claudemd --all');
        assert(result.ok, 'Spread claudemd succeeds');

        const t1ClaudeMd = path.join(sandbox.claudeDir, 'profiles', 'target1', 'CLAUDE.md');
        assert(fs.existsSync(t1ClaudeMd), 'CLAUDE.md copied to target1');
        assert(
            fs.readFileSync(t1ClaudeMd, 'utf-8') === '# My Profile CLAUDE.md\nCustom instructions',
            'CLAUDE.md content matches'
        );
    } finally {
        sandbox.cleanup();
    }
}

// Test 11: Error - invalid type
function testSpreadInvalidType() {
    console.log('\n[Test] Spread error - invalid type');
    const sandbox = setupSpreadTest();
    try {
        const result = sandbox.run('spread badtype myname --all');
        assert(!result.ok, 'Invalid type rejected');
    } finally {
        sandbox.cleanup();
    }
}

// Test 12: Error - missing name for component type
function testSpreadMissingName() {
    console.log('\n[Test] Spread error - missing name');
    const sandbox = setupSpreadTest();
    try {
        const result = sandbox.run('spread commands --all');
        assert(!result.ok, 'Missing name rejected for component type');
    } finally {
        sandbox.cleanup();
    }
}

// Test 13: Error - nonexistent source item
function testSpreadNonexistentSource() {
    console.log('\n[Test] Spread error - nonexistent source');
    const sandbox = setupSpreadTest();
    try {
        const result = sandbox.run('spread commands nonexistent --all');
        assert(!result.ok, 'Nonexistent source item rejected');
    } finally {
        sandbox.cleanup();
    }
}

// Test 14: Active profile excluded from targets
function testSpreadExcludesActive() {
    console.log('\n[Test] Spread excludes active profile');
    const sandbox = setupSpreadTest();
    try {
        const result = sandbox.run('spread commands test --profiles=current');
        assert(!result.ok, 'Cannot spread to active profile');
    } finally {
        sandbox.cleanup();
    }
}

// Test 15: --profiles= targeting specific profiles
function testSpreadProfilesTargeting() {
    console.log('\n[Test] Spread --profiles= targeting');
    const sandbox = setupSpreadTest();
    try {
        const cmdDir = path.join(sandbox.claudeDir, 'profiles', 'current', 'commands');
        fs.writeFileSync(path.join(cmdDir, 'targeted.md'), '# Targeted');

        const result = sandbox.run('spread commands targeted --profiles=target1');
        assert(result.ok, 'Spread to specific profile succeeds');

        assert(
            fs.existsSync(path.join(sandbox.claudeDir, 'profiles', 'target1', 'commands', 'targeted.md')),
            'Copied to target1'
        );
        assert(
            !fs.existsSync(path.join(sandbox.claudeDir, 'profiles', 'target2', 'commands', 'targeted.md')),
            'NOT copied to target2'
        );
    } finally {
        sandbox.cleanup();
    }
}

// Run all tests
try {
    testSpreadCommandMdFile();
    testSpreadCommandDirectory();
    testSpreadSkillFile();
    testSpreadForce();
    testSpreadHooks();
    testSpreadMcp();
    testSpreadEnv();
    testSpreadStatusline();
    testSpreadPermissions();
    testSpreadClaudemd();
    testSpreadInvalidType();
    testSpreadMissingName();
    testSpreadNonexistentSource();
    testSpreadExcludesActive();
    testSpreadProfilesTargeting();
} catch (err) {
    console.error('Unexpected error:', err);
}

const exitCode = printResults();
process.exit(exitCode);
