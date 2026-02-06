# /switch:uninstall-all - Uninstall Plugin From Profiles

Disables and removes a plugin from all or specific profiles.

## Usage

```
/switch:uninstall-all <plugin-key> --all
/switch:uninstall-all <plugin-key> --profiles=profile1,profile2
```

- Plugin key format: `plugin-name@marketplace-name`
- Must specify either `--all` (all profiles) or `--profiles=` (specific profiles)

Examples:
- `/switch:uninstall-all my-plugin@my-marketplace --all`
- `/switch:uninstall-all unused-tool@tools-market --profiles=dev,work`

## Execution

1. First show what will be affected:
```bash
SCRIPT=$(ls ~/.claude/plugins/cache/claude-switch/claude-switch/*/scripts/profile-switcher.js 2>/dev/null | tail -1) && node "$SCRIPT" list
```

2. Request user confirmation:

```
## Confirm Plugin Removal

Remove **`<plugin-key>`** from the following profiles?

- profile1
- profile2
- ...

Type "yes" or "confirm" to proceed.
```

3. Execute:
```bash
SCRIPT=$(ls ~/.claude/plugins/cache/claude-switch/claude-switch/*/scripts/profile-switcher.js 2>/dev/null | tail -1) && node "$SCRIPT" uninstall-all <plugin-key> <flags>
```

## Output Format

Display the result as a table:

```
## Plugin Uninstall Results

Plugin: `<plugin-key>`

| Profile | Status | Note |
|---------|--------|------|
| dev     | Disabled | Removed from profile |
| work    | Skipped | Not enabled |

Summary: Disabled in X/Y profiles
```

## Notes

- Cannot uninstall `claude-switch@claude-switch` (self-preservation - the plugin protects itself)
- This only removes the plugin from profile enabledPlugins, it does NOT delete the cached plugin files
- If the active profile is modified, remind user to restart Claude Code
- Plugin key format is always `plugin-name@marketplace-name`
- Always request user confirmation before executing
