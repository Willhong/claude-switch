# /switch:spread - Copy Item From Active Profile to Others

Copies a single item (command, skill, agent, hook, MCP server, env variable, statusline, or permissions) from the active profile to other profiles.

## Usage

**Components (name required):**
```
/switch:spread commands <name> --all|--profiles=a,b [--force]
/switch:spread skills <name> --all|--profiles=a,b [--force]
/switch:spread agents <name> --all|--profiles=a,b [--force]
```

**Keyed settings (name required):**
```
/switch:spread hooks <eventName> --all|--profiles=a,b [--force]
/switch:spread mcp <serverName> --all|--profiles=a,b [--force]
/switch:spread env <varName> --all|--profiles=a,b [--force]
```

**Value settings (no name):**
```
/switch:spread statusline --all|--profiles=a,b [--force]
/switch:spread permissions --all|--profiles=a,b [--force]
```

### Options
- `--all` — Target all other profiles (active profile is automatically excluded)
- `--profiles=a,b` — Target specific profiles (cannot include active profile)
- `--force` — Overwrite if the item already exists in target

### Examples
- `/switch:spread commands gsd --all` — Copy `gsd` command to all profiles
- `/switch:spread mcp MCP_DOCKER --profiles=dev,work --force` — Copy MCP server config to dev and work, overwriting
- `/switch:spread statusline --all` — Copy statusline config to all profiles
- `/switch:spread hooks SessionStart --profiles=test1` — Copy a hook to test1

## Execution

1. First confirm the action with the user:

```
## Spread Confirmation

Spreading **<type>** `<name>` from active profile **<active>** to:
- profile1
- profile2
- ...

Options: --force: No/Yes

Proceed? Type "yes" or "confirm".
```

2. Execute:
```bash
SCRIPT=$(ls ~/.claude/plugins/cache/claude-switch/claude-switch/*/scripts/profile-switcher.js 2>/dev/null | tail -1) && node "$SCRIPT" spread <type> [name] <flags>
```

## Output Format

Display the result as a table:

```
## Spread Results

Type: `<type>` | Item: `<name>` | Source: `<active-profile>`

| Profile | Status | Note |
|---------|--------|------|
| dev     | Copied | Copied |
| work    | Skipped | Already exists (use --force to overwrite) |
| test    | Overwritten | Overwritten |

Summary: Copied X, Overwritten Y, Skipped Z (Total: N profiles)
```

## Notes

- The **source** is always the currently active profile
- The active profile is automatically excluded from targets
- By default, existing items are **skipped** — use `--force` to overwrite
- Component types (commands, skills, agents) copy files/directories
- Keyed types (hooks, mcp, env) copy JSON settings into the target profile
- Value types (statusline, permissions) copy the entire setting value
- Changes to non-active profiles take effect when you switch to that profile
