/**
 * 사용자 메시지 파싱 — 조회 명령 / 일정 등록
 */

var MSG_PAST =
  '메시지 등록 실패 (미래 일정만 등록 가능)';

var HELP_TEXT =
  '올바른 예시)\n' +
  '• 5.20 연차\n' +
  '• 5.20 연차 = 온종일\n' +
  '• 5.20 연차 = 하루전날\n' +
  '• 5.20 연차 = 6시간 전\n' +
  '• 5.8 오후 3시 업체미팅(영일) = 30분 전\n' +
  '• 6.3~6.8 출장 = 하루전날\n' +
  '• 5.22 오후 2시 회의 = 6.30까지 매주 반복\n' +
  '• 명령: 오늘일정 / 내일일정 / 모레일정 / 다음주 일정 / 6.20 일정 / 차주 금 일정 / 명령어';

var REGISTRATION_HELP_TEXT =
  '일정등록방법\n' +
  '• 기본: M.D 제목\n' +
  '  예) 5.20 연차\n' +
  '• 캘린더 선택: 별칭 일정 줄 다음에 등록 내용을 입력\n' +
  '  예) Tom 일정\\n5.20 연차 = 하루전날\n' +
  '• 시간 일정: M.D 오전/오후 N시 제목 = 알림 조건\n' +
  '  예) 5.8 오후 3시 업체미팅 = 30분 전\n' +
  '• 종일 일정: M.D 제목 = 온종일 또는 하루종일\n' +
  '  예) 5.20 연차 = 하루종일\n' +
  '• 기본: 알림 조건이 없으면 기본 알림을 붙임\n' +
  '• 알림 조건: 30분 전 / 6시간 전 / 하루전날 / 오전 10시 / 오후 2시\n' +
  '  예) 5.20 연차 = 하루전날\n' +
  '• 기간 일정: M.D~M.D 제목 = 알림 조건\n' +
  '  예) 6.3~6.8 출장 = 하루전날\n' +
  '• 반복 일정: M.D 시간 제목 = M.D까지 매주 반복\n' +
  '  예) 5.22 오후 2시 회의 = 6.30까지 매주 반복';

var COMMAND_LIST_TEXT =
  '지원 명령어\n' +
  '• 오늘일정\n' +
  '• 내일일정\n' +
  '• 모레일정\n' +
  '• 다음주 일정\n' +
  '• M.D 일정 (예: 6.20 일정)\n' +
  '• 차주 (월|화|수|목|금|토|일) 일정 (예: 차주 금 일정)\n' +
  '• 일정등록방법 / 등록방법 / help\n' +
  '• 명령어';

/**
 * @param {string} text
 * @returns {{type:string}|null}
 */
function tryParseCommand_(text) {
  var target = extractCalendarTarget_(String(text).trim());
  var t = target.line
    .replace(/\s+/g, ' ')
    .trim();
  var alias = target.alias;
  if (t === '오늘일정') return { type: 'cmd', cmd: 'today', calendarAlias: alias };
  if (t === '내일일정') return { type: 'cmd', cmd: 'tomorrow', calendarAlias: alias };
  if (t === '모레일정') return { type: 'cmd', cmd: 'dayafter', calendarAlias: alias };
  if (t === '다음주 일정') return { type: 'cmd', cmd: 'nextweekall', calendarAlias: alias };
  if (t === '명령어') return { type: 'cmd', cmd: 'helpcmd', calendarAlias: alias };
  if (t === '일정등록방법' || t === '등록방법' || t.toLowerCase() === 'help') {
    return { type: 'cmd', cmd: 'reghelp', calendarAlias: alias };
  }
  var cw = t.match(/^차주\s*([월화수목금토일])\s*일정$/);
  if (cw) return { type: 'cmd', cmd: 'nextweek', weekday: cw[1], calendarAlias: alias };
  var dm = t.match(/^(\d{1,2})\.(\d{1,2})\s*일정$/);
  if (dm) return { type: 'cmd', cmd: 'date', month: Number(dm[1]), day: Number(dm[2]), calendarAlias: alias };
  return null;
}

/**
 * @param {string} line
 * @returns {{ok:boolean, payload?:Object, error?:string}}
 */
