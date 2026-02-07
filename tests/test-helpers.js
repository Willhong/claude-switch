const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'profile-switcher.js');

/**
 * Create an isolated test sandbox with temp directory and env overrides.
 * Returns { dir, claudeDir, claudeJson, cleanup, run }
 */
function createTestSandbox() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-switch-test-'));
    const claudeDir = path.join(dir, '.claude');
    const claudeJson = path.join(dir, '.claude.json');

    // Initialize minimal structure
    fs.mkdirSync(path.join(claudeDir, 'profiles'), { recursive: true });

    // Create a minimal settings.json
    fs.writeFileSync(
        path.join(claudeDir, 'settings.json'),
        JSON.stringify(
            {
                enabledPlugins: {}
            },
            null,
            2
        )
    );

    // Create a minimal profiles.json
    fs.writeFileSync(
        path.join(claudeDir, 'profiles', 'profiles.json'),
        JSON.stringify(
            {
                activeProfile: 'current',
                profiles: [
                    {
                        name: 'current',
                        description: 'Default profile (system-created)',
                        createdAt: new Date().toISOString()
                    }
                ]
            },
            null,
            2
        )
    );

    // Create the 'current' profile directory
    const currentProfileDir = path.join(claudeDir, 'profiles', 'current');
    fs.mkdirSync(currentProfileDir, { recursive: true });
    fs.writeFileSync(
        path.join(currentProfileDir, 'profile.json'),
        JSON.stringify(
            {
                name: 'current',
                description: 'Default profile (system-created)',
                createdAt: new Date().toISOString(),
                settings: { enabledPlugins: {} }
            },
            null,
            2
        )
    );

    // Create symlink directories for commands, skills, agents
    for (const symDir of ['commands', 'skills', 'agents']) {
        const profileSymDir = path.join(currentProfileDir, symDir);
        fs.mkdirSync(profileSymDir, { recursive: true });
    }

    const env = {
        ...process.env,
        CLAUDE_DIR_OVERRIDE: claudeDir,
        CLAUDE_JSON_OVERRIDE: claudeJson
    };

    /**
     * Run a profile-switcher command in the sandbox
     */
    function run(cmd) {
        try {
            const output = execSync(`node "${SCRIPT}" ${cmd}`, {
                encoding: 'utf-8',
                env,
                timeout: 10000
            });
            return { ok: true, output: JSON.parse(output) };
        } catch (err) {
            const stderr = err.stderr?.toString() || '';
            const stdout = err.stdout?.toString() || '';
            try {
                return { ok: false, error: JSON.parse(stderr || stdout) };
            } catch {
                return { ok: false, error: { message: stderr || stdout || err.message } };
            }
        }
    }

    function cleanup() {
        try {
            fs.rmSync(dir, { recursive: true, force: true });
        } catch {}
    }

    return { dir, claudeDir, claudeJson, env, run, cleanup };
}

/**
 * Simple test assertion helpers
 */
let _passed = 0;
let _failed = 0;

function assert(condition, name, detail) {
    if (condition) {
        console.log(`  PASS: ${name}`);
        _passed++;
    } else {
        console.log(`  FAIL: ${name}${detail ? ' - ' + detail : ''}`);
        _failed++;
    }
}

function getResults() {
    return { passed: _passed, failed: _failed };
}

function resetResults() {
    _passed = 0;
    _failed = 0;
}

function printResults() {
    console.log(`\n=== Results: ${_passed} passed, ${_failed} failed ===`);
    return _failed > 0 ? 1 : 0;
}

module.exports = { createTestSandbox, assert, getResults, resetResults, printResults, SCRIPT };
