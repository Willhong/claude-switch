# /switch:list - List Profiles

Lists all profiles and shows the currently active profile.

## Execution

```bash
node ~/.claude/profiles/../scripts/profile-switcher.js list 2>/dev/null || node "$(dirname "$(realpath "$0")")/../scripts/profile-switcher.js" list
```

Or after plugin installation:
```bash
node ~/.claude/plugins/cache/*/claude-switch/*/scripts/profile-switcher.js list
```

## Output Format

Show results to user in this format:

```
## Profile List

| Profile | Description | Plugins | Hooks | Statusline | Status |
|---------|-------------|---------|-------|------------|--------|
| current | Snapshot of current settings | 3 | Yes | Yes | Active |
| clean | Clean slate... | 0 | - | - | - |
| dev | Development settings | 5 | Yes | Yes | - |

Total: N profiles
```

Mark active profile with "Active" status.
