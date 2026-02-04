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
node ~/.claude/scripts/profile-switcher.js list
```

2. Execute deletion:
```bash
node ~/.claude/scripts/profile-switcher.js delete <profile-name>
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
