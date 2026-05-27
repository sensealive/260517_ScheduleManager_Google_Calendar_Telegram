# [260517_ScheduleManager_Google_Calendar_Telegram] Project Lessons 기록

## 2026-05-27 작업 회고

### 오늘의 목표

Telegram으로 받은 한국어 일정 메시지를 Google Calendar에 등록하고, 조회 명령과 매일 아침 요약을 Telegram으로 돌려주는 개인용 자동화 시스템을 만든다.

구조는 단순해 보였다. Telegram Bot이 메시지를 받고, Google Apps Script가 파싱한 뒤 Calendar API로 일정을 만들면 된다. 그러나 실제 제작 중에는 Google Apps Script 웹앱의 리디렉션, Telegram webhook 응답 규칙, Cloudflare Worker 프록시, Calendar API의 종일 일정 표현, 알림 정책, 한국어 날짜 파싱, 다중 캘린더 별칭, 배포 절차가 서로 맞물리며 여러 번 시행착오가 발생했다.

이 문서는 같은 실수를 반복하지 않기 위한 재발 방지 기록이다.

## 실패와 원인

### 1. Telegram webhook을 GAS `/exec`에 직접 연결함

초기에는 Telegram webhook URL을 Google Apps Script 웹앱 `/exec`에 직접 등록했다. 하지만 GAS 웹앱은 `script.googleusercontent.com` 쪽으로 `302 Moved Temporarily` 리디렉션을 반환할 수 있고, Telegram은 이를 정상 webhook 응답으로 보지 않았다.

결과적으로 `getWebhookInfo`에서 `Wrong response from the webhook: 302 Moved Temporarily` 오류가 발생했다.

재발 방지:

- Telegram webhook URL은 GAS `/exec`가 아니라 Cloudflare Worker URL로 등록한다.
- Worker는 Telegram에 즉시 `200 OK`를 반환하고, 내부에서 GAS URL로 POST를 전달한다.
- `getWebhookInfo`의 `url` 값이 Worker URL인지 먼저 확인한다.
- `last_error_message`에 302가 보이면 webhook이 GAS로 직접 연결되어 있는지 의심한다.

### 2. GAS GET 테스트에서 302 리디렉션을 오류로 오해함

PowerShell에서 GAS 웹앱 GET 테스트를 할 때 `-MaximumRedirection 0`을 사용하면 GAS의 정상 리디렉션도 `MaximumRedirectExceeded`처럼 보일 수 있다. 이 때문에 웹앱 자체가 실패한 것처럼 혼동할 여지가 있었다.

재발 방지:

- GAS GET 테스트는 리디렉션을 허용한 상태에서 수행한다.
- 정상 응답 기준은 최종 본문 `Telegram Calendar bot OK`다.
- Telegram webhook 검증과 GAS GET 검증은 별개의 단계로 분리한다.

### 3. Worker의 `GAS_WEBAPP_URL`에 `?key=...` 누락 가능성

GAS `doPost`는 스크립트 속성 `TELEGRAM_WEBHOOK_KEY`가 있으면 URL 쿼리 `?key=`와 비교한다. Worker 변수 `GAS_WEBAPP_URL`에 같은 key가 빠지면 Telegram은 Worker에서 `200 OK`를 받아도, 실제 GAS 내부 처리는 `forbidden`으로 끝난다.

이 경우 겉으로는 webhook이 정상처럼 보이지만 봇 응답이나 일정 등록이 되지 않아 원인 추적이 어렵다.

재발 방지:

- `TELEGRAM_WEBHOOK_KEY`를 쓰는 경우 Worker의 `GAS_WEBAPP_URL`은 반드시 `/exec?key=값` 형태로 둔다.
- GAS 스크립트 속성 값과 Worker URL의 `key` 값이 같은지 배포 후 확인한다.
- Worker의 `TELEGRAM_SECRET_TOKEN`과 GAS의 `TELEGRAM_WEBHOOK_KEY`는 역할이 다르다는 점을 구분한다.

### 4. `X-Telegram-Bot-Api-Secret-Token`을 GAS에서 직접 검증하려 함

Telegram `setWebhook`의 `secret_token`은 `X-Telegram-Bot-Api-Secret-Token` 헤더로 전달된다. 그러나 GAS 웹앱에서는 이 헤더를 안정적으로 검증하기 어렵다. 초기에 GAS에서 직접 secret header를 검증하려는 방향은 웹앱 환경 제약과 맞지 않았다.

재발 방지:

