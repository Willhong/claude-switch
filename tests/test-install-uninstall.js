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
    const metaPath = path.join(sandbox.claudeDir, 'profiles', 'profiles.json');
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    if (!meta.profiles.includes(name)) {
        meta.profiles.push(name);
        fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
    }
}

function setupTestMarketplace(sandbox, marketplaceName, pluginName) {
    // Create plugins directory structure
    const pluginsDir = path.join(sandbox.claudeDir, 'plugins');
    fs.mkdirSync(pluginsDir, { recursive: true });

    // Create known_marketplaces.json
    const knownMarketplacesPath = path.join(pluginsDir, 'known_marketplaces.json');
    const marketplacesDir = path.join(pluginsDir, 'marketplaces');
    const marketplaceDir = path.join(marketplacesDir, marketplaceName);

    fs.mkdirSync(marketplaceDir, { recursive: true });

    fs.writeFileSync(
        knownMarketplacesPath,
        JSON.stringify(
            {
                [marketplaceName]: {
                    installLocation: marketplaceDir
                }
            },
            null,
            2
        )
    );

    // Create marketplace.json
    const marketplaceJsonDir = path.join(marketplaceDir, '.claude-plugin');
    fs.mkdirSync(marketplaceJsonDir, { recursive: true });
    fs.writeFileSync(
        path.join(marketplaceJsonDir, 'marketplace.json'),
        JSON.stringify(
            {
                plugins: [
                    {
                        name: pluginName,
                        version: '1.0.0',
                        source: '.'
                    }
                ]
            },
            null,
            2
        )
    );

    // Create minimal plugin structure (just empty dir is fine for testing)
    const pluginSourceDir = path.join(marketplaceDir, 'commands');
    fs.mkdirSync(pluginSourceDir, { recursive: true });

    // Create installed_plugins.json (empty initially)
    fs.writeFileSync(
        path.join(pluginsDir, 'installed_plugins.json'),
        JSON.stringify(
            {
                plugins: {}
            },
            null,
            2
        )
    );
}

console.log('=== Install/Uninstall Command Tests ===');

// Test 1: install-all enables plugin across profiles
function testInstallAllEnablesPlugin() {
    console.log('\n[Test] install-all enables plugin across profiles');
    const sandbox = createTestSandbox();
    fixProfilesMeta(sandbox);
    setupTestMarketplace(sandbox, 'test-market', 'test-plug');
    createTestProfile(sandbox, 'prof-a');
    createTestProfile(sandbox, 'prof-b');
    try {
        const result = sandbox.run('install-all test-plug@test-market --all');
        assert(result.ok, 'install-all succeeds');

        // Check profiles have the plugin enabled
        const profA = JSON.parse(
            fs.readFileSync(path.join(sandbox.claudeDir, 'profiles', 'prof-a', 'profile.json'), 'utf-8')
        );
        const profB = JSON.parse(
            fs.readFileSync(path.join(sandbox.claudeDir, 'profiles', 'prof-b', 'profile.json'), 'utf-8')
        );
        assert(profA.settings.enabledPlugins['test-plug@test-market'] === true, 'Plugin enabled in prof-a');
        assert(profB.settings.enabledPlugins['test-plug@test-market'] === true, 'Plugin enabled in prof-b');
    } finally {
        sandbox.cleanup();
    }
}

// Test 2: install-all updates settings.json for active profile
function testInstallAllUpdatesActiveSettings() {
    console.log('\n[Test] install-all updates settings.json for active profile');
    const sandbox = createTestSandbox();
    fixProfilesMeta(sandbox);
    setupTestMarketplace(sandbox, 'market', 'new-plug');
    try {
        const result = sandbox.run('install-all new-plug@market --profiles=current');
        assert(result.ok, 'install-all on active profile succeeds');

        // Check settings.json updated
        const settings = JSON.parse(fs.readFileSync(path.join(sandbox.claudeDir, 'settings.json'), 'utf-8'));
        assert(settings.enabledPlugins['new-plug@market'] === true, 'settings.json updated for active profile');
    } finally {
        sandbox.cleanup();
    }
}

// Test 3: install-all skips already-enabled
function testInstallAllSkipsAlreadyEnabled() {
    console.log('\n[Test] install-all skips already-enabled');
    const sandbox = createTestSandbox();
    fixProfilesMeta(sandbox);
    setupTestMarketplace(sandbox, 'test', 'pre-enabled');
    createTestProfile(sandbox, 'already');
    // Pre-enable the plugin
    const profPath = path.join(sandbox.claudeDir, 'profiles', 'already', 'profile.json');
    const prof = JSON.parse(fs.readFileSync(profPath, 'utf-8'));
    prof.settings.enabledPlugins['pre-enabled@test'] = true;
    fs.writeFileSync(profPath, JSON.stringify(prof, null, 2));

    try {
        const result = sandbox.run('install-all pre-enabled@test --profiles=already');
        assert(result.ok, 'install-all succeeds');
        assert(result.output?.summary?.skipped === 1, 'Skipped already-enabled profile');
    } finally {
        sandbox.cleanup();
    }
}

