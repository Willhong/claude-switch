# /switch:backups - List Backups

Lists automatically generated backups.

## Usage

```
/switch:backups
```

## Execution

```bash
node ~/.claude/scripts/profile-switcher.js backups
```

## Output Format

```
## Backup List

| Backup Name | Previous Profile | Backup Time |
|-------------|------------------|-------------|
| backup-2026-02-04T14-30-00 | current | 2026-02-04 14:30:00 |
| backup-2026-02-04T12-15-00 | dev | 2026-02-04 12:15:00 |
| ... | ... | ... |

Total: N backups (maximum 10 retained)

### Restore:
Use `/switch:restore <backup-name>` to restore to a specific backup point.
```

## Notes

- Backups are automatically created when switching profiles
- Maximum 10 backups retained; oldest deleted first
- Backup location: `~/.claude/profiles/.backups/`
