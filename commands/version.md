# /claude-switch:version - Show Version

Displays the current version of the claude-switch plugin.

## Usage

```
/claude-switch:version
```

## Execution

```bash
SCRIPT=$(ls ~/.claude/plugins/cache/claude-switch/claude-switch/*/scripts/profile-switcher.js 2>/dev/null | tail -1) && node "$SCRIPT" version
```

## Output Format

```
**claude-switch** v<version>
Source: <script path>
```
