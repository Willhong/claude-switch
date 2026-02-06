# /claude-switch:update - Update Plugin Cache

Syncs the latest source code from the project repository to all cached plugin versions. This ensures slash commands, scripts, and documentation are up to date.

## Usage

```
/claude-switch:update
```

## Execution

```bash
node C:/Users/Hong/workspace/claude-switch/scripts/profile-switcher.js update
```

If the above path doesn't work, find the project source:
```bash
REPO=$(git -C "$(dirname "$(ls ~/.claude/plugins/cache/claude-switch/claude-switch/*/scripts/profile-switcher.js 2>/dev/null | tail -1)")" rev-parse --show-toplevel 2>/dev/null) && node "$REPO/scripts/profile-switcher.js" update
```

**Important**: This command must run the script from the **project source directory**, not from the plugin cache. Running from cache will fail since there is no newer source to sync from.

## Post-Update Message

```
## Plugin Cache Updated

Updated **N** cached version(s) with latest source (v<version>).

### What was synced:
- scripts/ (profile-switcher.js)
- commands/ (all slash command definitions)
- package.json, CLAUDE.md, README.md

### Note:
**Restart Claude Code** to load the updated commands.
```

## Notes

- Only works when run from the project source directory
- Updates all cached versions (e.g., 1.0.0, 1.2.0, 1.3.0)
- Does not modify profile data or settings
- Safe to run anytime - idempotent operation
