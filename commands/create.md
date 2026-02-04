# /switch:create - 새 프로파일 생성

새로운 프로파일을 생성합니다.

## 사용법

```
/switch:create <프로파일명> [옵션]
```

옵션:
- `--from-current` - 현재 설정을 복사하여 생성
- `--clean` - 완전히 비어있는 깨끗한 프로파일 생성
- `--desc="설명"` - 프로파일 설명 추가

예시:
- `/switch:create work` - 기본 프로파일 생성
- `/switch:create minimal --clean` - 깨끗한 프로파일 생성
- `/switch:create dev --from-current --desc="개발용 설정"` - 현재 설정 복사

## 실행 방법

사용자가 원하는 옵션을 확인한 후 실행:

```bash
# 기본 생성
node ~/.claude/scripts/profile-switcher.js create <이름>

# 현재 설정 복사
node ~/.claude/scripts/profile-switcher.js create <이름> --from-current

# 깨끗한 프로파일
node ~/.claude/scripts/profile-switcher.js create <이름> --clean

# 설명 추가
node ~/.claude/scripts/profile-switcher.js create <이름> --desc="설명"
```

## 생성 후 안내

```
## ✅ 프로파일 생성 완료

**'<프로파일명>'** 프로파일이 생성되었습니다.

- 위치: `~/.claude/profiles/<프로파일명>/profile.json`
- 타입: [기본/현재설정복사/깨끗한상태]

### 다음 단계:
- `/switch:to <프로파일명>` - 이 프로파일로 전환
- `/switch:list` - 전체 프로파일 목록 확인
- `/switch:get <프로파일명>` - 프로파일 상세 정보 확인
```

## 주의사항

- 프로파일 이름은 영문, 숫자, 하이픈, 언더스코어만 사용 가능
- 이미 존재하는 이름은 사용 불가
- 'current'와 'clean'은 시스템 예약 프로파일