- Telegram secret token 검증은 Cloudflare Worker에서 수행한다.
- GAS는 URL `?key=`와 허용 chat id로 추가 방어한다.
- Worker와 GAS의 보안 검증 책임을 문서에 분리해서 기록한다.

### 5. `clasp create`가 `gas/appsscript.json`을 덮을 수 있음

`clasp create`를 실행하면 기존 `gas/appsscript.json`이 Google 기본 매니페스트로 바뀔 수 있다. 이 프로젝트의 매니페스트에는 `Asia/Seoul` 시간대, Calendar API 고급 서비스, OAuth scope, V8 런타임이 들어 있어 덮이면 Calendar 호출이나 트리거 시간이 틀어질 수 있다.

재발 방지:

- `clasp create` 후에는 `gas/appsscript.json`이 저장소 버전과 같은지 확인한다.
- `enabledAdvancedServices`에 Calendar v3가 있는지 확인한다.
- `timeZone`이 `Asia/Seoul`인지 확인한다.
- 이상하면 저장소 버전으로 되돌린 뒤 `clasp push --force`를 수행한다.

### 6. Calendar API 고급 서비스를 켜지 않으면 `Calendar.Events`가 동작하지 않음

코드는 `Calendar.Events.insert`, `Calendar.Events.list`를 사용한다. 이는 Apps Script의 기본 CalendarApp이 아니라 고급 서비스 Calendar API v3이므로 Apps Script 편집기에서 서비스를 켜야 한다.

매니페스트에 의존한다고 생각하고 편집기 서비스 활성화를 놓치면 런타임에서 Calendar 객체를 찾지 못하거나 권한 승인이 꼬일 수 있다.

재발 방지:

- Apps Script 편집기의 서비스 메뉴에서 Google Calendar API가 추가되어 있는지 확인한다.
- 식별자가 `Calendar`인지 확인한다.
- Google Cloud 쪽 Calendar API 활성화 요구가 나오면 함께 처리한다.
- 첫 배포 후 `명령어`, `내일일정`, 테스트 등록까지 실제로 실행해 권한 승인을 끝낸다.

### 7. Apps Script 시간대와 코드의 서울 기준 계산을 분리하지 않음

일정 등록, 일일 요약, 조회 명령은 모두 Asia/Seoul 기준이어야 한다. Apps Script 프로젝트 시간대, `appsscript.json`의 `timeZone`, 코드의 `TZ_SEOUL`이 어긋나면 오늘/내일 판단, 오전 9시 트리거, Calendar 조회 범위가 달라진다.

재발 방지:

- Apps Script 프로젝트 설정과 `appsscript.json`을 모두 `Asia/Seoul`로 맞춘다.
- 날짜 계산은 `Date` 기본 로컬 해석에 맡기지 않고 `fromSeoul_`, `seoulFields_` 같은 유틸리티를 사용한다.
- 조회 범위는 서울 00:00~다음날 00:00을 ISO로 변환해 사용한다.

### 8. 등록용 `M.D`와 조회용 `M.D`의 연도 해석을 혼동함

등록 메시지의 `M.D`는 올해 기준이며 이미 지난 날짜면 실패해야 한다. 반면 조회 명령 `6.20 일정`은 이미 지났으면 내년을 조회하도록 설계했다. 두 규칙을 같은 함수로 처리하면 과거 일정 등록을 허용하거나, 조회 명령이 사용자의 기대와 다르게 동작할 수 있다.

재발 방지:

- 등록에는 `yearMonthDayForRegistration_`을 사용하고, 과거면 실패한다.
- 조회에는 `resolveYearForMonthDay_`를 사용해 이미 지난 월일은 내년으로 넘긴다.
- 실패 메시지는 `"메시지 등록 실패 (미래 일정만 등록 가능)"`로 통일한다.

### 9. 기간 종일 일정의 종료일을 포함일로 저장하려 함

Google Calendar API의 종일 일정 `end.date`는 배타적 종료일이다. 사용자가 `6.3~6.8 출장`이라고 쓰면 화면상 6월 8일까지 보여야 하지만, API에는 종료일 다음날인 6월 9일을 넣어야 한다.

재발 방지:

- 종일 단일 일정은 시작일 + 1일을 `end.date`로 넣는다.
- 기간 일정은 사용자가 입력한 마지막 날 + 1일을 `end.date`로 넣는다.
- 코드에서는 `addDaysSeoulYmd_`로 배타 종료일을 계산한다.

### 10. 알림을 별도 `[알림]` 일정으로 만들려 함

