# /switch:rename - 프로파일 이름 변경

프로파일의 이름을 변경합니다.

## 사용법

```
/switch:rename <현재이름> <새이름>
```

예시:
- `/switch:rename old-profile new-profile`
- `/switch:rename dev development`

## 실행 방법

```bash
node ~/.claude/scripts/profile-switcher.js rename <현재이름> <새이름>
```

## 이름 변경 후 안내

```
## ✅ 프로파일 이름 변경 완료

**'<현재이름>'** → **'<새이름>'**

프로파일 디렉토리가 이동되었습니다:
- 이전: `~/.claude/profiles/<현재이름>/`
- 현재: `~/.claude/profiles/<새이름>/`
```

## 주의사항

- 'current' 프로파일은 이름 변경 불가 (시스템 스냅샷)
- 이미 존재하는 이름으로 변경 불가
- 활성 프로파일도 이름 변경 가능 (자동으로 activeProfile 업데이트)
- 새 이름은 영문, 숫자, 하이픈, 언더스코어만 사용 가능
