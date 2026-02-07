# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.7.2] - 2025-02-06

### Fixed
- CLAUDE.md lost when switching profiles and returning to previous profile

## [1.7.1] - 2025-02-06

### Fixed
- Restore CLAUDE.md and mcpServers from backup on profile restore

## [1.7.0] - 2025-02-06

### Added
- CLAUDE.md per-profile management: each profile can have its own CLAUDE.md
- CLAUDE.md is synced back to profile before switching away
- CLAUDE.md is copied from target profile during switch

## [1.6.5] - 2025-02-05

### Changed
- Auto-sync settings.json to active profile before switching to another profile
- Ensures changes made during a session are preserved in the profile

## [1.6.4] - 2025-02-05

### Fixed
- Windows EBUSY error when switching junctions with open file handles
- Implemented atomic rename-swap pattern for junction replacement on Windows

## [1.6.3] - 2025-02-05

### Added
- `spread` command: copy items from active profile to other profiles
- Supports 9 spread types: commands, skills, agents, hooks, mcp, env, statusline, permissions, claudemd
- `install-all` command: enable a plugin across multiple profiles
- `uninstall-all` command: disable a plugin across multiple profiles (with self-preservation)
- `--all` and `--profiles=` targeting options for multi-profile operations

## [1.6.2] - 2025-02-04

### Fixed
- `getGitRepoUrl()` to handle git source type in marketplace config
- Marketplace UI showing scope instead of version
- Version bump across all registry files

## [1.6.1] - 2025-02-04

### Changed
- Enhanced version command to show status across all profiles

## [1.6.0] - 2025-02-04

### Fixed
- Update edge case: clean old cache directories and update git SHA correctly

## [1.5.3] - 2025-02-04

### Changed
- Version bump

## [1.5.2] - 2025-02-03

### Changed
- Update command renames cache directory and updates plugin registry
- Update command pulls from git when running from plugin cache

## [1.5.1] - 2025-02-03

### Added
- `/claude-switch:update` command for syncing source to plugin cache

## [1.5.0] - 2025-02-03

### Added
- Auto-update plugin cache on profile switch (syncs from source when running from source directory)
