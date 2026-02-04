#!/usr/bin/env node
/**
 * Claude Code Profile Switcher
 * Profile CRUD and switching logic
 *
 * @version 1.1.0
 * @author Hong
 */

const fs = require('fs');
const path = require('path');

const { execSync } = require('child_process');

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
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
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
            // Node.js symlinkSync with 'junction' type
            fs.symlinkSync(absTarget, absLink, 'junction');
        } catch (err) {
            // Fall back to mklink command on failure
            try {
                execSync(`mklink /J "${absLink}" "${absTarget}"`, { stdio: 'ignore', shell: true });
            } catch {
                throw new Error(`Failed to create junction: ${err.message}`);
            }
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

// Switch to profile
function switchToProfile(name) {
    if (!profileExists(name)) {
        throw new Error(`Profile '${name}' does not exist`);
    }

    // 1. Backup current settings
    const backupPath = backupCurrentSettings();

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

    // Remove key if statusLine is null
    if (newSettings.statusLine === null) {
        delete newSettings.statusLine;
    }

    writeJSON(SETTINGS_JSON, newSettings);

    // 4. Switch MCP server settings
    const mcpServers = profile.mcpServers || {};
    saveMcpServers(mcpServers);

    // 5. Switch symlinks
    const symlinkResults = switchSymlinks(name);

    // 6. Update active-manifest.json (for component isolation)
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

    return {
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

// Create new profile
function createProfile(name, options = {}) {
    if (profileExists(name)) {
        throw new Error(`Profile '${name}' already exists`);
    }

    // Validate name
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
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
            enabledPlugins: {},
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

// Delete profile
function deleteProfile(name) {
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

// Rename profile
function renameProfile(oldName, newName) {
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
    if (!/^[a-zA-Z0-9_-]+$/.test(newName)) {
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

// Restore from backup
function restoreFromBackup(backupName) {
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

// List backups
function listBackups() {
    if (!fs.existsSync(BACKUPS_DIR)) {
        return [];
    }

    return fs.readdirSync(BACKUPS_DIR)
        .filter(f => f.startsWith('backup-'))
        .sort()
        .reverse()
        .map(name => {
            const metaPath = path.join(BACKUPS_DIR, name, 'meta.json');
            const meta = readJSON(metaPath);
            return {
                name,
                previousProfile: meta?.previousProfile,
                backupTime: meta?.backupTime
            };
        });
}

// Initialize system
function init() {
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
                enabledPlugins: {},
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
        default:
            console.log(`
Claude Code Profile Switcher v1.1.0

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
