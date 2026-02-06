# /switch:to - Switch Profile

Switch to the specified profile.

## Usage

```
/switch:to <profile-name>
```

Examples:
- `/switch:to clean` - Switch to clean profile
- `/switch:to current` - Restore to current settings profile
- `/switch:to dev` - Switch to development profile

## Execution

1. First verify the profile exists:
```bash
SCRIPT=$(ls ~/.claude/plugins/cache/claude-switch/claude-switch/*/scripts/profile-switcher.js 2>/dev/null | tail -1) && node "$SCRIPT" list
```

2. Execute profile switch:
```bash
SCRIPT=$(ls ~/.claude/plugins/cache/claude-switch/claude-switch/*/scripts/profile-switcher.js 2>/dev/null | tail -1) && node "$SCRIPT" switch <profile-name>
```

## Post-Switch Message

Always inform the user after switching:

```
## Profile Switch Complete

Switched to **'<profile-name>'** profile.

**Important**: You must **restart Claude Code** for changes to take effect.

### Changed Settings:
- Enabled plugins: N
- Hooks: N
- Statusline: [Yes/No]

### Backup Location:
`~/.claude/profiles/.backups/backup-<timestamp>/`

### Restore:
If issues occur, use `/switch:restore` command to restore previous state.
```

## Notes

- Current settings are auto-backed up before switch
- Changes won't apply without restart
- Switching to 'current' profile restores original settings
