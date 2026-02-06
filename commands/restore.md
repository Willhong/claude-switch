# /switch:restore - Restore from Backup

Restores settings from a backup.

## Usage

```
/switch:restore <backup-name>
```

Examples:
- `/switch:restore backup-2026-02-04T14-30-00-000Z`

## Execution

1. First check backup list:
```bash
SCRIPT=$(ls ~/.claude/plugins/cache/claude-switch/claude-switch/*/scripts/profile-switcher.js 2>/dev/null | tail -1) && node "$SCRIPT" backups
```

2. Execute restore:
```bash
SCRIPT=$(ls ~/.claude/plugins/cache/claude-switch/claude-switch/*/scripts/profile-switcher.js 2>/dev/null | tail -1) && node "$SCRIPT" restore <backup-name>
```

## Pre-Restore Confirmation

Request user confirmation before restoring:

```
## Confirm Backup Restore

Restore from **'<backup-name>'** backup?

- Previous profile: <profile-name>
- Backup time: <time>

Current settings will be overwritten.

Type "yes" or "restore" to proceed.
```

## Post-Restore Message

```
## Restore Complete

Restored from **'<backup-name>'** backup.

- Active profile: <profile-name>

**Important**: You must **restart Claude Code** for changes to take effect.
```

## Notes

- Current settings.json will be overwritten on restore
- Current state is NOT saved as a new backup before restore
- Changes won't apply without restart
