#!/usr/bin/env node
/**
 * Claude Code Profile Switcher
 * Profile CRUD and switching logic
 *
 * @version 1.6.2
 * @author Hong
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CLAUDE_DIR = path.join(process.env.HOME || process.env.USERPROFILE, '.claude');
const PROFILES_DIR = path.join(CLAUDE_DIR, 'profiles');
const BACKUPS_DIR = path.join(PROFILES_DIR, '.backups');
const PROFILES_JSON = path.join(PROFILES_DIR, 'profiles.json');
const SETTINGS_JSON = path.join(CLAUDE_DIR, 'settings.json');
const ACTIVE_MANIFEST = path.join(CLAUDE_DIR, 'active-manifest.json');
// MCP settings stored in ~/.claude.json
const CLAUDE_JSON = path.join(process.env.HOME || process.env.USERPROFILE, '.claude.json');

// Directories managed via symlinks
const SYMLINK_DIRS = ['commands', 'skills', 'agents'];
const IS_WINDOWS = process.platform === 'win32';
const PROFILE_NAME_REGEX = /^[a-zA-Z0-9_-]+$/;
const LOCK_FILE = path.join(PROFILES_DIR, '.lock');
const LOCK_TIMEOUT_MS = 30000; // 30 seconds
const LOCK_STALE_MS = 60000; // 1 minute - consider lock stale after this
const SELF_PLUGIN_KEY = 'claude-switch@claude-switch';

// Utility functions
function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function readJSON(filepath) {
    try {
        return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
    } catch {
        return null;
    }
}

function writeJSON(filepath, data) {
    writeFileAtomic(filepath, JSON.stringify(data, null, 2));
}

// Atomic file write: write to temp file, then rename
function writeFileAtomic(filepath, content) {
    const dir = path.dirname(filepath);
    ensureDir(dir);
    const tmpFile = path.join(dir, `.tmp-${crypto.randomBytes(6).toString('hex')}`);
    try {
        fs.writeFileSync(tmpFile, content, 'utf-8');
        // On Windows, rename fails if target exists - remove first
        if (IS_WINDOWS && fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
        }
        fs.renameSync(tmpFile, filepath);
    } catch (err) {
        // Clean up temp file on failure
        try { fs.unlinkSync(tmpFile); } catch {}
        throw err;
    }
}

// File-based locking for mutating operations
function acquireLock() {
    ensureDir(PROFILES_DIR);
    const deadline = Date.now() + LOCK_TIMEOUT_MS;

    while (Date.now() < deadline) {
        try {
            // O_EXCL fails if file already exists - atomic check-and-create
            const fd = fs.openSync(LOCK_FILE, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY);
            fs.writeSync(fd, JSON.stringify({ pid: process.pid, time: Date.now() }));
            fs.closeSync(fd);
            return true;
        } catch (err) {
            if (err.code === 'EEXIST') {
                // Check if lock is stale
                try {
                    const lockData = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf-8'));
                    if (Date.now() - lockData.time > LOCK_STALE_MS) {
                        // Stale lock - remove and retry
                        fs.unlinkSync(LOCK_FILE);
                        continue;
                    }
                } catch {
                    // Can't read lock file - remove it
                    try { fs.unlinkSync(LOCK_FILE); } catch {}
                    continue;
                }
                // Wait and retry
                const waitMs = 50 + Math.random() * 100;
                const waitUntil = Date.now() + waitMs;
                while (Date.now() < waitUntil) { /* spin wait */ }
            } else {
                throw err;
            }
        }
    }
    throw new Error('Could not acquire lock - another operation may be in progress. If stuck, delete ' + LOCK_FILE);
}

function releaseLock() {
    try { fs.unlinkSync(LOCK_FILE); } catch {}
}

// Execute a function while holding the lock
function withLock(fn) {
    acquireLock();
    try {
        return fn();
    } finally {
        releaseLock();
    }
}

function getTimestamp() {
    return new Date().toISOString().replace(/[:.]/g, '-');
}

// Symlink utilities
function isSymlink(filepath) {
    try {
        return fs.lstatSync(filepath).isSymbolicLink();
    } catch {
        return false;
    }
}

function getSymlinkTarget(filepath) {
    try {
        return fs.readlinkSync(filepath);
    } catch {
        return null;
    }
}

function removeSymlinkOrDir(filepath) {
    if (!fs.existsSync(filepath) && !isSymlink(filepath)) return;

    if (isSymlink(filepath)) {
        // Remove symlink
        if (IS_WINDOWS) {
            // On Windows, junctions are removed with rmdir
            try {
                fs.rmdirSync(filepath);
            } catch {
                fs.unlinkSync(filepath);
            }
        } else {
            fs.unlinkSync(filepath);
        }
    } else if (fs.existsSync(filepath)) {
        // Don't delete regular directories (safety measure)
        throw new Error(`'${filepath}' is not a symlink. Move it manually first.`);
    }
}

function createSymlink(target, linkPath) {
    // Remove existing link if present
    if (isSymlink(linkPath)) {
        removeSymlinkOrDir(linkPath);
    }

    if (IS_WINDOWS) {
        // Windows: use junction (no admin rights required)
        // Junction requires absolute paths
        const absTarget = path.resolve(target);
        const absLink = path.resolve(linkPath);

        try {
            fs.symlinkSync(absTarget, absLink, 'junction');
        } catch (err) {
            throw new Error(`Failed to create junction from '${absLink}' to '${absTarget}': ${err.message}`);
        }
    } else {
        // Unix: relative path symlink
        const relTarget = path.relative(path.dirname(linkPath), target);
        fs.symlinkSync(relTarget, linkPath);
    }
}

