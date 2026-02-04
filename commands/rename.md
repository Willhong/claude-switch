# /switch:rename - Rename Profile

Renames a profile.

## Usage

```
/switch:rename <current-name> <new-name>
```

Examples:
- `/switch:rename old-profile new-profile`
- `/switch:rename dev development`

## Execution

```bash
node ~/.claude/scripts/profile-switcher.js rename <current-name> <new-name>
```

## Post-Rename Message

```
## Profile Renamed

**'<current-name>'** -> **'<new-name>'**

Profile directory has been moved:
- Previous: `~/.claude/profiles/<current-name>/`
- Current: `~/.claude/profiles/<new-name>/`
```

## Notes

- Cannot rename 'current' profile (system snapshot)
- Cannot rename to an existing name
- Active profile can be renamed (activeProfile automatically updated)
- New name can only contain letters, numbers, hyphens, and underscores
