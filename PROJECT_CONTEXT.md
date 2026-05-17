# 프로젝트 맥락 — Google Calendar + Telegram 일정 관리

## 배경

텔레그램으로 받은 한국어 메시지를 파싱해 Google 캘린더에 일정을 등록하고, 명령어로 특정 날짜의 일정을 조회하며, 매일 아침 오늘 일정을 요약받기 위한 개인용 자동화다.

## 목표

- 텔레그램 메시지 한 줄로 **날짜·시간·내용·알림/반복**을 해석해 캘린더에 반영한다.
- **미래 일정만** 등록한다. 시작 일시(또는 기간 일정의 첫날 0시)가 현재보다 이전이면 실패 메시지를 보낸다.
- **일일 요약**: 매일 09:00(Asia/Seoul) 오늘 일정을 시간순으로 텔레그램 전송.
- **온디맨드 조회**: 고정 명령어로 해당 날짜 일정을 시간순 요약 전송.
- 입력이 규격에 맞지 않으면 **올바른 예시**를 텔레그램으로 안내한다.

## 아키텍처

- Telegram Bot **Webhook** → **Cloudflare Worker 프록시** → **Google Apps Script Web App** `doPost` → Google Calendar API v3(고급 서비스 `Calendar`).
- Telegram이 Google Apps Script 웹앱 `/exec`의 `302 Moved Temporarily` 응답을 webhook 실패로 처리하므로, Worker가 Telegram 요청을 먼저 받고 GAS로 전달한다.
- Worker는 Telegram에는 즉시 `200 OK`를 반환하고, 내부에서 `GAS_WEBAPP_URL`로 POST를 전달한다.
- 일일 요약은 GAS **시간 기반 트리거**(`installDailyTrigger` → `dailyMorningSummary`).
- 소스 위치: [gas/](gas/)
- Worker 프록시 소스 위치: [worker/](worker/)

## 메시지 규칙 (등록)

- 한 줄 형태: `[날짜/기간] [시간(선택)] 본문` 또는 `[날짜/기간] [시간(선택)] 본문 = [조건]`
- **`=`** 뒤 옵션은 선택값이다. 옵션 없이 `5.20 연차`처럼 보내면 해당일 **종일 일정**으로 등록한다.
- 여러 캘린더를 쓸 때는 첫 줄에 `[별칭] 일정`을 쓰고, 다음 줄에 등록 내용을 쓴다. 예: `Tom 일정` 줄 다음에 `5.20 연차 = 하루전날`.
- **날짜**
  - `YY.M.D` 또는 `YY.MM.DD`(예: `27.05.07`, `27.5.7`): 앞=연, 가운데=월, 끝=일(2자리 연도는 2000년대).
  - `M.D`(예: `5.25`): 월·일, **올해** 기준이며 날짜만 이미 지났으면, 실패메시지 `"메시지 등록 실패 (미래 일정만 등록 가능)"`.
  - 기간 `M.D~M.D`(예: `6.3~6.8`): 같은 해석 방식으로 멀티데이 **종일** 일정(시간 포함 불가).
- **시간**: `오전/오후 N시`, `N시`(24시 형태, 예: `07시`).
- **과거 금지**: 메시지 `"메시지 등록 실패 (미래 일정만 등록 가능)"`.
- **옵션(예시)**
  - `온종일` / `하루종일` → 종일 일정 의미. 예: `5.20 연차 = 온종일`.
  - `=` 뒤 조건에는 `알림` 단어를 쓰지 않는다. 예: `5.20 연차 = 하루전날`, `5.8 오후 3시 회의 = 30분 전`.
  - 옵션에 알림 조건이 없으면 기본 알림을 등록한다.
    시간 일정은 시작 시각보다 이른 09:00~09:55 사이 5분 간격 슬롯 중 하나를 사용한다. 예를 들어 15:00 일정은 09:00~09:55 중 하나, 09:10 일정은 09:00~09:10 중 하나를 사용한다. 09:00 이전 시간 일정은 기본 오전 알림을 생략한다.
    종일/기간 일정은 Google Calendar 종일 일정 reminder의 `On the same day at 09:00` 형태로 등록한다.
  - `하루전날` / `하루 전` / `전날` → 일정 전날 09:00 알림.
  - `오전 9시` / `당일 오전 9시` → 일정 당일 09:00 알림.
  - `N시간 전`(예: `6시간 전`) → 시작 시각 기준 N시간 전 알림. 종일 일정은 해당일 00:00 기준으로 계산한다.
  - `M.D까지 매주 반복` → 주간 반복 + 종료일(RRULE UNTIL).
  - `30분 전` → 시작 시각 기준 30분 전 알림.
  - 종일·기간 일정의 `오전 9시`는 Google Calendar 종일 일정 reminder의 `On the same day at 09:00` 형태로 등록한다.
  - 종일·기간 일정의 `하루전날`은 Google Calendar 종일 일정 reminder의 `The day before at 09:00` 형태로 등록한다.
  - 알림용 별도 일정을 만들지 않는다.