// Profile directory paths
function getProfileDir(name) {
    return path.join(PROFILES_DIR, name);
}

function getProfileComponentDir(profileName, component) {
    return path.join(getProfileDir(profileName), component);
}

function getClaudeComponentDir(component) {
    return path.join(CLAUDE_DIR, component);
}

// Profile metadata management
function loadProfilesMeta() {
    return readJSON(PROFILES_JSON) || {
        activeProfile: 'current',
        profiles: []
    };
}

function saveProfilesMeta(meta) {
    writeJSON(PROFILES_JSON, meta);
}

// List profiles
function listProfiles() {
    const meta = loadProfilesMeta();
    const profiles = [];

    if (!fs.existsSync(PROFILES_DIR)) {
        return profiles;
    }

    const entries = fs.readdirSync(PROFILES_DIR, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
            const profilePath = path.join(PROFILES_DIR, entry.name, 'profile.json');
            const profile = readJSON(profilePath);
            if (profile) {
                // Count components
                const componentCounts = {};
                for (const dir of SYMLINK_DIRS) {
                    const targetDir = getProfileComponentDir(entry.name, dir);
                    try {
                        const items = fs.readdirSync(targetDir, { withFileTypes: true });
                        componentCounts[dir] = items.filter(e => e.isDirectory() || e.name.endsWith('.md')).length;
                    } catch {
                        componentCounts[dir] = 0;
                    }
                }

                profiles.push({
                    name: entry.name,
                    description: profile.description || '',
                    active: meta.activeProfile === entry.name,
                    createdAt: profile.createdAt,
                    pluginCount: Object.keys(profile.settings?.enabledPlugins || {}).filter(
                        k => profile.settings.enabledPlugins[k]
                    ).length,
                    hasHooks: Object.keys(profile.settings?.hooks || {}).length > 0,
                    hasStatusLine: !!profile.settings?.statusLine,
                    mcpServerCount: Object.keys(profile.mcpServers || {}).length,
                    components: componentCounts
                });
            }
        }
    }

    return profiles;
}

// Check profile existence
function profileExists(name) {
    return fs.existsSync(path.join(PROFILES_DIR, name, 'profile.json'));
}

// Load profile
function loadProfile(name) {
    const profilePath = path.join(PROFILES_DIR, name, 'profile.json');
    return readJSON(profilePath);
}

// Save profile
function saveProfile(name, profile) {
    const profileDir = path.join(PROFILES_DIR, name);
    ensureDir(profileDir);
    writeJSON(path.join(profileDir, 'profile.json'), profile);
}

// Load MCP server settings
function loadMcpServers() {
    const claudeJson = readJSON(CLAUDE_JSON);
    return claudeJson?.mcpServers || {};
}

// Save MCP server settings
function saveMcpServers(mcpServers) {
    const claudeJson = readJSON(CLAUDE_JSON) || {};
    claudeJson.mcpServers = mcpServers;
    writeJSON(CLAUDE_JSON, claudeJson);
}

// Backup current settings
function backupCurrentSettings() {
    ensureDir(BACKUPS_DIR);
    const timestamp = getTimestamp();
    const backupDir = path.join(BACKUPS_DIR, `backup-${timestamp}`);
    ensureDir(backupDir);

    // Backup settings.json
    if (fs.existsSync(SETTINGS_JSON)) {
        fs.copyFileSync(SETTINGS_JSON, path.join(backupDir, 'settings.json'));
    }

    // Backup active-manifest.json
    if (fs.existsSync(ACTIVE_MANIFEST)) {
        fs.copyFileSync(ACTIVE_MANIFEST, path.join(backupDir, 'active-manifest.json'));
    }

    // Backup MCP server settings
    const mcpServers = loadMcpServers();
    writeJSON(path.join(backupDir, 'mcpServers.json'), mcpServers);

    // Save metadata
    const meta = loadProfilesMeta();
    writeJSON(path.join(backupDir, 'meta.json'), {
        previousProfile: meta.activeProfile,
        backupTime: new Date().toISOString()
    });

    // Clean old backups (keep max 10)
    cleanOldBackups(10);

    return backupDir;
}

// Clean old backups
function cleanOldBackups(maxCount) {
    if (!fs.existsSync(BACKUPS_DIR)) return;

    const backups = fs.readdirSync(BACKUPS_DIR)
        .filter(f => f.startsWith('backup-'))
        .sort()
        .reverse();

    if (backups.length > maxCount) {
        for (const old of backups.slice(maxCount)) {
            fs.rmSync(path.join(BACKUPS_DIR, old), { recursive: true });
        }
    }
}

// Export current settings to profile
function exportCurrentToProfile(name, description = '') {
    const settings = readJSON(SETTINGS_JSON) || {};
    const mcpServers = loadMcpServers();

    const profile = {
        name: name,
        description: description,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        settings: {
            enabledPlugins: settings.enabledPlugins || {},
            hooks: settings.hooks || {},
            statusLine: settings.statusLine || null,
            env: settings.env || {},
            permissions: settings.permissions || { defaultMode: 'default' },
            alwaysThinkingEnabled: settings.alwaysThinkingEnabled ?? true,
            autoUpdatesChannel: settings.autoUpdatesChannel || 'latest'
        },
        mcpServers: mcpServers,
        components: {
            commands: { mode: 'all', include: [] },
            skills: { mode: 'all', include: [] },
            agents: { mode: 'all', include: [] }
        }
    };

    saveProfile(name, profile);
    return profile;
}

