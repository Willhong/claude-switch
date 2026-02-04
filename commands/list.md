# /switch:list - 프로파일 목록 조회

프로파일 목록을 조회하고 현재 활성 프로파일을 표시합니다.

## 실행 방법

```bash
node ~/.claude/profiles/../scripts/profile-switcher.js list 2>/dev/null || node "$(dirname "$(realpath "$0")")/../scripts/profile-switcher.js" list
```

또는 플러그인 설치 후:
```bash
node ~/.claude/plugins/cache/*/claude-switch/*/scripts/profile-switcher.js list
```

## 출력 형식

결과를 다음 형식으로 사용자에게 보여주세요:

```
## 📋 프로파일 목록

| 프로파일 | 설명 | 플러그인 | 훅 | 상태바 | 상태 |
|----------|------|----------|-----|--------|------|
| current | Snapshot of current settings | 3 | ✓ | ✓ | ✅ 활성 |
| clean | Clean slate... | 0 | - | - | - |
| dev | 개발용 설정 | 5 | ✓ | ✓ | - |

총 N개의 프로파일
```

활성 프로파일에는 ✅ 표시를 추가합니다.
