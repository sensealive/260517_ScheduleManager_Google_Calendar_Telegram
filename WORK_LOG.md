# 작업 로그

날짜별로 수행한 작업을 짧게 기록합니다. (커밋과 별개로 “무슨 일을 했는지” 추적할 때 유용합니다.)

## 형식 예시

### YYYY-MM-DD

- 한 일 1
- 한 일 2

---

### 2026-05-17

- GAS 웹앱 `/exec` GET 호출을 PowerShell에서 확인했다. `-MaximumRedirection 0` 사용 시 GAS의 302 리디렉션 때문에 `MaximumRedirectExceeded`가 발생했으나, 리디렉션 허용 후 `Telegram Calendar bot OK` 응답을 확인했다.
- Telegram webhook을 GAS `/exec`에 직접 등록했을 때 `getWebhookInfo`에서 `Wrong response from the webhook: 302 Moved Temporarily` 오류가 발생하는 것을 확인했다.
- GAS 직접 webhook 연결 대신 Cloudflare Worker 프록시를 사용하는 방향으로 결정하고, [worker/telegram-gas-proxy.js](worker/telegram-gas-proxy.js)를 추가했다.
- Worker 문서 [worker/README.md](worker/README.md)를 추가해 `GAS_WEBAPP_URL`, `TELEGRAM_SECRET_TOKEN`, `setWebhook` 등록 절차를 기록했다.
- Cloudflare Worker 프로젝트 `260517-schedule-manager-google-calendar-telegram`를 만들고 workers.dev URL을 활성화했다.
- Worker URL `https://260517-schedule-manager-google-calendar-telegram.danccing.workers.dev`를 Telegram webhook으로 등록했으며, `getWebhookInfo`에서 URL 반영 및 `pending_update_count: 0` 상태를 확인했다.
- 후속 확인 필요: Cloudflare Worker 변수 `GAS_WEBAPP_URL`에 GAS `?key=...`(스크립트 속성과 동일)를 포함한 뒤 텔레그램 `내일일정` 명령 응답을 재검증한다.
- 등록 도움말 명령 `일정등록방법`, `등록방법`, `help`를 추가했다.
- 등록 예시 안내를 여러 케이스(종일, 시간, 기간, 반복)로 확장했다.
- `5.20 연차`처럼 `=` 옵션 없이 보내도 종일 일정으로 등록되도록 파서를 변경했고, `5.20 연차 = 온종일`, `5.20 연차 = 하루종일` 형태도 유효하게 유지했다.
- `다음주 일정` 명령을 추가해 다음 주 월~일 일정을 일자별로 구분해 출력하도록 했다.
- 모든 등록 일정에 기본 알림을 추가했다. 시간 일정은 시작 시각보다 이른 09:00~09:55 슬롯 중 하나를 사용하고, 종일/기간 일정은 `On the same day at 09:00` reminder를 사용한다.
- `하루전날`, `오전 9시`, `6시간 전` 알림 조건 표현을 추가했다.
- 일정 색상을 지정했다. 시간 있는 일반 일정은 `colorId: '5'`(바나나), 종일/기간 일정은 `colorId: '11'`(토마토)를 사용한다.
- 종일/기간 일정의 시작 전 알림(`하루전날`, `6시간 전`, `30분 전`)은 원래 종일 일정의 popup reminder로 등록되도록 수정했다.
- 다중 캘린더 등록을 지원했다. 스크립트 속성 `CALENDAR_ALIASES_JSON`에 별칭과 Calendar ID를 JSON으로 저장하고, 메시지 첫 줄에 `Tom 일정`처럼 쓰면 해당 캘린더로 등록한다.
- 알림용 별도 `[알림]` 일정을 생성하지 않도록 제거했다.
- `=` 뒤 조건에서는 `알림` 단어를 쓰지 않는 형태로 문서와 도움말을 통일했다. 예: `30분 전`, `하루전날`, `오전 9시`.
- 종일/기간 일정의 `오전 9시`를 원래 일정의 `On the same day at 09:00` reminder로 등록하도록 수정했다. `하루전날`은 `The day before at 09:00` reminder로 등록한다.
- 기본 알림 설명과 구현을 정리했다. 시간 일정은 시작 시각보다 이른 09:00~09:55 슬롯 중 하나를 사용하고, 종일/기간 일정은 `On the same day at 09:00` reminder를 사용한다.

---

### 템플릿

### YYYY-MM-DD

- 