// Switch symlinks
function switchSymlinks(profileName) {
    const results = [];
    const profileDir = getProfileDir(profileName);

    for (const dir of SYMLINK_DIRS) {
        const claudeDir = getClaudeComponentDir(dir);
        const targetDir = getProfileComponentDir(profileName, dir);

        // Create directory if not exists in profile
        if (!fs.existsSync(targetDir)) {
            ensureDir(targetDir);
            results.push({ dir, action: 'created_target', path: targetDir });
        }

        // Remove existing symlink and create new one
        try {
            if (isSymlink(claudeDir)) {
                removeSymlinkOrDir(claudeDir);
            } else if (fs.existsSync(claudeDir)) {
                // Error if real directory exists
                throw new Error(`'${claudeDir}' is a real directory, not a symlink. Run 'init' first.`);
            }

            createSymlink(targetDir, claudeDir);
            results.push({ dir, action: 'switched', link: claudeDir, target: targetDir });
        } catch (err) {
            results.push({ dir, action: 'error', error: err.message });
        }
    }

    return results;
}

// Switch to profile (with locking and rollback)
function switchToProfile(name) {
    if (!profileExists(name)) {
        throw new Error(`Profile '${name}' does not exist`);
    }

    return withLock(() => {
        // 1. Backup current settings
        const backupPath = backupCurrentSettings();

        // Save originals for rollback
        const origSettings = fs.existsSync(SETTINGS_JSON) ? fs.readFileSync(SETTINGS_JSON, 'utf-8') : null;
        const origClaudeJson = fs.existsSync(CLAUDE_JSON) ? fs.readFileSync(CLAUDE_JSON, 'utf-8') : null;
        const origManifest = fs.existsSync(ACTIVE_MANIFEST) ? fs.readFileSync(ACTIVE_MANIFEST, 'utf-8') : null;
        const origSymlinkTargets = {};
        for (const dir of SYMLINK_DIRS) {
            const claudeDir = getClaudeComponentDir(dir);
            if (isSymlink(claudeDir)) {
                origSymlinkTargets[dir] = getSymlinkTarget(claudeDir);
            }
        }

        function rollback() {
            try {
                if (origSettings !== null) fs.writeFileSync(SETTINGS_JSON, origSettings, 'utf-8');
                if (origClaudeJson !== null) fs.writeFileSync(CLAUDE_JSON, origClaudeJson, 'utf-8');
                if (origManifest !== null) fs.writeFileSync(ACTIVE_MANIFEST, origManifest, 'utf-8');
                // Restore symlinks
                for (const dir of SYMLINK_DIRS) {
                    const claudeDir = getClaudeComponentDir(dir);
                    if (origSymlinkTargets[dir]) {
                        try {
                            removeSymlinkOrDir(claudeDir);
                            createSymlink(origSymlinkTargets[dir], claudeDir);
                        } catch {}
                    }
                }
            } catch {}
        }

        try {
            // 2. Load profile
            const profile = loadProfile(name);

            // 3. Update settings.json
            const currentSettings = readJSON(SETTINGS_JSON) || {};
            const newSettings = {
                ...currentSettings,
                enabledPlugins: profile.settings.enabledPlugins || {},
                hooks: profile.settings.hooks || {},
                statusLine: profile.settings.statusLine,
                env: profile.settings.env || {},
                permissions: profile.settings.permissions || { defaultMode: 'default' },
                alwaysThinkingEnabled: profile.settings.alwaysThinkingEnabled ?? true,
                autoUpdatesChannel: profile.settings.autoUpdatesChannel || 'latest'
            };

            // Always keep claude-switch plugin enabled (self-preservation)
            newSettings.enabledPlugins[SELF_PLUGIN_KEY] = true;

            if (newSettings.statusLine === null) {
                delete newSettings.statusLine;
            }

            writeJSON(SETTINGS_JSON, newSettings);

            // 4. Switch MCP server settings
            const mcpServers = profile.mcpServers || {};
            saveMcpServers(mcpServers);

            // 5. Switch symlinks
            const symlinkResults = switchSymlinks(name);

            // Check for symlink errors
            const symlinkErrors = symlinkResults.filter(r => r.action === 'error');
            if (symlinkErrors.length > 0) {
                throw new Error(`Symlink errors: ${symlinkErrors.map(e => `${e.dir}: ${e.error}`).join('; ')}`);
            }

            // 6. Update active-manifest.json
            const manifest = {
                profile: name,
                updatedAt: new Date().toISOString(),
                components: profile.components || {},
                symlinks: symlinkResults
            };
            writeJSON(ACTIVE_MANIFEST, manifest);

            // 7. Update profiles.json
            const meta = loadProfilesMeta();
            meta.activeProfile = name;
            meta.lastSwitch = new Date().toISOString();
            saveProfilesMeta(meta);

            // Count components in profile directory
            const componentCounts = {};
            for (const dir of SYMLINK_DIRS) {
                const targetDir = getProfileComponentDir(name, dir);
                try {
                    const entries = fs.readdirSync(targetDir, { withFileTypes: true });
                    componentCounts[dir] = entries.filter(e => e.isDirectory() || e.name.endsWith('.md')).length;
                } catch {
                    componentCounts[dir] = 0;
                }
            }

            const result = {
                success: true,
                profile: name,
                backup: backupPath,
                settings: {
                    plugins: Object.keys(profile.settings.enabledPlugins || {}).filter(
                        k => profile.settings.enabledPlugins[k]
                    ).length,
                    hooks: Object.keys(profile.settings.hooks || {}).length,
                    hasStatusLine: !!profile.settings.statusLine,
                    mcpServers: Object.keys(mcpServers).length
                },
                components: componentCounts,
                symlinks: symlinkResults,
                message: `Switched to profile '${name}'. Please restart Claude Code for changes to take effect.`
            };

            // Update plugin cache if running from source
            const cacheUpdate = updatePluginCache();
            if (cacheUpdate) {
                result.cacheUpdated = cacheUpdate;
            }

            return result;
        } catch (err) {
            // Rollback all changes on failure
            rollback();
            throw new Error(`Switch failed (rolled back): ${err.message}`);
        }
    });
}