function parseRegistrationLine_(line) {
  var raw = String(line).trim();
  if (!raw) return { ok: false, error: HELP_TEXT };
  var target = extractCalendarTarget_(raw);
  raw = target.line;
  var eq = raw.indexOf('=');
  var left = eq < 0 ? raw : raw.slice(0, eq).trim();
  var right = eq < 0 ? '' : raw.slice(eq + 1).trim();
  if (!left) return { ok: false, error: HELP_TEXT };
  if (eq >= 0 && !right) return { ok: false, error: HELP_TEXT };

  var consumed = 0;
  var y;
  var month;
  var day;
  var y2;
  var m2;
  var d2;

  var full = left.match(
    /^(\d{2,4})\.(\d{1,2})\.(\d{1,2})\s+/
  );
  var range = !full && left.match(/^(\d{1,2})\.(\d{1,2})~(\d{1,2})\.(\d{1,2})\s+/);
  var shortD = !full && !range && left.match(/^(\d{1,2})\.(\d{1,2})\s+/);

  var rest;
  if (full) {
    y = normalizeYear_(Number(full[1]));
    month = Number(full[2]);
    day = Number(full[3]);
    consumed = full[0].length;
    rest = left.slice(consumed).trim();
  } else if (range) {
    var rng = resolveRangeRegistrationYmd_(
      Number(range[1]),
      Number(range[2]),
      Number(range[3]),
      Number(range[4]),
      nowSeoul_()
    );
    if (!rng.ok) {
      return {
        ok: false,
        error: rng.reason === 'past' ? MSG_PAST : HELP_TEXT,
      };
    }
    y = rng.startYmd.y;
    month = rng.startYmd.m;
    day = rng.startYmd.d;
    y2 = rng.endYmd.y;
    m2 = rng.endYmd.m;
    d2 = rng.endYmd.d;
    consumed = range[0].length;
    rest = left.slice(consumed).trim();
  } else if (shortD) {
    month = Number(shortD[1]);
    day = Number(shortD[2]);
    var ymdReg = yearMonthDayForRegistration_(month, day, nowSeoul_());
    if (!ymdReg) return { ok: false, error: MSG_PAST };
    y = ymdReg.y;
    consumed = shortD[0].length;
    rest = left.slice(consumed).trim();
  } else {
    return { ok: false, error: HELP_TEXT };
  }

  var hour = 0;
  var minute = 0;
  var timed = false;

  var ampm = rest.match(/^(오전|오후)\s*(\d{1,2})시(?:\s+|$)/);
  var h24 = !ampm && rest.match(/^(\d{1,2})시(?:\s+|$)/);
  if (ampm) {
    timed = true;
    var ap = ampm[1];
    var hh = Number(ampm[2]);
    if (ap === '오전') hour = hh === 12 ? 0 : hh;
    else hour = hh === 12 ? 12 : hh + 12;
    minute = 0;
    rest = rest.slice(ampm[0].length).trim();
  } else if (h24) {
    timed = true;
    hour = Number(h24[1]);
    minute = 0;
    rest = rest.slice(h24[0].length).trim();
  }

  var title = rest.trim();
  if (!title) return { ok: false, error: HELP_TEXT };

  var opts = parseOptionString_(right, { y: y, m: month, d: day });
  var now = nowSeoul_();

  /** @type {Object} */
  var payload = {
    title: title,
    calendarAlias: target.alias,
    optionText: right,
    recurrence: opts.recurrence,
    reminderRules: opts.reminderRules,
  };

  if (range) {
    payload.kind = 'allday_range';
    payload.startYmd = { y: y, m: month, d: day };
    payload.endYmd = { y: y2, m: m2, d: d2 };
    if (timed) {
      return { ok: false, error: HELP_TEXT };
    }
    var rangeFirstStart = fromSeoul_(y, month, day, 0, 0);
    if (rangeFirstStart.getTime() < now.getTime()) return { ok: false, error: MSG_PAST };
  } else {
    if (timed) {
      payload.kind = 'timed';
      payload.start = fromSeoul_(y, month, day, hour, minute);
      payload.end = new Date(payload.start.getTime() + 60 * 60 * 1000);
    } else {
      payload.kind = 'allday_single';
      payload.startYmd = { y: y, m: month, d: day };
    }
  }

  if (payload.kind === 'timed') {
    if (payload.start.getTime() < now.getTime()) return { ok: false, error: MSG_PAST };
  } else if (payload.kind === 'allday_single') {
    var dayEnd = fromSeoul_(y, month, day, 23, 59);
    if (dayEnd.getTime() < now.getTime()) return { ok: false, error: MSG_PAST };
  } else if (payload.kind === 'allday_range') {
    var last = fromSeoul_(payload.endYmd.y, payload.endYmd.m, payload.endYmd.d, 23, 59);
    if (last.getTime() < now.getTime()) return { ok: false, error: MSG_PAST };
  }

  applyDefaultReminder_(payload);
  return { ok: true, payload: payload };
}

