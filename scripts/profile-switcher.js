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

const { execSync } = require('child_process');

const CLAUDE_DIR = path.join(process.env.HOME || process.env.USERPROFILE, '.claude');
const PROFILES_DIR = path.join(CLAUDE_DIR, 'profiles');
const BACKUPS_DIR = path.join(PROFILES_DIR, '.backups');
const PROFILES_JSON = path.join(PROFILES_DIR, 'profiles.json');
const SETTINGS_JSON = path.join(CLAUDE_DIR, 'settings.json');
const ACTIVE_MANIFEST = path.join(CLAUDE_DIR, 'active-manifest.json');
// MCP 설정은 ~/.claude.json에 저장됨
const CLAUDE_JSON = path.join(process.env.HOME || process.env.USERPROFILE, '.claude.json');

// 심볼릭 링크로 관리할 디렉토리 목록
const SYMLINK_DIRS = ['commands', 'skills', 'agents'];
const IS_WINDOWS = process.platform === 'win32';

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

// 심볼릭 링크 유틸리티
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
        // 심볼릭 링크 제거
        if (IS_WINDOWS) {
            // Windows에서는 junction은 rmdir로 제거
            try {
                fs.rmdirSync(filepath);
            } catch {
                fs.unlinkSync(filepath);
            }
        } else {
            fs.unlinkSync(filepath);
        }
    } else if (fs.existsSync(filepath)) {
        // 일반 디렉토리는 삭제하지 않음 (안전장치)
        throw new Error(`'${filepath}' is not a symlink. Move it manually first.`);
    }
}

function createSymlink(target, linkPath) {
    // 기존 링크가 있으면 제거
    if (isSymlink(linkPath)) {
        removeSymlinkOrDir(linkPath);
    }

    if (IS_WINDOWS) {
        // Windows: junction 사용 (관리자 권한 불필요)
        // junction은 절대 경로 필요
        const absTarget = path.resolve(target);
        const absLink = path.resolve(linkPath);

        try {
            // Node.js의 symlinkSync with 'junction' 타입
            fs.symlinkSync(absTarget, absLink, 'junction');
        } catch (err) {
            // 실패하면 mklink 명령어 시도
            try {
                execSync(`mklink /J "${absLink}" "${absTarget}"`, { stdio: 'ignore', shell: true });
            } catch {
                throw new Error(`Failed to create junction: ${err.message}`);
            }
        }
    } else {
        // Unix: 상대 경로 심볼릭 링크
        const relTarget = path.relative(path.dirname(linkPath), target);
        fs.symlinkSync(relTarget, linkPath);
    }
}

// 프로파일 디렉토리 경로
function getProfileDir(name) {
    return path.join(PROFILES_DIR, name);
}

function getProfileComponentDir(profileName, component) {
    return path.join(getProfileDir(profileName), component);
}