// Sync source files to plugin cache and update registry
function syncToCache(sourceDir, options = {}) {
    const pluginCacheBase = path.join(CLAUDE_DIR, 'plugins', 'cache', 'claude-switch', 'claude-switch');
    if (!fs.existsSync(pluginCacheBase)) return null;

    const versions = fs.readdirSync(pluginCacheBase).filter(v => {
        try { return fs.statSync(path.join(pluginCacheBase, v)).isDirectory(); } catch { return false; }
    });

    if (versions.length === 0) return null;

    const pkg = readJSON(path.join(sourceDir, 'package.json'));
    const newVersion = pkg?.version || 'unknown';
    const newVersionDir = path.join(pluginCacheBase, newVersion);

    // Ensure target version directory exists
    ensureDir(newVersionDir);

    // Copy source files to the target version directory
    for (const dir of ['scripts', 'commands']) {
        const src = path.join(sourceDir, dir);
        const dest = path.join(newVersionDir, dir);
        if (fs.existsSync(src)) {
            if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true });
            copyDirRecursive(src, dest);
        }
    }
    for (const file of ['package.json', 'CLAUDE.md', 'README.md', 'LICENSE']) {
        const src = path.join(sourceDir, file);
        if (fs.existsSync(src)) {
            fs.copyFileSync(src, path.join(newVersionDir, file));
        }
    }

    // Remove all old version directories
    const removed = [];
    for (const ver of versions) {
        if (ver !== newVersion) {
            try {
                fs.rmSync(path.join(pluginCacheBase, ver), { recursive: true });
                removed.push(ver);
            } catch {}
        }
    }

    // Update installed_plugins.json with new version, path, and git SHA
    const installedPath = path.join(CLAUDE_DIR, 'plugins', 'installed_plugins.json');
    const installed = readJSON(installedPath);
    if (installed?.plugins?.['claude-switch@claude-switch']) {
        const entries = installed.plugins['claude-switch@claude-switch'];
        for (const entry of entries) {
            entry.version = newVersion;
            entry.installPath = path.join(pluginCacheBase, newVersion);
            entry.lastUpdated = new Date().toISOString();
            if (options.gitCommitSha) {
                entry.gitCommitSha = options.gitCommitSha;
            }
        }
        writeJSON(installedPath, installed);
    }

    // Update marketplace cache version to prevent stale dir recreation
    const marketplacePluginDir = path.join(CLAUDE_DIR, 'plugins', 'marketplaces', 'claude-switch', '.claude-plugin');
    const marketplaceJson = readJSON(path.join(marketplacePluginDir, 'marketplace.json'));
    if (marketplaceJson) {
        marketplaceJson.version = newVersion;
        if (marketplaceJson.metadata) marketplaceJson.metadata.version = newVersion;
        if (Array.isArray(marketplaceJson.plugins)) {
            for (const p of marketplaceJson.plugins) {
                p.version = newVersion;
            }
        }
        writeJSON(path.join(marketplacePluginDir, 'marketplace.json'), marketplaceJson);
    }
    const pluginJson = readJSON(path.join(marketplacePluginDir, 'plugin.json'));
    if (pluginJson) {
        pluginJson.version = newVersion;
        writeJSON(path.join(marketplacePluginDir, 'plugin.json'), pluginJson);
    }

    return { version: newVersion, removed };
}

// Find git repo URL from marketplace config
function getGitRepoUrl() {
    const marketplaces = readJSON(path.join(CLAUDE_DIR, 'plugins', 'known_marketplaces.json'));
    const entry = marketplaces?.['claude-switch'];
    if (entry?.source?.source === 'github' && entry?.source?.repo) {
        return `https://github.com/${entry.source.repo}.git`;
    }
    if (entry?.source?.source === 'git' && entry?.source?.url) {
        return entry.source.url;
    }
    return null;
}

