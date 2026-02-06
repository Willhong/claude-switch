# /claude-switch:backups - List Backups

Lists automatically generated backups with detailed configuration snapshots.

## Usage

```
/claude-switch:backups
```

## Execution

```bash
SCRIPT=$(ls ~/.claude/plugins/cache/claude-switch/claude-switch/*/scripts/profile-switcher.js 2>/dev/null | tail -1) && node "$SCRIPT" backups
```

## Output Format

The command returns a JSON array. For each backup, present a detailed summary:

```
## Backup List

For each backup, display:

### backup-2026-02-06T11-13-37-226Z
- **Profile**: current
- **Time**: 2026-02-06 11:13:37
- **Enabled Plugins** (N): plugin-a@source, plugin-b@source
- **Disabled Plugins** (N): plugin-c@source
- **MCP Servers** (N): server-a, server-b
- **Hooks**: SessionStart
- **Status Line**: Yes/No
- **Permission Mode**: default
- **Size**: 2.1 KB

---

(repeat for each backup)

Total: N backups (maximum 10 retained)

### Restore:
Use `/claude-switch:restore <backup-name>` to restore to a specific backup point.
```

## Notes

- Backups are automatically created when switching profiles
- Maximum 10 backups retained; oldest deleted first
- Backup location: `~/.claude/profiles/.backups/`
- Each backup stores: settings.json, active-manifest.json, mcpServers.json, meta.json
