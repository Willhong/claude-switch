# /switch:get - Profile Details

View detailed information about a profile.

## Usage

```
/switch:get <profile-name>
```

Examples:
- `/switch:get current`
- `/switch:get dev`
- `/switch:get clean`

## Execution

```bash
node ~/.claude/scripts/profile-switcher.js get <profile-name>
```

## Output Format

```
## Profile Details: <profile-name>

**Status**: Active / Inactive
**Description**: <description>
**Created**: <date>
**Modified**: <date>

### Enabled Plugins
- frontend-design@claude-code-plugins
- claude-dashboard@claude-dashboard
- ...

### Configured Hooks
- SessionStart

### Environment Variables
- ENABLE_TOOL_SEARCH: true

### Permissions
- Default mode: default
- Allow: Bash(uv pip install:*)

### Statusline
[Yes/No]
```

## Use Cases

- Check profile contents before switching
- Compare settings between profiles
- Verify current active profile settings