## 캘린더 표시 규칙

- 시간 있는 일반 일정은 Google Calendar `colorId: '5'`(바나나)로 등록한다.
- 종일/기간 일정은 Google Calendar `colorId: '11'`(토마토)로 등록한다.

## 명령어 (조회·도움)

- `오늘일정`, `내일일정`, `모레일정`
- `다음주 일정` → 다음 주 월~일 일정을 일자별로 구분해 출력
- `M.D 일정` (예: `6.20 일정`, 월.일은 올해 우선·이미 지났으면 내년)
- `차주 (월|화|수|목|금|토|일) 일정` (예: `차주 금 일정`)
- `명령어` → 지원 명령 목록
- `일정등록방법`, `등록방법`, `help` → 등록 방법과 예시 출력

## 실패 시 응답

- 등록 예: `5.8 오후 3시 업체미팅(영일) = 30분 전`
- 명령 예: `오늘일정`, `내일일정`, `모레일정`, `6.20 일정`, `차주 금 일정`, `명령어`

## 범위

- **포함**: 단일/소수 사용자(허용 chat id), 한국어, GAS 서버리스, Webhook 수신, 위 패턴.
- **제외(초기)**: 일정 수정/삭제 대화형 플로우, 다중 캘린더 선택 UI, LLM 파싱.

## 비밀·설정

- Bot Token, Webhook `key`, chat id, 캘린더 ID는 **스크립트 속성**에만 저장하고 Git에 올리지 않는다. 예시는 [.env](.env).
- `CALENDAR_ID`: 별칭이 없는 등록과 조회 명령에 사용하는 기본 캘린더 ID. 기본값은 `primary`.
- `CALENDAR_ALIASES_JSON`: 선택적 캘린더 별칭 JSON. 예: `{"Tom":"tom_calendar_id@group.calendar.google.com","Jane":"jane_calendar_id@group.calendar.google.com"}`.
- GAS 스크립트 속성 `TELEGRAM_WEBHOOK_KEY`가 설정되어 있으면 Worker의 `GAS_WEBAPP_URL`에도 `?key=...`를 포함해야 `doPost` 검증을 통과한다.
- Cloudflare Worker 변수:
  - `GAS_WEBAPP_URL`: GAS 웹앱 `/exec` URL. `TELEGRAM_WEBHOOK_KEY` 사용 시 `?key=...` 포함.
  - `TELEGRAM_SECRET_TOKEN`: Telegram `setWebhook`의 `secret_token` 값과 동일하게 설정해 Telegram → Worker 요청을 검증한다.

## 현재 배포 메모

- GAS GET 테스트는 `Telegram Calendar bot OK` 응답으로 정상 확인됨.
- Telegram webhook을 GAS `/exec`에 직접 연결하면 `Wrong response from the webhook: 302 Moved Temporarily`가 발생함.
- Cloudflare Worker 프로젝트 이름: `260517-schedule-manager-google-calendar-telegram`
- Worker URL: `https://260517-schedule-manager-google-calendar-telegram.danccing.workers.dev`
- Telegram `getWebhookInfo`에서 Worker URL 등록 및 `pending_update_count: 0` 상태까지 확인됨.
- 현재 남은 확인 사항: Worker의 `GAS_WEBAPP_URL`에 스크립트 속성 `TELEGRAM_WEBHOOK_KEY`와 동일한 `?key=...` 포함 여부 및 `내일일정` 응답 확인.

## 성공 기준

- 예시 문자열이 캘린더에 반영되고, 잘못된 입력에 안내가 온다.
- 매일 9시 요약 트리거와 명령어 조회가 동작한다.

## 이해관계자 / 사용자

- 본인 단일 사용자(텔레그램 + Google 동일 계정 권한).

## 용어

- **GAS**: Google Apps Script. **Webhook**: Telegram이 업데이트를 POST하는 URL.
