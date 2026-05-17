/** Script Properties 키 (Apps Script → 프로젝트 설정 → 스크립트 속성) */
var PROP_TELEGRAM_BOT_TOKEN = 'TELEGRAM_BOT_TOKEN';
var PROP_TELEGRAM_ALLOWED_CHAT_ID = 'TELEGRAM_ALLOWED_CHAT_ID';
/** Webhook URL 쿼리 ?key= 값과 동일하게 설정 (선택, 비우면 검증 안 함) */
var PROP_TELEGRAM_WEBHOOK_KEY = 'TELEGRAM_WEBHOOK_KEY';
/** 대상 캘린더 ID (기본 캘린더면 'primary') */
var PROP_CALENDAR_ID = 'CALENDAR_ID';
/** 캘린더 별칭 JSON. 예: {"Tom":"tom_calendar_id@group.calendar.google.com"} */
var PROP_CALENDAR_ALIASES_JSON = 'CALENDAR_ALIASES_JSON';

function getScriptProp_(key) {
  return PropertiesService.getScriptProperties().getProperty(key) || '';
}

function requireProp_(key) {
  var v = getScriptProp_(key);
  if (!v) throw new Error('스크립트 속성 누락: ' + key);
  return v;
}
