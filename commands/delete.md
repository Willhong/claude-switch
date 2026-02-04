# /switch:delete - 프로파일 삭제

프로파일을 삭제합니다.

## 사용법

```
/switch:delete <프로파일명>
```

예시:
- `/switch:delete old-profile`
- `/switch:delete test`

## 실행 방법

1. 먼저 프로파일 목록 확인:
```bash
node ~/.claude/scripts/profile-switcher.js list
```

2. 삭제 실행:
```bash
node ~/.claude/scripts/profile-switcher.js delete <프로파일명>
```

## 삭제 전 확인

사용자에게 삭제 확인을 요청하세요:

```
## ⚠️ 프로파일 삭제 확인

**'<프로파일명>'** 프로파일을 삭제하시겠습니까?

이 작업은 되돌릴 수 없습니다.

삭제를 진행하려면 "예" 또는 "삭제"를 입력하세요.
```

## 삭제 후 안내

```
## ✅ 프로파일 삭제 완료

**'<프로파일명>'** 프로파일이 삭제되었습니다.

삭제된 디렉토리: `~/.claude/profiles/<프로파일명>/`
```

## 주의사항

- 'current' 프로파일은 삭제 불가 (시스템 스냅샷)
- 현재 활성 프로파일은 삭제 불가 (먼저 다른 프로파일로 전환 필요)
- 삭제된 프로파일은 복구 불가 (단, `.backups/`의 백업은 유지됨)
