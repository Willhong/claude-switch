# /switch:install-all - Install Plugin Across Profiles

Installs and enables a plugin across all or specific profiles. If the plugin is not yet installed, it will be automatically installed from the marketplace.

## Usage

```
/switch:install-all <plugin-key> --all
/switch:install-all <plugin-key> --profiles=profile1,profile2
```

- Plugin key format: `plugin-name@marketplace-name`
- Must specify either `--all` (all profiles) or `--profiles=` (specific profiles)

Examples:
- `/switch:install-all my-plugin@my-marketplace --all`
- `/switch:install-all some-tool@tools-market --profiles=dev,work`

## Execution

Run the command:
```bash
SCRIPT=$(ls ~/.claude/plugins/cache/claude-switch/claude-switch/*/scripts/profile-switcher.js 2>/dev/null | tail -1) && node "$SCRIPT" install-all <plugin-key> <flags>
```

## Output Format

Display the result as a table:

```
## Plugin Install Results

Plugin: `<plugin-key>`
Auto-installed: Yes/No (version x.y.z)

| Profile | Status | Note |
|---------|--------|------|
| dev     | Enabled | Newly enabled |
| work    | Skipped | Already enabled |

Summary: Enabled in X/Y profiles
```

## Notes

- If the plugin is not yet installed (not in `installed_plugins.json`), it is automatically installed from the marketplace cache
- The marketplace must be registered first (via `/plugin marketplace add`)
- If the active profile is modified, remind user to restart Claude Code
- Plugin key format is always `plugin-name@marketplace-name`