초기 방향에는 알림용 별도 Calendar 이벤트를 만드는 방식이 섞여 있었다. 하지만 이 방식은 캘린더가 오염되고, 실제 일정과 알림 일정이 분리되어 수정/삭제 시 관리가 어려워진다.

재발 방지:

- 알림은 별도 일정이 아니라 원래 일정의 `reminders`에 등록한다.
- 시간 일정은 시작 시각 기준 `minutes before`로 변환한다.
- 종일/기간 일정은 Google Calendar의 종일 reminder 표현 제약을 따른다.

### 11. 종일 일정 reminder 표현을 시간 일정과 동일하게 생각함

Google Calendar에서 시간 일정의 `30분 전`과 종일 일정의 `당일 오전 9시`는 같은 방식으로 표현되지 않는다. 종일 일정은 Calendar UI/API에서 `On the same day at 09:00`, `The day before at 09:00` 같은 형태로 보인다.

이 차이를 무시하면 사용자가 입력한 알림 조건과 Calendar 화면 표시가 다르게 보여 혼란이 생긴다.

재발 방지:

- 종일/기간 일정의 `오전 9시`는 기본 종일 reminder인 `On the same day at 09:00`으로 처리한다.
- `하루전날`은 `The day before at 09:00`으로 처리한다.
- 종일/기간 일정에서 당일 특정 시각을 일반적으로 지원한다고 문서화하지 않는다.
- 지원하지 않는 알림은 명확한 실패 메시지를 반환한다.

### 12. 기본 알림 정책을 늦게 정해 파서와 문서가 흔들림

알림 조건이 없는 일정에 무엇을 붙일지 초기에 명확하지 않았다. 그 결과 `=` 뒤에 `알림` 단어를 쓰는 형태와 쓰지 않는 형태, 별도 알림 일정 방식, 기본 reminder 방식이 혼재할 수 있었다.

재발 방지:

- `=` 뒤 조건에는 `알림` 단어를 쓰지 않는 것으로 통일한다.
- 옵션이 없으면 기본 알림을 붙인다.
- 시간 일정은 시작 시각보다 이른 09:00~09:55 사이 5분 간격 슬롯을 사용한다.
- 09:00 이전 시간 일정은 기본 오전 알림을 생략한다.
- 문서, 도움말, 파서의 예시를 같은 표현으로 유지한다.

### 13. 다중 캘린더 별칭을 등록에만 적용하고 조회에는 빠뜨림

캘린더 별칭 헤더(`Tom 일정`)를 처음에는 일정 등록 중심으로 처리했다. 그러나 사용자는 같은 별칭으로 `오늘일정`, `다음주 일정`, `6.20 일정`도 조회하길 기대한다.

재발 방지:

- `extractCalendarTarget_` 결과를 등록 파서와 명령 파서 모두에서 사용한다.
- 조회 함수들은 `calendarAlias`를 받아 해당 캘린더 ID로 `Calendar.Events.list`를 호출한다.
- 알 수 없는 별칭은 `알 수 없는 캘린더 별칭` 오류로 명확히 알린다.

### 14. `CALENDAR_ALIASES_JSON` 형식과 권한을 과소평가함

다중 캘린더는 JSON 문자열 하나로 간단히 설정할 수 있지만, 실제로는 JSON 문법 오류, 별칭 대소문자, Calendar ID 오타, Apps Script 실행 계정의 캘린더 쓰기 권한 문제가 모두 실패 원인이 될 수 있다.

재발 방지:

- `CALENDAR_ALIASES_JSON`은 올바른 JSON인지 먼저 검증한다.
- 별칭은 trim 처리하고 소문자 키도 함께 등록한다.
- Calendar ID는 Google Calendar 설정 화면의 실제 값을 복사한다.
- 대상 캘린더에 Apps Script 실행 계정이 쓰기 권한을 갖는지 확인한다.

### 15. Cloudflare Worker URL 활성화를 배포와 동일시함

Worker 코드를 배포해도 workers.dev URL이 바로 활성화되어 있지 않을 수 있다. Overview에 `No URLs enabled`처럼 보이면 Telegram webhook으로 호출할 공개 URL이 없는 상태다.

재발 방지:

- Worker 배포 후 Domains 또는 Domains & Routes에서 workers.dev URL을 활성화한다.
- 브라우저나 PowerShell로 Worker URL을 열어 `Telegram GAS proxy OK`가 나오는지 확인한다.
- Telegram webhook은 활성화된 Worker URL로만 등록한다.

### 16. 코드 수정 후 배포 반영과 기존 이벤트 검증을 혼동함

