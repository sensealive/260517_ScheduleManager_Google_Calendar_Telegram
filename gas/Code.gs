/**
 * Telegram Webhook 엔드포인트 & 일일 트리거
 *
 * 배포 후 텔레그램:
 *   https://api.telegram.org/bot<TOKEN>/setWebhook?url=<WEBAPP_URL>
 * WEBAPP_URL 예: .../exec?key=<TELEGRAM_WEBHOOK_KEY 에 저장한 값>
 *
 * 스크립트 속성(프로젝트 설정 → 스크립트 속성):
 *   TELEGRAM_BOT_TOKEN
 *   TELEGRAM_ALLOWED_CHAT_ID  (선택, 비우면 모든 채팅 허용 — 비권장)
 *   TELEGRAM_WEBHOOK_KEY      (선택, URL ?key= 와 일치)
 *   CALENDAR_ID               (선택, 기본 'primary')
 */

function doPost(e) {
  try {
    var keyExpected = getScriptProp_(PROP_TELEGRAM_WEBHOOK_KEY);
    if (keyExpected) {
      var keyGot = (e.parameter && e.parameter.key) || '';
      if (keyGot !== keyExpected) {
        return ContentService.createTextOutput('forbidden');
      }
    }
    if (!e.postData || !e.postData.contents) {
      return ContentService.createTextOutput('ok');
    }
    var data = JSON.parse(e.postData.contents);
    var msg = data.message;
    if (!msg || msg.text === undefined || msg.text === null) {
      return ContentService.createTextOutput('ok');
    }
    var chatId = String(msg.chat.id);
    var allowed = getScriptProp_(PROP_TELEGRAM_ALLOWED_CHAT_ID);
    if (allowed && String(allowed) !== chatId) {
      return ContentService.createTextOutput('ok');
    }
    var text = String(msg.text).trim();
    var reply = handleUserText_(text);
    sendTelegramMessage(chatId, reply);
  } catch (err) {
    Logger.log(err);
    try {
      var data2 = JSON.parse(e.postData.contents);
      if (data2.message && data2.message.chat) {
        sendTelegramMessage(String(data2.message.chat.id), '오류: ' + (err.message || String(err)));
      }
    } catch (ignore) {}
  }
  return ContentService.createTextOutput('ok');
}

function doGet() {
  return ContentService.createTextOutput('Telegram Calendar bot OK');
}

/**
 * @param {string} text
 * @returns {string}
 */
function handleUserText_(text) {
  var cmd = tryParseCommand_(text);
  if (cmd) {
    if (cmd.cmd === 'helpcmd') return COMMAND_LIST_TEXT;
    if (cmd.cmd === 'today') return listAndFormatDay_(0);
    if (cmd.cmd === 'tomorrow') return listAndFormatDay_(1);
    if (cmd.cmd === 'dayafter') return listAndFormatDay_(2);
    if (cmd.cmd === 'nextweek') {
      var ymd = nextWeekKoreanWeekdayYmd_(cmd.weekday, nowSeoul_());
      return listAndFormatYmd_(ymd.y, ymd.m, ymd.d);
    }
    if (cmd.cmd === 'date') {
      var y = resolveYearForMonthDay_(cmd.month, cmd.day, nowSeoul_());
      return listAndFormatYmd_(y, cmd.month, cmd.day);
    }
  }

  var reg = parseRegistrationLine_(text);
  if (reg.ok) {
    try {
      insertRegistration_(reg.payload);
      return '일정이 등록되었습니다.\n' + reg.payload.title;
    } catch (calErr) {
      Logger.log(calErr);
      return '캘린더 등록 실패: ' + (calErr.message || String(calErr));
    }
  }
  return reg.error || HELP_TEXT;
}

/** 매일 오전 9시 (스크립트 시간대 Asia/Seoul) */
function dailyMorningSummary() {
  var chat = requireProp_(PROP_TELEGRAM_ALLOWED_CHAT_ID);
  var body = dailyMorningSummaryPayload_();
  sendTelegramMessage(chat, body);
}

/**
 * 편집기에서 1회 실행: 매일 09–10시 사이 트리거(서울).
 * 기존 동일 이름 트리거가 있으면 삭제 후 재생성.
 */
function installDailyTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'dailyMorningSummary') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('dailyMorningSummary')
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .nearMinute(0)
    .inTimezone(TZ_SEOUL)
    .create();
}