function extractCalendarTarget_(raw) {
  var lines = String(raw)
    .split(/\r?\n/)
    .map(function (s) {
      return s.trim();
    })
    .filter(function (s) {
      return !!s;
    });

  if (lines.length >= 2) {
    var m = lines[0].match(/^(.+?)\s*일정$/);
    if (m) {
      return {
        alias: m[1].trim(),
        line: lines.slice(1).join(' '),
      };
    }
  }

  return { alias: '', line: raw };
}

/**
 * @param {string} opt
 * @param {{y:number,m:number,d:number}} startCtx
 */
function parseOptionString_(opt, startCtx) {
  var out = {
    recurrence: null,
    reminderRules: [],
  };
  var t = String(opt);

  if (/매주\s*반복/.test(t)) {
    var um = t.match(/(\d{1,2})\.(\d{1,2})까지/);
    if (um) {
      var uy = resolveYearForMonthDay_(Number(um[1]), Number(um[2]), fromSeoul_(startCtx.y, startCtx.m, startCtx.d, 12, 0));
      out.recurrence = { freq: 'WEEKLY', until: { y: uy, m: Number(um[1]), d: Number(um[2]) } };
    }
  }

  if (/30분\s*전/.test(t)) out.reminderRules.push({ kind: 'minutes', n: 30 });
  var hm = t.match(/(\d{1,2})\s*시간\s*전/);
  if (hm) out.reminderRules.push({ kind: 'hours_before', n: Number(hm[1]) });
  if (/1일\s*전|하루\s*전|하루전날|전날/.test(t)) {
    out.reminderRules.push({ kind: 'previous_day_morning', hour: 9, minute: 0 });
  }

  var at = parseSameDayTimeOption_(t);
  if (at) {
    out.reminderRules.push({ kind: 'same_day_morning', hour: at.hour, minute: at.minute });
  }

  return out;
}

function parseSameDayTimeOption_(text) {
  var m = String(text).match(/(?:당일\s*)?(오전|오후)\s*(\d{1,2})시/);
  if (!m) return null;

  var hh = Number(m[2]);
  if (hh < 1 || hh > 12) return null;
  if (m[1] === '오전') {
    return { hour: hh === 12 ? 0 : hh, minute: 0 };
  }
  return { hour: hh === 12 ? 12 : hh + 12, minute: 0 };
}

function applyDefaultReminder_(payload) {
  if (payload.reminderRules && payload.reminderRules.length) {
    return;
  }

  if (payload.kind === 'timed') {
    var f = seoulFields_(payload.start);
    var eventMinutes = f.hh * 60 + f.mm;
    var firstSlot = 9 * 60;
    if (eventMinutes < firstSlot) return;
    var maxSlot = Math.min(11, Math.floor((eventMinutes - firstSlot) / 5));
    var timedMinute = defaultMorningReminderMinute_(payload.title, f, maxSlot);
    payload.reminderRules.push({ kind: 'same_day_morning', hour: 9, minute: timedMinute });
    return;
  }

  payload.reminderRules.push({ kind: 'same_day_morning', hour: 9, minute: 0 });
}

function defaultMorningReminderMinute_(title, ymd, maxSlot) {
  var s = String(ymd.y) + '-' + String(ymd.m) + '-' + String(ymd.d || ymd.day) + '-' + String(title || '');
  var h = 0;
  for (var i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) % 9973;
  }
  var limit = maxSlot === undefined ? 11 : maxSlot;
  return (h % (limit + 1)) * 5;
}