// Update plugin cache - works from source or cache (pulls from git)
function updatePluginCache() {
    const { execSync } = require('child_process');
    const os = require('os');
    const scriptDir = __dirname;
    const projectDir = path.dirname(scriptDir);
    const isRunningFromCache = projectDir.includes(path.join('plugins', 'cache'));

    if (!isRunningFromCache) {
        // Running from source - sync directly, capture git SHA if available
        const pkg = readJSON(path.join(projectDir, 'package.json'));
        if (!pkg?.name || pkg.name !== 'claude-switch') return null;
        let gitSha = null;
        try {
            gitSha = execSync('git rev-parse HEAD', { cwd: projectDir, stdio: 'pipe' }).toString().trim();
        } catch {}
        return syncToCache(projectDir, { gitCommitSha: gitSha });
    }

    // Running from cache - pull latest from git
    const repoUrl = getGitRepoUrl();
    if (!repoUrl) {
        throw new Error('Cannot find git repo URL in marketplace config. Add the marketplace first.');
    }

    const tmpDir = path.join(os.tmpdir(), `claude-switch-update-${Date.now()}`);
    try {
        execSync(`git clone --depth 1 "${repoUrl}" "${tmpDir}"`, { stdio: 'pipe' });
        let gitSha = null;
        try {
            gitSha = execSync('git rev-parse HEAD', { cwd: tmpDir, stdio: 'pipe' }).toString().trim();
        } catch {}
        return syncToCache(tmpDir, { gitCommitSha: gitSha });
    } finally {
        try { fs.rmSync(tmpDir, { recursive: true }); } catch {}
    }
}

