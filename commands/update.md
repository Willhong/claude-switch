# /claude-switch:update - Update Plugin Cache

Syncs the latest source code to all cached plugin versions. Works from any context:
- **From source directory**: copies files directly to cache
- **From plugin cache**: pulls latest from GitHub and syncs to cache

## Usage

```
/claude-switch:update
```

## Execution

```bash
SCRIPT=$(ls ~/.claude/plugins/cache/claude-switch/claude-switch/*/scripts/profile-switcher.js 2>/dev/null | tail -1) && node "$SCRIPT" update
```

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

- When running from cache, pulls latest from the GitHub repo registered in marketplace config
- Updates all cached versions (e.g., 1.0.0, 1.2.0, 1.3.0)
- Does not modify profile data or settings
- Requires `git` to be available when pulling from remote
- Safe to run anytime - idempotent operation
