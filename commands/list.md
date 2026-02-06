# /switch:list - List Profiles

Lists all profiles and shows the currently active profile.

## Execution

```bash
SCRIPT=$(ls ~/.claude/plugins/cache/claude-switch/claude-switch/*/scripts/profile-switcher.js 2>/dev/null | tail -1) && node "$SCRIPT" list
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
