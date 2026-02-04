# /switch:export - 현재 설정 내보내기

현재 설정을 프로파일로 저장합니다.

## 사용법

```
/switch:export [프로파일명]
```

프로파일명을 생략하면 'current' 프로파일이 업데이트됩니다.

예시:
- `/switch:export` - 현재 설정을 'current' 프로파일로 저장
- `/switch:export snapshot-0204` - 새 프로파일로 저장

## 실행 방법

```bash
# current 프로파일 업데이트
node ~/.claude/scripts/profile-switcher.js export

# 새 프로파일로 저장
node ~/.claude/scripts/profile-switcher.js export <프로파일명>
```

## 내보내기 후 안내

```
## ✅ 설정 내보내기 완료

현재 설정이 **'<프로파일명>'** 프로파일로 저장되었습니다.

### 저장된 항목:
- 플러그인 설정 (enabledPlugins)
- 훅 설정 (hooks)
- 상태바 설정 (statusLine)
- 환경변수 (env)
- 권한 설정 (permissions)

### 파일 위치:
`~/.claude/profiles/<프로파일명>/profile.json`

💡 **팁**: 이 프로파일은 `/switch:to <프로파일명>`으로 언제든 복원할 수 있습니다.
```

## 용도

- 현재 설정을 백업하고 싶을 때
- 다른 프로파일로 전환하기 전 현재 상태 저장
- 설정 변경 후 스냅샷 업데이트
- 특정 시점의 설정을 기록하고 싶을 때
