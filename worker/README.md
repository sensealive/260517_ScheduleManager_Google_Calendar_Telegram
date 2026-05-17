# Telegram to Google Apps Script Proxy

Cloudflare Worker가 Telegram webhook 요청을 먼저 받고, Google Apps Script 웹앱으로 전달한다.

## Variables

Worker 설정의 Variables and Secrets에 아래 값을 넣는다.

| Name | Example |
| --- | --- |
| `GAS_WEBAPP_URL` | `https://script.google.com/macros/s/.../exec?key=...` |
| `TELEGRAM_SECRET_TOKEN` | `setWebhook`에 넣은 `secret_token`과 동일한 임의 문자열 |

`TELEGRAM_SECRET_TOKEN`은 선택값이지만, 쓰는 것을 권장한다.

## Webhook

Worker 배포 URL이 `https://schedule-manager-proxy.example.workers.dev` 라면:

```powershell
$token = "새_텔레그램_봇_토큰"
$workerUrl = "https://schedule-manager-proxy.example.workers.dev"
$secret = "<setWebhook_secret_token과_동일>"

Invoke-RestMethod `
  -Uri "https://api.telegram.org/bot$token/setWebhook" `
  -Method Post `
  -Body @{
    url = $workerUrl
    secret_token = $secret
    drop_pending_updates = "true"
  }
```

확인:

```powershell
Invoke-RestMethod "https://api.telegram.org/bot$token/getWebhookInfo"
```
