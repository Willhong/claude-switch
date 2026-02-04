# claude-switch Plugin

Profile switching system plugin for Claude Code.

## Commands

This plugin provides the following slash commands:

- `/switch:list` - List all profiles
- `/switch:to <name>` - Switch to a profile
- `/switch:create <name> [--from-current] [--clean] [--desc="description"]` - Create new profile
- `/switch:export [name]` - Export current settings
- `/switch:get <name>` - Get profile details
- `/switch:rename <old> <new>` - Rename a profile
- `/switch:delete <name>` - Delete a profile
- `/switch:backups` - List backups
- `/switch:restore <backup>` - Restore from backup

## Core Script

Profile switching logic is implemented in `scripts/profile-switcher.js`.

```bash
node scripts/profile-switcher.js <command> [args]
```

Supported commands:
- `init` - Initialize system
- `list` - List profiles
- `switch <name>` - Switch profile
- `create <name> [opts]` - Create profile
- `delete <name>` - Delete profile
- `rename <old> <new>` - Rename profile
- `export [name]` - Export settings
- `get <name>` - Get details
- `backup` - Create backup
- `backups` - List backups
- `restore <backup>` - Restore

## Important Paths

- Profile storage: `~/.claude/profiles/`
- Settings file: `~/.claude/settings.json`
- Backups: `~/.claude/profiles/.backups/`

## Switch Flow

1. Auto-backup current settings
2. Load target profile
3. Overwrite `settings.json`
4. Update `active-manifest.json`
5. Prompt user to restart

## Notes

- Restart Claude Code after switching
- `current` profile is system-reserved (cannot delete/rename)
- Maximum 10 backups retained
