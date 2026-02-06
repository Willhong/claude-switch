# claude-switch

Claude Code profile switching system - easily manage and switch between multiple configurations.

## Features

- **Profile Management**: Create, switch, and delete multiple settings profiles
- **Auto Backup**: Safe settings changes with automatic backup on switch
- **Full Settings Support**: Includes plugins, hooks, env vars, permissions, statusline, MCP servers
- **Quick Switching**: Fast switching between clean and development environments
- **Atomic Writes**: All file writes use temp-file-then-rename to prevent data corruption
- **File Locking**: Concurrent operations are serialized to prevent race conditions
- **Rollback on Failure**: Failed profile switches automatically restore the previous state
- **Cross-Platform**: Works on Windows (junctions), macOS, and Linux (symlinks)

## Installation

### Add Marketplace & Install

```
/plugin marketplace add Willhong/claude-switch
/plugin install claude-switch
```

### Install from GitHub URL

```bash
claude plugins:add https://github.com/Willhong/claude-switch
```

### Manual Installation

```bash
git clone https://github.com/Willhong/claude-switch.git ~/.claude/plugins/claude-switch
cd ~/.claude/plugins/claude-switch
node scripts/profile-switcher.js init
```

## Usage

### Slash Commands

| Command | Description |
|---------|-------------|
| `/claude-switch:list` | List all profiles |
| `/claude-switch:to <name>` | Switch to a profile |
| `/claude-switch:create <name>` | Create new profile |
| `/claude-switch:export [name]` | Export current settings |
| `/claude-switch:get <name>` | Get profile details |
| `/claude-switch:rename <old> <new>` | Rename a profile |
| `/claude-switch:delete <name>` | Delete a profile |
| `/claude-switch:backups` | List backups |
| `/claude-switch:restore <backup>` | Restore from backup |

### Create Options

```bash
# Copy everything from current profile
node scripts/profile-switcher.js create dev --from-current --desc="Development"

# Copy only specific items
node scripts/profile-switcher.js create minimal --copy=plugins,commands --desc="Minimal setup"

# Create empty profile
node scripts/profile-switcher.js create blank --clean --desc="Clean slate"
```

Copyable items: `plugins`, `hooks`, `statusline`, `env`, `permissions`, `mcp`, `commands`, `skills`, `agents`, `all`

### Direct CLI Usage

```bash
# Initialize
node scripts/profile-switcher.js init

# List profiles
node scripts/profile-switcher.js list

# Switch to clean profile
node scripts/profile-switcher.js switch clean

# Create new profile from current settings
node scripts/profile-switcher.js create dev --from-current --desc="Development"

# Get profile details
node scripts/profile-switcher.js get dev
```

## Default Profiles

Two default profiles are created on initialization:

| Profile | Description |
|---------|-------------|
| `current` | Snapshot of current settings (auto-generated) |
| `clean` | Clean state without plugins/hooks |

## Profile Structure

```json
{
  "name": "dev",
  "description": "Development settings",
  "createdAt": "2026-02-04T...",
  "settings": {
    "enabledPlugins": { ... },
    "hooks": { ... },
    "statusLine": { ... },
    "env": { ... },
    "permissions": { ... }
  },
  "mcpServers": { ... },
  "components": {
    "commands": { "mode": "all", "include": [] },
    "skills": { "mode": "all", "include": [] },
    "agents": { "mode": "all", "include": [] }
  }
}
```

## Directory Structure

```
~/.claude/
├── profiles/
│   ├── profiles.json      # Metadata
│   ├── .lock              # Operation lock (auto-managed)
│   ├── current/           # Current settings snapshot
│   │   └── profile.json
│   ├── clean/             # Clean profile
│   │   └── profile.json
│   └── .backups/          # Auto backups (max 10)
│       └── backup-<timestamp>/
│
├── settings.json          # Main settings (overwritten on switch)
└── commands/ -> symlink   # Symlink to active profile's components
    skills/  -> symlink
    agents/  -> symlink
```

## Testing

```bash
node tests/test-critical-fixes.js
```

## Notes

- **Restart Claude Code** after profile switch
- Auto backups retain maximum 10 entries (oldest deleted first)
- `current` profile cannot be deleted/renamed (system snapshot)
- Profile names: letters, numbers, hyphens, underscores only
- Stale lock files (>60s) are automatically cleaned

## License

MIT
