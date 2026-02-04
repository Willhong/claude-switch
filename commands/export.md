# /switch:export - Export Current Settings

Saves current settings as a profile.

## Usage

```
/switch:export [profile-name]
```

If profile name is omitted, updates the 'current' profile.

Examples:
- `/switch:export` - Save current settings to 'current' profile
- `/switch:export snapshot-0204` - Save as new profile

## Execution

```bash
# Update current profile
node ~/.claude/scripts/profile-switcher.js export

# Save as new profile
node ~/.claude/scripts/profile-switcher.js export <profile-name>
```

## Post-Export Message

```
## Settings Exported

Current settings saved to **'<profile-name>'** profile.

### Saved Items:
- Plugin settings (enabledPlugins)
- Hook settings (hooks)
- Statusline settings (statusLine)
- Environment variables (env)
- Permission settings (permissions)

### File Location:
`~/.claude/profiles/<profile-name>/profile.json`

**Tip**: This profile can be restored anytime with `/switch:to <profile-name>`.
```

## Use Cases

- Backup current settings
- Save current state before switching to another profile
- Update snapshot after settings changes
- Record settings at a specific point in time
