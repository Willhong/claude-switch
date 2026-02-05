# claude-switch

Claude Code profile switching system - easily manage and switch between multiple configurations.

## Features

- **Profile Management**: Create, switch, and delete multiple settings profiles
- **Auto Backup**: Safe settings changes with automatic backup on switch
- **Full Settings Support**: Includes plugins, hooks, env vars, permissions, statusline, etc.
- **Quick Switching**: Fast switching between clean and development environments

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

Two default profiles are created on installation:

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
│   ├── current/           # Current settings snapshot
│   │   └── profile.json
│   ├── clean/             # Clean profile
│   │   └── profile.json
│   └── .backups/          # Auto backups
│       └── backup-<timestamp>/
│
└── settings.json          # Main settings (overwritten on switch)
```

## Notes

- **Restart Claude Code** after profile switch
- Auto backups retain maximum 10 entries (oldest deleted first)
- `current` profile cannot be deleted/renamed (system snapshot)

## License

MIT