function getClaudeComponentDir(component) {
    return path.join(CLAUDE_DIR, component);
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
                // 컴포넌트 개수 계산
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

// MCP 서버 설정 로드
function loadMcpServers() {
    const claudeJson = readJSON(CLAUDE_JSON);
    return claudeJson?.mcpServers || {};
}

// MCP 서버 설정 저장
function saveMcpServers(mcpServers) {
    const claudeJson = readJSON(CLAUDE_JSON) || {};
    claudeJson.mcpServers = mcpServers;
    writeJSON(CLAUDE_JSON, claudeJson);
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

    // MCP 서버 설정 백업
    const mcpServers = loadMcpServers();
    writeJSON(path.join(backupDir, 'mcpServers.json'), mcpServers);

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

// 심볼릭 링크 전환
function switchSymlinks(profileName) {
    const results = [];
    const profileDir = getProfileDir(profileName);

    for (const dir of SYMLINK_DIRS) {
        const claudeDir = getClaudeComponentDir(dir);
        const targetDir = getProfileComponentDir(profileName, dir);

        // 프로파일에 해당 디렉토리가 없으면 생성
        if (!fs.existsSync(targetDir)) {
            ensureDir(targetDir);
            results.push({ dir, action: 'created_target', path: targetDir });
        }

        // 기존 심볼릭 링크 제거 및 새 링크 생성
        try {
            if (isSymlink(claudeDir)) {
                removeSymlinkOrDir(claudeDir);
            } else if (fs.existsSync(claudeDir)) {
                // 실제 디렉토리가 있으면 에러
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

    // 4. MCP 서버 설정 전환
    const mcpServers = profile.mcpServers || {};
    saveMcpServers(mcpServers);

    // 5. 심볼릭 링크 전환
    const symlinkResults = switchSymlinks(name);

    // 6. active-manifest.json 업데이트 (컴포넌트 격리용)
    const manifest = {
        profile: name,
        updatedAt: new Date().toISOString(),
        components: profile.components || {},
        symlinks: symlinkResults
    };
    writeJSON(ACTIVE_MANIFEST, manifest);

    // 7. profiles.json 업데이트
    const meta = loadProfilesMeta();
    meta.activeProfile = name;
    meta.lastSwitch = new Date().toISOString();
    saveProfilesMeta(meta);

    // 프로파일 디렉토리의 컴포넌트 개수 계산
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

// 디렉토리 복사 (재귀)
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
    const profileDir = getProfileDir(name);
    ensureDir(profileDir);

    if (fromCurrent) {
        profile = exportCurrentToProfile(name, description || `Copied from current settings`);

        // 현재 활성 프로파일의 컴포넌트 디렉토리 복사
        const meta = loadProfilesMeta();
        const sourceProfile = meta.activeProfile || 'current';

        for (const dir of SYMLINK_DIRS) {
            const sourceDir = getProfileComponentDir(sourceProfile, dir);
            const targetDir = getProfileComponentDir(name, dir);

            if (fs.existsSync(sourceDir)) {
                copyDirRecursive(sourceDir, targetDir);
            } else {
                ensureDir(targetDir);
            }
        }
    } else if (clean) {
        profile = {
            name: name,
            description: description || 'Clean profile - no plugins, hooks, MCP, or extensions',
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
        saveProfile(name, profile);

        // 빈 디렉토리 생성 + profile 커맨드 복사 (전환 기능 유지)
        for (const dir of SYMLINK_DIRS) {
            ensureDir(getProfileComponentDir(name, dir));
        }
        // profile 커맨드는 항상 복사 (전환 기능이 항상 동작하도록)
        const profileCmdSrc = getProfileComponentDir('current', 'commands/profile');
        const profileCmdDest = getProfileComponentDir(name, 'commands/profile');
        if (fs.existsSync(profileCmdSrc)) {
            copyDirRecursive(profileCmdSrc, profileCmdDest);
        }
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
            mcpServers: {},
            components: {
                commands: { mode: 'all', include: [] },
                skills: { mode: 'all', include: [] },
                agents: { mode: 'all', include: [] }
            }
        };
        saveProfile(name, profile);

        // 빈 디렉토리 생성 + profile 커맨드 복사 (전환 기능 유지)
        for (const dir of SYMLINK_DIRS) {
            ensureDir(getProfileComponentDir(name, dir));
        }
        // profile 커맨드는 항상 복사 (전환 기능이 항상 동작하도록)
        const profileCmdSrc = getProfileComponentDir('current', 'commands/profile');
        const profileCmdDest = getProfileComponentDir(name, 'commands/profile');
        if (fs.existsSync(profileCmdSrc)) {
            copyDirRecursive(profileCmdSrc, profileCmdDest);
        }
    }

    // profiles.json 목록 업데이트
    const meta = loadProfilesMeta();
    if (!meta.profiles.includes(name)) {
        meta.profiles.push(name);
        saveProfilesMeta(meta);
    }

    // 컴포넌트 개수 계산
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
        hooksList: Object.keys(profile.settings?.hooks || {}),
        mcpServersList: Object.keys(profile.mcpServers || {})
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
            version: '2.0.0',
            symlinkEnabled: true
        });
    }

    // current 프로파일 생성 (현재 설정 스냅샷)
    if (!profileExists('current')) {
        exportCurrentToProfile('current', 'Snapshot of current settings');
    }

    // current 프로파일 디렉토리 준비
    const currentProfileDir = getProfileDir('current');
    ensureDir(currentProfileDir);

    // 기존 디렉토리를 current 프로파일로 이동 및 심볼릭 링크 생성
    const symlinkResults = [];
    for (const dir of SYMLINK_DIRS) {
        const claudeDir = getClaudeComponentDir(dir);
        const profileDir = getProfileComponentDir('current', dir);

        // 이미 심볼릭 링크면 건너뜀
        if (isSymlink(claudeDir)) {
            symlinkResults.push({ dir, status: 'already_symlink', target: getSymlinkTarget(claudeDir) });
            continue;
        }

        // 실제 디렉토리가 존재하면 current 프로파일로 이동
        if (fs.existsSync(claudeDir)) {
            // profileDir이 이미 존재하면 병합하지 않고 백업
            if (fs.existsSync(profileDir)) {
                const backupName = `${profileDir}.backup-${getTimestamp()}`;
                fs.renameSync(profileDir, backupName);
            }
            // 디렉토리 이동
            fs.renameSync(claudeDir, profileDir);
            symlinkResults.push({ dir, status: 'moved', from: claudeDir, to: profileDir });
        } else {
            // 디렉토리가 없으면 프로파일에 빈 디렉토리 생성
            ensureDir(profileDir);
            symlinkResults.push({ dir, status: 'created_empty', path: profileDir });
        }

        // 심볼릭 링크 생성
        createSymlink(profileDir, claudeDir);
        symlinkResults.push({ dir, status: 'symlink_created', link: claudeDir, target: profileDir });
    }

    // clean 프로파일 생성 (빈 디렉토리들 + profile 커맨드)
    if (!profileExists('clean')) {
        const cleanDir = getProfileDir('clean');
        ensureDir(cleanDir);

        // clean 프로파일에 빈 디렉토리 생성
        for (const dir of SYMLINK_DIRS) {
            ensureDir(getProfileComponentDir('clean', dir));
        }

        // profile 커맨드 복사 (전환 기능이 항상 동작하도록)
        const profileCmdSrc = getProfileComponentDir('current', 'commands/profile');
        const profileCmdDest = getProfileComponentDir('clean', 'commands/profile');
        if (fs.existsSync(profileCmdSrc)) {
            copyDirRecursive(profileCmdSrc, profileCmdDest);
        }

        // clean 프로파일 메타데이터 생성
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