로컬 `gas/` 파일을 수정해도 Apps Script 원격 프로젝트에는 자동 반영되지 않는다. 또한 알림/색상 정책을 바꾸더라도 기존에 이미 생성된 Calendar 이벤트에는 소급 적용되지 않는다.

재발 방지:

- 로컬 수정 후 `clasp push` 또는 Apps Script 편집기 수동 반영을 수행한다.
- 웹앱 배포 방식에 따라 새 버전 또는 새 배포가 필요한지 확인한다.
- 알림/색상 정책 변경 검증은 기존 테스트 일정을 삭제하고 새로 등록해 확인한다.

## 확정된 실행 규칙

- Telegram webhook은 항상 Cloudflare Worker URL로 등록한다.
- GAS `/exec` 직접 webhook 연결은 사용하지 않는다.
- Worker는 Telegram에 즉시 `200 OK`를 반환하고 GAS에는 내부 POST로 전달한다.
- `TELEGRAM_SECRET_TOKEN`은 Worker에서 검증한다.
- `TELEGRAM_WEBHOOK_KEY`는 GAS URL `?key=`와 GAS 스크립트 속성 값의 일치로 검증한다.
- 민감 정보는 코드가 아니라 Apps Script 스크립트 속성과 Worker Variables/Secrets에 둔다.
- `gas/appsscript.json`은 `Asia/Seoul`, Calendar API v3, 필요한 OAuth scope를 유지한다.
- Calendar API 고급 서비스의 식별자는 `Calendar`로 둔다.
- 등록용 `M.D`는 올해 기준이며 과거면 실패한다.
- 조회용 `M.D 일정`은 이미 지난 날짜면 내년을 조회한다.
- 종일/기간 일정의 Calendar API 종료일은 항상 배타적 종료일로 넣는다.
- 알림은 별도 `[알림]` 일정이 아니라 원래 일정의 `reminders`에 넣는다.
- `=` 뒤 조건에는 `알림` 단어를 쓰지 않는 표현으로 문서와 도움말을 통일한다.
- 캘린더 별칭은 등록과 조회 명령 모두에 적용한다.
- 로컬 코드 수정 후에는 반드시 원격 GAS 배포 반영과 실제 Telegram 테스트를 수행한다.

## 다음 작업 전 체크리스트

- [ ] `gas/appsscript.json`의 `timeZone`이 `Asia/Seoul`인가?
- [ ] `gas/appsscript.json`에 Calendar API v3 고급 서비스가 남아 있는가?
- [ ] Apps Script 편집기에서 Google Calendar API 서비스가 추가되어 있는가?
- [ ] Apps Script 스크립트 속성에 `TELEGRAM_BOT_TOKEN`이 있는가?
- [ ] `TELEGRAM_ALLOWED_CHAT_ID`가 실제 메시지를 보내는 chat id와 같은가?
- [ ] `TELEGRAM_WEBHOOK_KEY` 사용 시 Worker `GAS_WEBAPP_URL`에 같은 `?key=`가 포함되어 있는가?
- [ ] Worker `TELEGRAM_SECRET_TOKEN`과 Telegram `setWebhook secret_token`이 같은가?
- [ ] Worker URL GET에서 `Telegram GAS proxy OK`가 나오는가?
- [ ] GAS GET에서 `Telegram Calendar bot OK`가 나오는가?
- [ ] `getWebhookInfo`의 URL이 GAS가 아니라 Worker URL인가?
- [ ] `getWebhookInfo`에 `last_error_message`가 없는가?
- [ ] Telegram에서 `명령어`와 `내일일정`이 응답하는가?
- [ ] 테스트 등록 후 Calendar에서 일정, 색상, 알림이 기대대로 보이는가?
- [ ] 종일/기간 일정 검증 시 종료일이 하루 밀려 보이지 않는가?
- [ ] 별칭 캘린더 등록/조회 시 대상 캘린더 권한과 JSON 형식이 맞는가?
- [ ] 코드 변경 후 `clasp push` 또는 Apps Script 수동 반영을 했는가?
- [ ] 알림/색상 정책 변경 검증은 새 테스트 일정으로 확인했는가?

## 오늘의 결론

이 프로젝트의 어려움은 일정 파싱 자체보다 각 플랫폼의 작은 전제들이었다. Telegram은 webhook 응답을 엄격하게 보고, GAS는 웹앱 리디렉션과 헤더 제약이 있으며, Calendar API는 시간 일정과 종일 일정의 모델이 다르다. 앞으로는 “코드가 맞다”를 성공으로 보지 말고, Worker, GAS, Telegram, Calendar 각각의 실제 응답과 화면 결과까지 검증해야 한다.