// Test 4: uninstall-all disables plugin
function testUninstallAllDisablesPlugin() {
    console.log('\n[Test] uninstall-all disables plugin');
    const sandbox = createTestSandbox();
    fixProfilesMeta(sandbox);
    createTestProfile(sandbox, 'remove-from');
    // Enable plugin first
    const profPath = path.join(sandbox.claudeDir, 'profiles', 'remove-from', 'profile.json');
    const prof = JSON.parse(fs.readFileSync(profPath, 'utf-8'));
    prof.settings.enabledPlugins['removeme@test'] = true;
    fs.writeFileSync(profPath, JSON.stringify(prof, null, 2));

    try {
        const result = sandbox.run('uninstall-all removeme@test --profiles=remove-from');
        assert(result.ok, 'uninstall-all succeeds');

        const updated = JSON.parse(fs.readFileSync(profPath, 'utf-8'));
        assert(updated.settings.enabledPlugins['removeme@test'] === undefined, 'Plugin removed from profile');
    } finally {
        sandbox.cleanup();
    }
}

// Test 5: uninstall-all self-preservation
function testUninstallAllSelfPreservation() {
    console.log('\n[Test] uninstall-all self-preservation');
    const sandbox = createTestSandbox();
    fixProfilesMeta(sandbox);
    try {
        const result = sandbox.run('uninstall-all claude-switch@claude-switch --all');
        assert(!result.ok, 'Cannot uninstall claude-switch');
    } finally {
        sandbox.cleanup();
    }
}

// Test 6: --profiles= targeting
function testProfilesTargeting() {
    console.log('\n[Test] install-all --profiles= targeting');
    const sandbox = createTestSandbox();
    fixProfilesMeta(sandbox);
    setupTestMarketplace(sandbox, 'test', 'target-plug');
    createTestProfile(sandbox, 'targeted');
    createTestProfile(sandbox, 'not-targeted');
    try {
        const result = sandbox.run('install-all target-plug@test --profiles=targeted');
        assert(result.ok, 'install-all with --profiles succeeds');

        const targeted = JSON.parse(
            fs.readFileSync(path.join(sandbox.claudeDir, 'profiles', 'targeted', 'profile.json'), 'utf-8')
        );
        const notTargeted = JSON.parse(
            fs.readFileSync(path.join(sandbox.claudeDir, 'profiles', 'not-targeted', 'profile.json'), 'utf-8')
        );
        assert(targeted.settings.enabledPlugins['target-plug@test'] === true, 'Plugin enabled in targeted');
        assert(notTargeted.settings.enabledPlugins['target-plug@test'] === undefined, 'Plugin NOT in non-targeted');
    } finally {
        sandbox.cleanup();
    }
}

// Test 7: uninstall-all updates settings.json for active profile
function testUninstallAllUpdatesActiveSettings() {
    console.log('\n[Test] uninstall-all updates settings.json for active profile');
    const sandbox = createTestSandbox();
    fixProfilesMeta(sandbox);
    // Enable plugin in current profile and settings.json
    const profPath = path.join(sandbox.claudeDir, 'profiles', 'current', 'profile.json');
    const prof = JSON.parse(fs.readFileSync(profPath, 'utf-8'));
    prof.settings.enabledPlugins['removeme@test'] = true;
    fs.writeFileSync(profPath, JSON.stringify(prof, null, 2));

    const settingsPath = path.join(sandbox.claudeDir, 'settings.json');
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    settings.enabledPlugins['removeme@test'] = true;
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

    try {
        const result = sandbox.run('uninstall-all removeme@test --profiles=current');
        assert(result.ok, 'uninstall-all on active succeeds');

        const updatedSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
        assert(updatedSettings.enabledPlugins['removeme@test'] === undefined, 'settings.json also updated');
    } finally {
        sandbox.cleanup();
    }
}

try {
    testInstallAllEnablesPlugin();
    testInstallAllUpdatesActiveSettings();
    testInstallAllSkipsAlreadyEnabled();
    testUninstallAllDisablesPlugin();
    testUninstallAllSelfPreservation();
    testProfilesTargeting();
    testUninstallAllUpdatesActiveSettings();
} catch (err) {
    console.error('Unexpected error:', err);
}

const exitCode = printResults();
process.exit(exitCode);
