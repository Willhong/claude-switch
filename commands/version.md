# /claude-switch:version - Show Version

Displays the current version of the claude-switch plugin and its status across all profiles.

## Usage

```
/claude-switch:version
```

## Execution

```bash
SCRIPT=$(ls ~/.claude/plugins/cache/claude-switch/claude-switch/*/scripts/profile-switcher.js 2>/dev/null | tail -1) && node "$SCRIPT" version
```

## Output Format

Show results to user in this format:

```
## claude-switch v<version>

**Source**: `<source path>`

### Registry
| Location | Version |
|----------|---------|
| Plugin cache | <version> |
| installed_plugins.json | <version> |
| marketplace | <version> |

### Profiles
| Profile | Active | Plugin Enabled |
|---------|--------|----------------|
| current | Yes | Yes |
| clean | - | Yes |
| dev | - | No |
```

Mark active profile with "Yes". Show plugin enabled status for each profile.
If any registry versions are mismatched, warn the user to run `/claude-switch:update`.