// Copy directory recursively
function copyDirRecursive(src, dest) {
    ensureDir(dest);
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDirRecursive(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

// Copyable items list
const COPYABLE_ITEMS = {
    // Settings
    plugins: 'enabledPlugins',
    hooks: 'hooks',
    statusline: 'statusLine',
    env: 'env',
    permissions: 'permissions',
    mcp: 'mcpServers',
    // Component directories
    commands: 'commands',
    skills: 'skills',
    agents: 'agents'
};

const SETTING_ITEMS = ['plugins', 'hooks', 'statusline', 'env', 'permissions'];
const COMPONENT_ITEMS = ['commands', 'skills', 'agents'];

// Create new profile (with locking)
function createProfile(name, options = {}) {
    return withLock(() => _createProfile(name, options));
}

function _createProfile(name, options = {}) {
    if (profileExists(name)) {
        throw new Error(`Profile '${name}' already exists`);
    }

    // Validate name
    if (!PROFILE_NAME_REGEX.test(name)) {
        throw new Error('Profile name can only contain letters, numbers, hyphens, and underscores');
    }

    const { fromCurrent = false, description = '', clean = false, copy = [] } = options;

    // Parse copy option: 'all' or individual items array
    let itemsToCopy = [];
    if (copy.length > 0) {
        if (copy.includes('all')) {
            itemsToCopy = Object.keys(COPYABLE_ITEMS);
        } else {
            // Filter valid items only
            itemsToCopy = copy.filter(item => COPYABLE_ITEMS[item]);
            const invalid = copy.filter(item => !COPYABLE_ITEMS[item]);
            if (invalid.length > 0) {
                throw new Error(`Invalid copy items: ${invalid.join(', ')}. Valid items: ${Object.keys(COPYABLE_ITEMS).join(', ')}, all`);
            }
        }
    } else if (fromCurrent) {
        // --from-current equals all (backward compatible)
        itemsToCopy = Object.keys(COPYABLE_ITEMS);
    }
    // clean or default keeps empty array

    let profile;
    const profileDir = getProfileDir(name);
    ensureDir(profileDir);

    // Load current settings
    const currentSettings = readJSON(SETTINGS_JSON) || {};
    const currentMcpServers = loadMcpServers();

    // Default empty profile structure
    profile = {
        name: name,
        description: description || (itemsToCopy.length > 0 ? `Copied: ${itemsToCopy.join(', ')}` : 'Custom profile'),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        settings: {
            enabledPlugins: { [SELF_PLUGIN_KEY]: true },
            hooks: {},
            statusLine: null,
            env: {},
            permissions: { defaultMode: 'default' },
            alwaysThinkingEnabled: true,
            autoUpdatesChannel: 'latest'
        },
        mcpServers: {},
        components: {
            commands: { mode: clean ? 'whitelist' : 'all', include: [] },
            skills: { mode: clean ? 'whitelist' : 'all', include: [] },
            agents: { mode: clean ? 'whitelist' : 'all', include: [] }
        }
    };

    // Copy settings items
    if (itemsToCopy.includes('plugins')) {
        profile.settings.enabledPlugins = currentSettings.enabledPlugins || {};
    }
    if (itemsToCopy.includes('hooks')) {
        profile.settings.hooks = currentSettings.hooks || {};
    }
    if (itemsToCopy.includes('statusline')) {
        profile.settings.statusLine = currentSettings.statusLine || null;
    }
    if (itemsToCopy.includes('env')) {
        profile.settings.env = currentSettings.env || {};
    }
    if (itemsToCopy.includes('permissions')) {
        profile.settings.permissions = currentSettings.permissions || { defaultMode: 'default' };
    }
    if (itemsToCopy.includes('mcp')) {
        profile.mcpServers = currentMcpServers;
    }

    saveProfile(name, profile);

    // Process component directories
    const meta = loadProfilesMeta();
    const sourceProfile = meta.activeProfile || 'current';

    for (const dir of SYMLINK_DIRS) {
        const targetDir = getProfileComponentDir(name, dir);

        if (itemsToCopy.includes(dir)) {
            // Copy this directory
            const sourceDir = getProfileComponentDir(sourceProfile, dir);
            if (fs.existsSync(sourceDir)) {
                copyDirRecursive(sourceDir, targetDir);
            } else {
                ensureDir(targetDir);
            }
        } else {
            // Create empty directory
            ensureDir(targetDir);
        }
    }

    // Always copy profile command (for switch functionality)
    const profileCmdSrc = getProfileComponentDir(sourceProfile, 'commands/profile');
    const profileCmdDest = getProfileComponentDir(name, 'commands/profile');
    if (fs.existsSync(profileCmdSrc) && !fs.existsSync(profileCmdDest)) {
        copyDirRecursive(profileCmdSrc, profileCmdDest);
    }

    // Update profiles.json list (meta already loaded above)
    if (!meta.profiles.includes(name)) {
        meta.profiles.push(name);
        saveProfilesMeta(meta);
    }

    // Count components
    const componentCounts = {};
    for (const dir of SYMLINK_DIRS) {
        const targetDir = getProfileComponentDir(name, dir);
        try {
            const entries = fs.readdirSync(targetDir, { withFileTypes: true });
            componentCounts[dir] = entries.filter(e => e.isDirectory() || e.name.endsWith('.md')).length;
        } catch {
            componentCounts[dir] = 0;
        }
    }

    return {
        success: true,
        profile: profile,
        components: componentCounts,
        message: `Profile '${name}' created`
    };
}

// Delete profile (with locking)
function deleteProfile(name) {
    return withLock(() => _deleteProfile(name));
}

function _deleteProfile(name) {
    if (name === 'current') {
        throw new Error("Cannot delete 'current' profile - it's a system snapshot");
    }

    if (!profileExists(name)) {
        throw new Error(`Profile '${name}' does not exist`);
    }

    const meta = loadProfilesMeta();
    if (meta.activeProfile === name) {
        throw new Error(`Cannot delete active profile '${name}'. Switch to another profile first.`);
    }

    const profileDir = path.join(PROFILES_DIR, name);
    fs.rmSync(profileDir, { recursive: true });

    // Update profiles.json list
    meta.profiles = meta.profiles.filter(p => p !== name);
    saveProfilesMeta(meta);

    return { success: true, message: `Profile '${name}' deleted` };
}

// Rename profile (with locking)
function renameProfile(oldName, newName) {
    return withLock(() => _renameProfile(oldName, newName));
}

function _renameProfile(oldName, newName) {
    if (oldName === 'current') {
        throw new Error("Cannot rename 'current' profile - it's a system snapshot");
    }

    if (!profileExists(oldName)) {
        throw new Error(`Profile '${oldName}' does not exist`);
    }

    if (profileExists(newName)) {
        throw new Error(`Profile '${newName}' already exists`);
    }

    // Validate name
    if (!PROFILE_NAME_REGEX.test(newName)) {
        throw new Error('Profile name can only contain letters, numbers, hyphens, and underscores');
    }

    const oldDir = path.join(PROFILES_DIR, oldName);
    const newDir = path.join(PROFILES_DIR, newName);

    fs.renameSync(oldDir, newDir);

    // Update name field in profile.json
    const profile = loadProfile(newName);
    profile.name = newName;
    profile.updatedAt = new Date().toISOString();
    saveProfile(newName, profile);

    // Update profiles.json
    const meta = loadProfilesMeta();
    meta.profiles = meta.profiles.map(p => p === oldName ? newName : p);
    if (meta.activeProfile === oldName) {
        meta.activeProfile = newName;
    }
    saveProfilesMeta(meta);

    return { success: true, message: `Profile renamed from '${oldName}' to '${newName}'` };
}

// Get profile details
function getProfile(name) {
    if (!profileExists(name)) {
        throw new Error(`Profile '${name}' does not exist`);
    }

    const profile = loadProfile(name);
    const meta = loadProfilesMeta();

    return {
        ...profile,
        active: meta.activeProfile === name,
        enabledPluginsList: Object.entries(profile.settings?.enabledPlugins || {})
            .filter(([_, enabled]) => enabled)
            .map(([name]) => name),
        hooksList: Object.keys(profile.settings?.hooks || {}),
        mcpServersList: Object.keys(profile.mcpServers || {})
    };
}

// Restore from backup (with locking)
function restoreFromBackup(backupName) {
    return withLock(() => _restoreFromBackup(backupName));
}

function _restoreFromBackup(backupName) {
    const backupDir = path.join(BACKUPS_DIR, backupName);
    if (!fs.existsSync(backupDir)) {
        throw new Error(`Backup '${backupName}' does not exist`);
    }

    const settingsBackup = path.join(backupDir, 'settings.json');
    if (fs.existsSync(settingsBackup)) {
        fs.copyFileSync(settingsBackup, SETTINGS_JSON);
    }

    const manifestBackup = path.join(backupDir, 'active-manifest.json');
    if (fs.existsSync(manifestBackup)) {
        fs.copyFileSync(manifestBackup, ACTIVE_MANIFEST);
    }

    const metaBackup = readJSON(path.join(backupDir, 'meta.json'));
    if (metaBackup?.previousProfile) {
        const meta = loadProfilesMeta();
        meta.activeProfile = metaBackup.previousProfile;
        saveProfilesMeta(meta);
    }

    return { success: true, message: `Restored from backup '${backupName}'` };
}

// List backups (with detailed info from backup contents)
function listBackups() {
    if (!fs.existsSync(BACKUPS_DIR)) {
        return [];
    }

    return fs.readdirSync(BACKUPS_DIR)
        .filter(f => f.startsWith('backup-'))
        .sort()
        .reverse()
        .map(name => {
            const backupDir = path.join(BACKUPS_DIR, name);
            const meta = readJSON(path.join(backupDir, 'meta.json'));
            const settings = readJSON(path.join(backupDir, 'settings.json'));
            const mcpServers = readJSON(path.join(backupDir, 'mcpServers.json'));
            const manifest = readJSON(path.join(backupDir, 'active-manifest.json'));

            // Extract plugin details
            const plugins = settings?.enabledPlugins || {};
            const enabledPlugins = Object.entries(plugins)
                .filter(([_, enabled]) => enabled)
                .map(([name]) => name);
            const disabledPlugins = Object.entries(plugins)
                .filter(([_, enabled]) => !enabled)
                .map(([name]) => name);

            // Extract MCP server names
            const mcpServerNames = Object.keys(mcpServers || {});

            // Extract hooks info
            const hookNames = Object.keys(settings?.hooks || {});

            // Calculate backup size
            let sizeBytes = 0;
            try {
                const files = fs.readdirSync(backupDir);
                for (const file of files) {
                    sizeBytes += fs.statSync(path.join(backupDir, file)).size;
                }
            } catch {}

            return {
                name,
                previousProfile: meta?.previousProfile || null,
                backupTime: meta?.backupTime || null,
                settings: {
                    enabledPlugins,
                    disabledPlugins,
                    hooks: hookNames,
                    hasStatusLine: !!settings?.statusLine,
                    hasEnv: Object.keys(settings?.env || {}).length > 0,
                    permissionMode: settings?.permissions?.defaultMode || 'default'
                },
                mcpServers: mcpServerNames,
                components: manifest?.components || null,
                sizeBytes
            };
        });
}

// Initialize system (with locking)
function init() {
    return withLock(() => _init());
}

function _init() {
    ensureDir(PROFILES_DIR);
    ensureDir(BACKUPS_DIR);

    // Initialize profiles.json
    if (!fs.existsSync(PROFILES_JSON)) {
        saveProfilesMeta({
            activeProfile: 'current',
            profiles: ['current', 'clean'],
            createdAt: new Date().toISOString(),
            version: '2.0.0',
            symlinkEnabled: true
        });
    }

    // Create current profile (settings snapshot)
    if (!profileExists('current')) {
        exportCurrentToProfile('current', 'Snapshot of current settings');
    }

    // Prepare current profile directory
    const currentProfileDir = getProfileDir('current');
    ensureDir(currentProfileDir);

    // Move existing directories to current profile and create symlinks
    const symlinkResults = [];
    for (const dir of SYMLINK_DIRS) {
        const claudeDir = getClaudeComponentDir(dir);
        const profileDir = getProfileComponentDir('current', dir);

        // Skip if already symlink
        if (isSymlink(claudeDir)) {
            symlinkResults.push({ dir, status: 'already_symlink', target: getSymlinkTarget(claudeDir) });
            continue;
        }

        // Move real directory to current profile if exists
        if (fs.existsSync(claudeDir)) {
            // Backup instead of merge if profileDir exists
            if (fs.existsSync(profileDir)) {
                const backupName = `${profileDir}.backup-${getTimestamp()}`;
                fs.renameSync(profileDir, backupName);
            }
            // Move directory
            fs.renameSync(claudeDir, profileDir);
            symlinkResults.push({ dir, status: 'moved', from: claudeDir, to: profileDir });
        } else {
            // Create empty directory in profile if not exists
            ensureDir(profileDir);
            symlinkResults.push({ dir, status: 'created_empty', path: profileDir });
        }

        // Create symlink
        createSymlink(profileDir, claudeDir);
        symlinkResults.push({ dir, status: 'symlink_created', link: claudeDir, target: profileDir });
    }

    // Create clean profile (empty directories + profile command)
    if (!profileExists('clean')) {
        const cleanDir = getProfileDir('clean');
        ensureDir(cleanDir);

        // Create empty directories in clean profile
        for (const dir of SYMLINK_DIRS) {
            ensureDir(getProfileComponentDir('clean', dir));
        }

        // Copy profile command (for switch functionality)
        const profileCmdSrc = getProfileComponentDir('current', 'commands/profile');
        const profileCmdDest = getProfileComponentDir('clean', 'commands/profile');
        if (fs.existsSync(profileCmdSrc)) {
            copyDirRecursive(profileCmdSrc, profileCmdDest);
        }

        // Create clean profile metadata
        const cleanProfile = {
            name: 'clean',
            description: 'Clean slate - no plugins, hooks, MCP, commands, skills, or agents',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            settings: {
                enabledPlugins: { [SELF_PLUGIN_KEY]: true },
                hooks: {},
                statusLine: null,
                env: {},
                permissions: { defaultMode: 'default' },
                alwaysThinkingEnabled: true,
                autoUpdatesChannel: 'latest'
            },
            mcpServers: {},
            components: {
                commands: { mode: 'whitelist', include: [] },
                skills: { mode: 'whitelist', include: [] },
                agents: { mode: 'whitelist', include: [] }
            }
        };
        saveProfile('clean', cleanProfile);
    }

    return {
        success: true,
        message: 'Profile system initialized with symlink support',
        profilesDir: PROFILES_DIR,
        symlinks: symlinkResults,
        profiles: listProfiles()
    };
}

// CLI interface
const command = process.argv[2];
const args = process.argv.slice(3);

try {
    let result;

    switch (command) {
        case 'init':
            result = init();
            break;
        case 'list':
            result = listProfiles();
            break;
        case 'switch':
            if (!args[0]) throw new Error('Profile name required');
            result = switchToProfile(args[0]);
            break;
        case 'create':
            if (!args[0]) throw new Error('Profile name required');
            // Parse --copy= option
            const copyArg = args.find(a => a.startsWith('--copy='));
            const copyItems = copyArg ? copyArg.slice(7).split(',').map(s => s.trim()) : [];
            result = createProfile(args[0], {
                fromCurrent: args.includes('--from-current'),
                clean: args.includes('--clean'),
                description: args.find(a => a.startsWith('--desc='))?.slice(7) || '',
                copy: copyItems
            });
            break;
        case 'delete':
            if (!args[0]) throw new Error('Profile name required');
            result = deleteProfile(args[0]);
            break;
        case 'rename':
            if (!args[0] || !args[1]) throw new Error('Old and new names required');
            result = renameProfile(args[0], args[1]);
            break;
        case 'export':
            const exportName = args[0] || 'current';
            result = exportCurrentToProfile(exportName, 'Updated snapshot of settings');
            result = { success: true, message: `Settings exported to profile '${exportName}'` };
            break;
        case 'get':
            if (!args[0]) throw new Error('Profile name required');
            result = getProfile(args[0]);
            break;
        case 'backup':
            result = { success: true, backup: backupCurrentSettings() };
            break;
        case 'backups':
            result = listBackups();
            break;
        case 'restore':
            if (!args[0]) throw new Error('Backup name required');
            result = restoreFromBackup(args[0]);
            break;
        case 'version':
            const selfPkg = readJSON(path.join(path.dirname(__dirname), 'package.json')) || {};
            const versionMeta = loadProfilesMeta();
            const profileVersions = [];
            if (fs.existsSync(PROFILES_DIR)) {
                const entries = fs.readdirSync(PROFILES_DIR, { withFileTypes: true });
                for (const entry of entries) {
                    if (entry.isDirectory() && !entry.name.startsWith('.')) {
                        const profile = readJSON(path.join(PROFILES_DIR, entry.name, 'profile.json'));
                        if (profile) {
                            const enabled = !!profile.settings?.enabledPlugins?.[SELF_PLUGIN_KEY];
                            profileVersions.push({
                                profile: entry.name,
                                active: versionMeta.activeProfile === entry.name,
                                pluginEnabled: enabled
                            });
                        }
                    }
                }
            }
            // Gather version sources
            const installedInfo = readJSON(path.join(CLAUDE_DIR, 'plugins', 'installed_plugins.json'));
            const installedEntry = installedInfo?.plugins?.[SELF_PLUGIN_KEY]?.[0];
            const mktPluginJson = readJSON(path.join(CLAUDE_DIR, 'plugins', 'marketplaces', 'claude-switch', '.claude-plugin', 'plugin.json'));
            result = {
                version: selfPkg.version || 'unknown',
                source: __dirname,
                registry: {
                    installed: installedEntry?.version || 'unknown',
                    marketplace: mktPluginJson?.version || 'unknown'
                },
                profiles: profileVersions
            };
            break;
        case 'update':
            result = updatePluginCache();
            if (!result) {
                throw new Error('Cannot update: either running from plugin cache (no source to sync from) or plugin cache not found');
            }
            result.success = true;
            const removedStr = result.removed.length > 0 ? ` Removed old: ${result.removed.join(', ')}` : '';
            result.message = `Plugin cache updated to v${result.version}.${removedStr}`;
            break;
        default:
            console.log(`
Claude Code Profile Switcher v1.6.2

Usage:
  node profile-switcher.js <command> [args]

Commands:
  init                    Initialize profile system
  list                    List all profiles
  switch <name>           Switch to a profile
  create <name> [opts]    Create new profile
    --copy=items          Copy specific items (comma-separated)
                          Items: plugins,hooks,statusline,env,permissions,mcp,commands,skills,agents,all
    --from-current        Copy all settings (same as --copy=all)
    --clean               Create empty profile (no settings, whitelist mode)
    --desc="description"  Add description
  delete <name>           Delete a profile
  rename <old> <new>      Rename a profile
  export [name]           Export current settings (default: 'current')
  get <name>              Get profile details
  backup                  Create backup of current settings
  backups                 List all backups
  restore <backup>        Restore from backup
  update                  Sync source to plugin cache
  version                 Show current version

Examples:
  node profile-switcher.js init
  node profile-switcher.js create dev --from-current --desc="Development"
  node profile-switcher.js create minimal --copy=plugins,commands --desc="Minimal setup"
  node profile-switcher.js create work --copy=all --desc="Work profile"
  node profile-switcher.js switch clean
  node profile-switcher.js list
`);
            process.exit(0);
    }

    console.log(JSON.stringify(result, null, 2));
} catch (error) {
    console.error(JSON.stringify({ error: error.message }));
    process.exit(1);
}
