# AGENTS.md

Telegram 메시지로 Google 캘린더 일정을 등록·조회하는 개인 자동화. Google Apps Script(`gas/`) + Cloudflare Worker(`worker/`) 구성.

## 주의

- Bot Token, Webhook key, chat id, 캘린더 ID는 **Apps Script 스크립트 속성**과 **Worker Secrets**에만 둔다. 코드나 문서에 실제 값을 적지 않는다.
- Worker의 `TELEGRAM_SECRET_TOKEN`과 GAS의 `TELEGRAM_WEBHOOK_KEY`는 역할이 다르다. 혼동 사례가 `MDs/PROJECT_LESSONS.md`에 기록되어 있다.
- 미래 일정만 등록한다는 제약이 있다. 시간 처리는 Asia/Seoul 기준.
- 이 저장소는 PUBLIC이다. `MDs/` 문서에 비공개 정보를 적지 않는다.

## 작업 후 기록 규칙

- 작업 내역 → `MDs/WORK_LOG.md` (append-only, 과거 항목 수정 금지)
- 구조/스택/정책을 바꾼 결정 → `MDs/DECISIONS.md` (append-only)
- 버그를 만들었거나 고쳤으면 → `MDs/BUGS.md`
- 할 일 변화 → `MDs/TODO.md`
- 반복된 시행착오는 `MDs/PROJECT_LESSONS.md`에 재발 방지 형태로 남긴다.
- 문서에 이미지를 넣을 때는 `MDs/attachments/`에 두고 상대경로로 참조한다.
  (`MDs/`는 Obsidian Vault에 연결되어 있어 폴더 바깥 이미지는 표시되지 않는다.)

## 문서 위치

프로젝트 지식 문서는 모두 `MDs/`에 있다. 작업 시작 전 `MDs/PROJECT_CONTEXT.md`, `MDs/TODO.md`, `MDs/BUGS.md`, `MDs/DECISIONS.md`를 읽는다.
`MDs/`는 Obsidian Vault(`HermesVault/03_Projects/{프로젝트명}`)와 Junction으로 연결되어 있다. 원본은 이 저장소이며 폴더 이름을 바꾸면 연결이 끊긴다.
