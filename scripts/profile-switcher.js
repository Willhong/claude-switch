#!/usr/bin/env node
/**
 * Claude Code Profile Switcher
 * 프로파일 CRUD 및 스위칭 로직
 *
 * @version 1.0.0
 * @author Hong
 */

const fs = require('fs');
const path = require('path');

const CLAUDE_DIR = path.join(process.env.HOME || process.env.USERPROFILE, '.claude');
const PROFILES_DIR = path.join(CLAUDE_DIR, 'profiles');
const BACKUPS_DIR = path.join(PROFILES_DIR, '.backups');
const PROFILES_JSON = path.join(PROFILES_DIR, 'profiles.json');
const SETTINGS_JSON = path.join(CLAUDE_DIR, 'settings.json');
const ACTIVE_MANIFEST = path.join(CLAUDE_DIR, 'active-manifest.json');

// 유틸리티 함수
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

// 프로파일 메타데이터 관리
function loadProfilesMeta() {
    return readJSON(PROFILES_JSON) || {
        activeProfile: 'current',
        profiles: []
    };
}

function saveProfilesMeta(meta) {
    writeJSON(PROFILES_JSON, meta);
}

// 프로파일 목록
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
                profiles.push({
                    name: entry.name,
                    description: profile.description || '',
                    active: meta.activeProfile === entry.name,
                    createdAt: profile.createdAt,
                    pluginCount: Object.keys(profile.settings?.enabledPlugins || {}).filter(
                        k => profile.settings.enabledPlugins[k]
                    ).length,
                    hasHooks: Object.keys(profile.settings?.hooks || {}).length > 0,
                    hasStatusLine: !!profile.settings?.statusLine
                });
            }
        }
    }

    return profiles;
}

// 프로파일 존재 확인
function profileExists(name) {
    return fs.existsSync(path.join(PROFILES_DIR, name, 'profile.json'));
}

// 프로파일 로드
function loadProfile(name) {
    const profilePath = path.join(PROFILES_DIR, name, 'profile.json');
    return readJSON(profilePath);
}

// 프로파일 저장
function saveProfile(name, profile) {
    const profileDir = path.join(PROFILES_DIR, name);
    ensureDir(profileDir);
    writeJSON(path.join(profileDir, 'profile.json'), profile);
}

// 현재 설정 백업
function backupCurrentSettings() {
    ensureDir(BACKUPS_DIR);
    const timestamp = getTimestamp();
    const backupDir = path.join(BACKUPS_DIR, `backup-${timestamp}`);
    ensureDir(backupDir);

    // settings.json 백업
    if (fs.existsSync(SETTINGS_JSON)) {
        fs.copyFileSync(SETTINGS_JSON, path.join(backupDir, 'settings.json'));
    }

    // active-manifest.json 백업
    if (fs.existsSync(ACTIVE_MANIFEST)) {
        fs.copyFileSync(ACTIVE_MANIFEST, path.join(backupDir, 'active-manifest.json'));
    }

    // 메타 정보 저장
    const meta = loadProfilesMeta();
    writeJSON(path.join(backupDir, 'meta.json'), {
        previousProfile: meta.activeProfile,
        backupTime: new Date().toISOString()
    });

    // 오래된 백업 정리 (최대 10개 유지)
    cleanOldBackups(10);

    return backupDir;
}

// 오래된 백업 정리
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

// 현재 설정을 프로파일로 내보내기
function exportCurrentToProfile(name, description = '') {
    const settings = readJSON(SETTINGS_JSON) || {};

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
        components: {
            commands: { mode: 'all', include: [] },
            skills: { mode: 'all', include: [] },
            agents: { mode: 'all', include: [] }
        }
    };

    saveProfile(name, profile);
    return profile;
}

// 프로파일로 스위칭
function switchToProfile(name) {
    if (!profileExists(name)) {
        throw new Error(`Profile '${name}' does not exist`);
    }

    // 1. 현재 설정 백업
    const backupPath = backupCurrentSettings();

    // 2. 프로파일 로드
    const profile = loadProfile(name);

    // 3. settings.json 업데이트
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

    // statusLine이 null이면 키 자체를 제거
    if (newSettings.statusLine === null) {
        delete newSettings.statusLine;
    }

    writeJSON(SETTINGS_JSON, newSettings);

    // 4. active-manifest.json 업데이트 (컴포넌트 격리용)
    const manifest = {
        profile: name,
        updatedAt: new Date().toISOString(),
        components: profile.components || {}
    };
    writeJSON(ACTIVE_MANIFEST, manifest);

    // 5. profiles.json 업데이트
    const meta = loadProfilesMeta();
    meta.activeProfile = name;
    meta.lastSwitch = new Date().toISOString();
    saveProfilesMeta(meta);

    return {
        success: true,
        profile: name,
        backup: backupPath,
        settings: {
            plugins: Object.keys(profile.settings.enabledPlugins || {}).filter(
                k => profile.settings.enabledPlugins[k]
            ).length,
            hooks: Object.keys(profile.settings.hooks || {}).length,
            hasStatusLine: !!profile.settings.statusLine
        },
        message: `Switched to profile '${name}'. Please restart Claude Code for changes to take effect.`
    };
}

