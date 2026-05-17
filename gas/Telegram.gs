/**
 * Telegram Bot API — 메시지 전송
 */
function telegramApiUrl_(method) {
  var token = requireProp_(PROP_TELEGRAM_BOT_TOKEN);
  return 'https://api.telegram.org/bot' + token + '/' + method;
}

function sendTelegramMessage(chatId, text) {
  if (!chatId || text === undefined || text === null) return;
  var id = String(chatId);
  var body = {
    chat_id: id,
    text: String(text),
    disable_web_page_preview: true,
  };
  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(body),
    muteHttpExceptions: true,
  };
  var res = UrlFetchApp.fetch(telegramApiUrl_('sendMessage'), options);
  var code = res.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('Telegram sendMessage 실패 HTTP ' + code + ' ' + res.getContentText());
  }
}
