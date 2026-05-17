# ScheduleManager — Telegram + Google Calendar

텔레그램 메시지로 Google 캘린더에 일정을 등록하고, 명령어로 조회하며, 매일 아침 오늘 일정 요약을 받는 개인용 봇(Google Apps Script)입니다.

## 개요

- **등록:** `5.25 오후 3시 제목 = 30분 전 알림` 형식(자세한 규칙은 [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md)).
- **조회:** `오늘일정`, `내일일정`, `6.20 일정`, `차주 금 일정`, `명령어` 등.
- **일일 요약:** `dailyMorningSummary`를 매일 9시(서울)에 실행하는 트리거로 설치.

## 시작하기

### 0) clasp로 원격 프로젝트 만들기(선택)

1. **Google Apps Script API** 사용 설정: [script.google.com/home/usersettings](https://script.google.com/home/usersettings) 에서 켠 뒤 1~2분 정도 기다립니다.
2. 저장소 루트에서:
   ```bash
   clasp create --title "260517 ScheduleManager Telegram Calendar" --type standalone --rootDir gas
   ```
   `clasp create`가 [gas/appsscript.json](gas/appsscript.json)을 기본값으로 바꿀 수 있습니다. 저장소에 있던 버전(Asia/Seoul, Calendar API 스코프)으로 되돌린 뒤:
   ```bash
   clasp push --force
   ```
   성공 시 루트에 `.clasp.json`이 생기고, [gas/](gas/) 파일이 원격 프로젝트에 올라갑니다. 이후 변경분은 보통 `clasp push`로 충분합니다.

### 1) Apps Script 프로젝트

1. (clasp 미사용 시) [script.google.com](https://script.google.com)에서 새 프로젝트 생성.
2. 이 저장소의 [gas/](gas/) 안 `*.gs` 및 [gas/appsscript.json](gas/appsscript.json) 내용을 붙여 넣거나 위 **0)** 처럼 [clasp](https://github.com/google/clasp)로 업로드.
3. 편집기 **서비스**(또는 리소스)에서 **Google Calendar API** 고급 서비스 사용 설정(api 활성화).
4. 프로젝트 **설정**에서 시간대를 `Asia/Seoul`로 맞춘다.

### 2) 스크립트 속성

| 키 | 설명 |
|----|------|
| `TELEGRAM_BOT_TOKEN` | BotFather 토큰 |
| `TELEGRAM_ALLOWED_CHAT_ID` | 본인 chat id(일일 요약·권한 제한에 필요) |
| `TELEGRAM_WEBHOOK_KEY` | (선택) URL `?key=` 값과 동일한 임의 문자열 |
| `CALENDAR_ID` | (선택) 기본값 `primary` |

### 3) 배포

1. **배포** → **새 배포** → 유형 **웹 앱**, 실행: **나**, 액세스: **모든 사용자**(Telegram 서버가 POST 가능해야 함).
2. 웹앱 URL을 복사한 뒤 `key`를 쓰는 경우 `.../exec?key=스크립트속성값` 형태로 연결.

### 4) Telegram Webhook

브라우저 또는 curl:

`https://api.telegram.org/bot<TOKEN>/setWebhook?url=<웹앱_URL>`

### 5) 일일 9시 요약 트리거

편집기에서 함수 `installDailyTrigger()` 를 한 번 실행(권한 승인).

## 문서

| 파일 | 용도 |
|------|------|
| [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) | 요구사항·메시지 규칙 |
| [DECISIONS.md](./DECISIONS.md) | 아키텍처 결정 |
| [WORK_LOG.md](./WORK_LOG.md) | 작업 기록 |
| [TODO.md](./TODO.md) | 할 일 |
| [BUGS.md](./BUGS.md) | 이슈 |

## 라이선스

(미정)
