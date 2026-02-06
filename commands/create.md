# /switch:create - Create New Profile

Creates a new profile.

## Usage

```
/switch:create <profile-name> [options]
```

Options:
- `--copy=item1,item2,...` - Copy specific items only
- `--from-current` - Copy all current settings (same as `--copy=all`)
- `--clean` - Create completely empty clean profile
- `--desc="description"` - Add profile description

### Copyable Items

**Settings:**
- `plugins` - Enabled plugins
- `hooks` - Hook settings
- `statusline` - Statusline settings
- `env` - Environment variables
- `permissions` - Permission settings
- `mcp` - MCP server settings

**Components:**
- `commands` - Commands directory
- `skills` - Skills directory
- `agents` - Agents directory

**Special:**
- `all` - All items

## Examples

```bash
# Empty profile (default settings only)
/switch:create work

# Copy all current settings
/switch:create backup --from-current

# Copy only plugins and commands
/switch:create minimal --copy=plugins,commands

# Copy all except MCP
/switch:create nomcp --copy=plugins,hooks,statusline,env,permissions,commands,skills,agents

# Copy only statusline and hooks
/switch:create custom --copy=statusline,hooks --desc="Statusline+hooks only"

# Completely clean state
/switch:create clean-dev --clean --desc="Development testing"
```

## Execution

After confirming user's desired options:

```bash
SCRIPT=$(ls ~/.claude/plugins/cache/claude-switch/claude-switch/*/scripts/profile-switcher.js 2>/dev/null | tail -1)

# Basic creation
node "$SCRIPT" create <name>

# Copy specific items
node "$SCRIPT" create <name> --copy=plugins,hooks,statusline

# Copy all current settings
node "$SCRIPT" create <name> --from-current

# Clean profile
node "$SCRIPT" create <name> --clean

# Add description
node "$SCRIPT" create <name> --desc="description"
```

## Post-Creation Message

```
## Profile Created

**'<profile-name>'** profile has been created.

- Location: `~/.claude/profiles/<profile-name>/`
- Copied items: [list of copied items or "none"]

### Next Steps:
- `/switch:to <profile-name>` - Switch to this profile
- `/switch:list` - View all profiles
- `/switch:get <profile-name>` - View profile details
```

## Notes

- Profile names can only contain letters, numbers, hyphens, and underscores
- Cannot use existing names
- 'current' and 'clean' are system-reserved profiles
- When using both `--copy=` and `--from-current`, `--copy=` takes precedence