// 새 프로파일 생성
function createProfile(name, options = {}) {
    if (profileExists(name)) {
        throw new Error(`Profile '${name}' already exists`);
    }

    // 이름 유효성 검사
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
        throw new Error('Profile name can only contain letters, numbers, hyphens, and underscores');
    }

    const { fromCurrent = false, description = '', clean = false } = options;

    let profile;

    if (fromCurrent) {
        profile = exportCurrentToProfile(name, description || `Copied from current settings`);
    } else if (clean) {
        profile = {
            name: name,
            description: description || 'Clean profile - no plugins, hooks, or extensions',
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
            components: {
                commands: { mode: 'whitelist', include: [] },
                skills: { mode: 'whitelist', include: [] },
                agents: { mode: 'whitelist', include: [] }
            }
        };
        saveProfile(name, profile);
    } else {
        profile = {
            name: name,
            description: description || 'Custom profile',
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
            components: {
                commands: { mode: 'all', include: [] },
                skills: { mode: 'all', include: [] },
                agents: { mode: 'all', include: [] }
            }
        };
        saveProfile(name, profile);
    }

    // profiles.json 목록 업데이트
    const meta = loadProfilesMeta();
    if (!meta.profiles.includes(name)) {
        meta.profiles.push(name);
        saveProfilesMeta(meta);
    }

    return { success: true, profile: profile, message: `Profile '${name}' created` };
}

// 프로파일 삭제
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

    // profiles.json 목록 업데이트
    meta.profiles = meta.profiles.filter(p => p !== name);
    saveProfilesMeta(meta);

    return { success: true, message: `Profile '${name}' deleted` };
}

// 프로파일 이름 변경
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

    // 이름 유효성 검사
    if (!/^[a-zA-Z0-9_-]+$/.test(newName)) {
        throw new Error('Profile name can only contain letters, numbers, hyphens, and underscores');
    }

    const oldDir = path.join(PROFILES_DIR, oldName);
    const newDir = path.join(PROFILES_DIR, newName);

    fs.renameSync(oldDir, newDir);

    // profile.json 내의 name 필드 업데이트
    const profile = loadProfile(newName);
    profile.name = newName;
    profile.updatedAt = new Date().toISOString();
    saveProfile(newName, profile);

    // profiles.json 업데이트
    const meta = loadProfilesMeta();
    meta.profiles = meta.profiles.map(p => p === oldName ? newName : p);
    if (meta.activeProfile === oldName) {
        meta.activeProfile = newName;
    }
    saveProfilesMeta(meta);

    return { success: true, message: `Profile renamed from '${oldName}' to '${newName}'` };
}

// 프로파일 상세 정보
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
        hooksList: Object.keys(profile.settings?.hooks || {})
    };
}

// 백업에서 복원
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

// 백업 목록
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

// 시스템 초기화
function init() {
    ensureDir(PROFILES_DIR);
    ensureDir(BACKUPS_DIR);

    // profiles.json 초기화
    if (!fs.existsSync(PROFILES_JSON)) {
        saveProfilesMeta({
            activeProfile: 'current',
            profiles: ['current', 'clean'],
            createdAt: new Date().toISOString(),
            version: '1.0.0'
        });
    }

    // current 프로파일 생성 (현재 설정 스냅샷)
    if (!profileExists('current')) {
        exportCurrentToProfile('current', 'Snapshot of current settings');
    }

    // clean 프로파일 생성
    if (!profileExists('clean')) {
        createProfile('clean', {
            clean: true,
            description: 'Clean slate - no plugins, hooks, commands, or extensions'
        });
    }

    return {
        success: true,
        message: 'Profile system initialized',
        profilesDir: PROFILES_DIR,
        profiles: listProfiles()
    };
}

// CLI 인터페이스
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
            result = createProfile(args[0], {
                fromCurrent: args.includes('--from-current'),
                clean: args.includes('--clean'),
                description: args.find(a => a.startsWith('--desc='))?.slice(7) || ''
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
Claude Code Profile Switcher v1.0.0

Usage:
  node profile-switcher.js <command> [args]

Commands:
  init                    Initialize profile system
  list                    List all profiles
  switch <name>           Switch to a profile
  create <name> [opts]    Create new profile
    --from-current        Copy current settings
    --clean               Create empty profile
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
