# /switch:delete - Delete Profile

Deletes a profile.

## Usage

```
/switch:delete <profile-name>
```

Examples:
- `/switch:delete old-profile`
- `/switch:delete test`

## Execution

1. First check profile list:
```bash
SCRIPT=$(ls ~/.claude/plugins/cache/claude-switch/claude-switch/*/scripts/profile-switcher.js 2>/dev/null | tail -1) && node "$SCRIPT" list
```

2. Execute deletion:
```bash
SCRIPT=$(ls ~/.claude/plugins/cache/claude-switch/claude-switch/*/scripts/profile-switcher.js 2>/dev/null | tail -1) && node "$SCRIPT" delete <profile-name>
```

## Pre-Delete Confirmation

Request user confirmation before deletion:

```
## Confirm Profile Deletion

Delete **'<profile-name>'** profile?

This action cannot be undone.

Type "yes" or "delete" to proceed.
```

## Post-Delete Message

```
## Profile Deleted

**'<profile-name>'** profile has been deleted.

Deleted directory: `~/.claude/profiles/<profile-name>/`
```

## Notes

- Cannot delete 'current' profile (system snapshot)
- Cannot delete currently active profile (switch to another profile first)
- Deleted profiles cannot be recovered (but backups in `.backups/` are retained)
