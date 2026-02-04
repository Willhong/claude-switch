# claude-switch Plugin

프로파일 스위칭 시스템 플러그인입니다.

## 명령어

이 플러그인은 다음 슬래시 커맨드를 제공합니다:

- `/switch:list` - 프로파일 목록 조회
- `/switch:to <name>` - 프로파일 전환
- `/switch:create <name> [--from-current] [--clean] [--desc="설명"]` - 새 프로파일 생성
- `/switch:export [name]` - 현재 설정 내보내기
- `/switch:get <name>` - 프로파일 상세 정보
- `/switch:rename <old> <new>` - 프로파일 이름 변경
- `/switch:delete <name>` - 프로파일 삭제
- `/switch:backups` - 백업 목록 조회
- `/switch:restore <backup>` - 백업에서 복원

## 핵심 스크립트

프로파일 스위칭 로직은 `scripts/profile-switcher.js`에 구현되어 있습니다.

```bash
node scripts/profile-switcher.js <command> [args]
```

지원 명령어:
- `init` - 시스템 초기화
- `list` - 프로파일 목록
- `switch <name>` - 전환
- `create <name> [opts]` - 생성
- `delete <name>` - 삭제
- `rename <old> <new>` - 이름 변경
- `export [name]` - 내보내기
- `get <name>` - 상세 정보
- `backup` - 백업 생성
- `backups` - 백업 목록
- `restore <backup>` - 복원

## 중요 경로

- 프로파일 저장소: `~/.claude/profiles/`
- 설정 파일: `~/.claude/settings.json`
- 백업: `~/.claude/profiles/.backups/`

## 전환 흐름

1. 현재 설정 자동 백업
2. 대상 프로파일 로드
3. `settings.json` 덮어쓰기
4. `active-manifest.json` 업데이트
5. 사용자에게 재시작 안내

## 주의사항

- 전환 후 Claude Code 재시작 필요
- `current` 프로파일은 시스템 예약 (삭제/이름변경 불가)
- 백업은 최대 10개 유지
