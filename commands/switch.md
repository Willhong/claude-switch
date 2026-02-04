# /switch:to - 프로파일 전환

지정한 프로파일로 전환합니다.

## 사용법

```
/switch:to <프로파일명>
```

예시:
- `/switch:to clean` - 깨끗한 프로파일로 전환
- `/switch:to current` - 현재 설정 프로파일로 복원
- `/switch:to dev` - 개발용 프로파일로 전환

## 실행 방법

1. 먼저 프로파일이 존재하는지 확인:
```bash
node ~/.claude/scripts/profile-switcher.js list
```

2. 프로파일 전환 실행:
```bash
node ~/.claude/scripts/profile-switcher.js switch <프로파일명>
```

## 전환 후 안내

프로파일 전환 후 반드시 사용자에게 다음을 안내하세요:

```
## ✅ 프로파일 전환 완료

**'<프로파일명>'** 프로파일로 전환되었습니다.

⚠️ **중요**: 변경사항을 적용하려면 **Claude Code를 재시작**해야 합니다.

### 변경된 설정:
- 활성화된 플러그인: N개
- 훅: N개
- 상태바: [있음/없음]

### 백업 위치:
`~/.claude/profiles/.backups/backup-<timestamp>/`

### 복원 방법:
문제가 발생하면 `/switch:restore` 명령어로 이전 상태로 복원할 수 있습니다.
```

## 주의사항

- 전환 전 현재 설정이 자동 백업됩니다
- 재시작하지 않으면 이전 설정이 유지됩니다
- 'current' 프로파일로 전환하면 원래 설정으로 복원됩니다
