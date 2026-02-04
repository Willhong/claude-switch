# claude-switch

Claude Code 프로파일 스위칭 시스템 - 여러 설정을 쉽게 관리하고 전환하세요.

## 기능

- **프로파일 관리**: 여러 설정 프로파일 생성, 전환, 삭제
- **자동 백업**: 전환 시 자동 백업으로 안전한 설정 변경
- **전체 설정 지원**: 플러그인, 훅, 환경변수, 권한, 상태바 등 모든 설정 포함
- **빠른 전환**: 깨끗한 환경과 개발 환경 간 빠른 전환

## 설치

### 플러그인으로 설치

```bash
claude plugins:add claude-switch
```

### 수동 설치

```bash
git clone https://github.com/hong/claude-switch.git ~/.claude/plugins/claude-switch
cd ~/.claude/plugins/claude-switch
node scripts/profile-switcher.js init
```

## 사용법

### 슬래시 커맨드

| 커맨드 | 설명 |
|--------|------|
| `/switch:list` | 프로파일 목록 조회 |
| `/switch:to <name>` | 프로파일 전환 |
| `/switch:create <name>` | 새 프로파일 생성 |
| `/switch:export [name]` | 현재 설정 내보내기 |
| `/switch:get <name>` | 프로파일 상세 정보 |
| `/switch:rename <old> <new>` | 프로파일 이름 변경 |
| `/switch:delete <name>` | 프로파일 삭제 |
| `/switch:backups` | 백업 목록 조회 |
| `/switch:restore <backup>` | 백업에서 복원 |

### CLI 직접 사용

```bash
# 초기화
node scripts/profile-switcher.js init

# 프로파일 목록
node scripts/profile-switcher.js list

# 깨끗한 프로파일로 전환
node scripts/profile-switcher.js switch clean

# 현재 설정 복사하여 새 프로파일 생성
node scripts/profile-switcher.js create dev --from-current --desc="개발용"

# 프로파일 상세 정보
node scripts/profile-switcher.js get dev
```

## 기본 프로파일

설치 시 두 개의 기본 프로파일이 생성됩니다:

| 프로파일 | 설명 |
|----------|------|
| `current` | 현재 설정의 스냅샷 (자동 생성) |
| `clean` | 플러그인/훅 없는 깨끗한 상태 |

## 프로파일 구조

```json
{
  "name": "dev",
  "description": "개발용 설정",
  "createdAt": "2026-02-04T...",
  "settings": {
    "enabledPlugins": { ... },
    "hooks": { ... },
    "statusLine": { ... },
    "env": { ... },
    "permissions": { ... }
  },
  "components": {
    "commands": { "mode": "all", "include": [] },
    "skills": { "mode": "all", "include": [] },
    "agents": { "mode": "all", "include": [] }
  }
}
```

## 디렉토리 구조

```
~/.claude/
├── profiles/
│   ├── profiles.json      # 메타데이터
│   ├── current/           # 현재 설정 스냅샷
│   │   └── profile.json
│   ├── clean/             # 깨끗한 프로파일
│   │   └── profile.json
│   └── .backups/          # 자동 백업
│       └── backup-<timestamp>/
│
└── settings.json          # 메인 설정 (전환 시 덮어씌움)
```

## 주의사항

- 프로파일 전환 후 **Claude Code 재시작** 필요
- 자동 백업은 최대 10개 유지 (오래된 것부터 자동 삭제)
- `current` 프로파일은 삭제/이름변경 불가 (시스템 스냅샷)

## 라이선스

MIT
