/**
 * Google Calendar API v3 (Advanced Calendar Service)
 */

var COLOR_ID_TIMED_EVENT = '5'; // 바나나
var COLOR_ID_ALLDAY_EVENT = '11'; // 토마토

function calendarId_() {
  var id = getScriptProp_(PROP_CALENDAR_ID);
  return id || 'primary';
}

function calendarIdForPayload_(payload) {
  var alias = payload && payload.calendarAlias ? String(payload.calendarAlias).trim() : '';
  return calendarIdForAlias_(alias);
}

function calendarIdForAlias_(alias) {
  alias = alias ? String(alias).trim() : '';
  if (!alias) return calendarId_();
  var aliases = calendarAliases_();
  var id = aliases[alias] || aliases[alias.toLowerCase()];
  if (!id) throw new Error('알 수 없는 캘린더 별칭: ' + alias);
  return id;
}

function calendarAliases_() {
  var raw = getScriptProp_(PROP_CALENDAR_ALIASES_JSON);
  if (!raw) return {};

  try {
    var parsed = JSON.parse(raw);
    var out = {};
    for (var k in parsed) {
      if (Object.prototype.hasOwnProperty.call(parsed, k)) {
        out[String(k).trim()] = String(parsed[k]).trim();
        out[String(k).trim().toLowerCase()] = String(parsed[k]).trim();
      }
    }
    return out;
  } catch (err) {
    throw new Error('CALENDAR_ALIASES_JSON 파싱 실패: ' + (err.message || String(err)));
  }
}

function pad2Cal_(n) {
  return n < 10 ? '0' + n : '' + n;
}

function isoSeoul_(y, m, d, hh, mm) {
  return y + '-' + pad2Cal_(m) + '-' + pad2Cal_(d) + 'T' + pad2Cal_(hh) + ':' + pad2Cal_(mm) + ':00+09:00';
}

function isoSeoulFromDate_(d) {
  var f = seoulFields_(d);
  return isoSeoul_(f.y, f.m, f.day, f.hh, f.mm);
}

/**
 * @param {Date} start
 * @param {Array<Object>} rules
 * @returns {{useDefault:boolean, overrides:Array}}
 */
function buildReminderOverrides_(start, rules) {
  var out = [];
  if (!rules || !rules.length) return { useDefault: false, overrides: [] };
  var f = seoulFields_(start);
  var evMinutes = f.hh * 60 + f.mm;

  for (var i = 0; i < rules.length; i++) {
    var r = rules[i];
    if (r.kind === 'minutes') out.push({ method: 'popup', minutes: r.n });
    else if (r.kind === 'hours_before') out.push({ method: 'popup', minutes: 60 * r.n });
    else if (r.kind === 'days_before') out.push({ method: 'popup', minutes: 24 * 60 * r.n });
    else if (r.kind === 'previous_day_morning') {
      var prev = addDaysSeoulYmd_(f.y, f.m, f.day, -1);
      var prevTarget = fromSeoul_(prev.y, prev.m, prev.d, r.hour || 9, r.minute || 0);
      var prevDiff = Math.floor((start.getTime() - prevTarget.getTime()) / (60 * 1000));
      if (prevDiff >= 0) out.push({ method: 'popup', minutes: prevDiff });
    }
    else if (r.kind === 'same_day_morning') {
      var tgt = (r.hour || 9) * 60 + (r.minute || 0);
      var diff = evMinutes - tgt;
      if (diff > 0) out.push({ method: 'popup', minutes: diff });
      else if (diff === 0) out.push({ method: 'popup', minutes: 0 });
    }
  }
  if (out.length === 0) return { useDefault: false, overrides: [] };
  return { useDefault: false, overrides: out };
}

function buildRemindersAllDayDefault_() {
  return { useDefault: false, overrides: [] };
}

function buildAllDayReminderOverrides_(payload) {
  var out = [];
  var rules = payload.reminderRules || [];
  var start = payloadStartDate_(payload);
  if (!start || !rules.length) return { useDefault: false, overrides: [] };
  var useDefault = false;

  for (var i = 0; i < rules.length; i++) {
    var r = rules[i];
    if (r.kind === 'same_day_morning' && isAllDayDefaultSameDayReminder_(r)) {
      useDefault = true;
      continue;
    }
    var minutes = allDayReminderMinutesBeforeStart_(start, r);
    if (minutes !== null) out.push({ method: 'popup', minutes: minutes });
  }

  if (!out.length && useDefault) return { useDefault: true };
  return { useDefault: false, overrides: out };
}

function allDayReminderMinutesBeforeStart_(start, rule) {
  if (rule.kind === 'minutes') return rule.n;
  if (rule.kind === 'hours_before') return 60 * rule.n;
  if (rule.kind === 'days_before') return allDayMorningMinutesBeforeStart_(rule.n, 9, 0);
  if (rule.kind === 'same_day_morning') return 0;
  if (rule.kind === 'previous_day_morning') {
    return allDayMorningMinutesBeforeStart_(1, rule.hour || 9, rule.minute || 0);
  }
  return null;
}

function allDayMorningMinutesBeforeStart_(daysBefore, hour, minute) {
  return daysBefore * 24 * 60 - hour * 60 - minute;
}

function rruleUntilStr_(untilYmd) {
  var endInst = fromSeoul_(untilYmd.y, untilYmd.m, untilYmd.d, 23, 59);
  return Utilities.formatDate(endInst, 'UTC', "yyyyMMdd'T'HHmmss'Z'");
}

/**
 * @param {Object} payload from parseRegistrationLine_
 */
function insertRegistration_(payload) {
  var calId = calendarIdForPayload_(payload);
  var recur = payload.recurrence;

  if (payload.kind === 'timed') {
    var reminders = buildReminderOverrides_(payload.start, payload.reminderRules);
    var resource = {
      summary: payload.title,
      start: { dateTime: isoSeoulFromDate_(payload.start), timeZone: TZ_SEOUL },
      end: { dateTime: isoSeoulFromDate_(payload.end), timeZone: TZ_SEOUL },
      reminders: reminders,
      colorId: COLOR_ID_TIMED_EVENT,
    };
    if (recur && recur.freq === 'WEEKLY') {
      resource.recurrence = ['RRULE:FREQ=WEEKLY;UNTIL=' + rruleUntilStr_(recur.until)];
    }
    Calendar.Events.insert(resource, calId);
  } else if (payload.kind === 'allday_single') {
    var endExcl = addDaysSeoulYmd_(payload.startYmd.y, payload.startYmd.m, payload.startYmd.d, 1);
    var resourceS = {
      summary: payload.title,
      start: {
        date:
          payload.startYmd.y + '-' + pad2Cal_(payload.startYmd.m) + '-' + pad2Cal_(payload.startYmd.d),
      },
      end: { date: endExcl.y + '-' + pad2Cal_(endExcl.m) + '-' + pad2Cal_(endExcl.d) },
      reminders: buildAllDayReminderOverrides_(payload),
      colorId: COLOR_ID_ALLDAY_EVENT,
    };
    if (recur && recur.freq === 'WEEKLY') {
      resourceS.recurrence = ['RRULE:FREQ=WEEKLY;UNTIL=' + rruleUntilStr_(recur.until)];
    }
    Calendar.Events.insert(resourceS, calId);
  } else if (payload.kind === 'allday_range') {
    var eEx = addDaysSeoulYmd_(payload.endYmd.y, payload.endYmd.m, payload.endYmd.d, 1);
    var resourceR = {
      summary: payload.title,
      start: {
        date:
          payload.startYmd.y + '-' + pad2Cal_(payload.startYmd.m) + '-' + pad2Cal_(payload.startYmd.d),
      },
      end: { date: eEx.y + '-' + pad2Cal_(eEx.m) + '-' + pad2Cal_(eEx.d) },
      reminders: buildAllDayReminderOverrides_(payload),
      colorId: COLOR_ID_ALLDAY_EVENT,
    };
    Calendar.Events.insert(resourceR, calId);
  }
}

function payloadStartDate_(payload) {
  if (payload.kind === 'timed') return payload.start;
  if (payload.startYmd) return fromSeoul_(payload.startYmd.y, payload.startYmd.m, payload.startYmd.d, 0, 0);
  return null;
}

/**
 * @param {number} dayOffset 서울 기준 오늘으로부터 일 수
 */
function listAndFormatDay_(dayOffset, calendarAlias) {
  var f = seoulFields_(nowSeoul_());
  var ymd = addDaysSeoulYmd_(f.y, f.m, f.day, dayOffset);
  return formatDayEvents_(ymd.y, ymd.m, ymd.d, calendarAlias);
}

function listAndFormatYmd_(y, m, d, calendarAlias) {
  return formatDayEvents_(y, m, d, calendarAlias);
}

function formatDayEvents_(y, month, day, calendarAlias) {
  var lines = [];
  lines.push(
    '■ ' + y + '-' + pad2Cal_(month) + '-' + pad2Cal_(day) + ' 일정' + calendarLabelSuffix_(calendarAlias)
  );
  var eventLines = dayEventLines_(y, month, day, calendarAlias);
  for (var i = 0; i < eventLines.length; i++) lines.push(eventLines[i]);
  return lines.join('\n');
}

function listAndFormatNextWeek_(calendarAlias) {
  var f = seoulFields_(nowSeoul_());
  var mon = mondayOfWeekContainingYmd_(f.y, f.m, f.day);
  var start = addDaysSeoulYmd_(mon.y, mon.m, mon.d, 7);
  var end = addDaysSeoulYmd_(start.y, start.m, start.d, 6);
  var week = ['월', '화', '수', '목', '금', '토', '일'];
  var lines = [];

  lines.push(
    '■ 다음주 일정 (' +
      start.y +
      '-' +
      pad2Cal_(start.m) +
      '-' +
      pad2Cal_(start.d) +
      '~' +
      end.y +
      '-' +
      pad2Cal_(end.m) +
      '-' +
      pad2Cal_(end.d) +
      ')' +
      calendarLabelSuffix_(calendarAlias)
  );

  for (var i = 0; i < 7; i++) {
    var ymd = addDaysSeoulYmd_(start.y, start.m, start.d, i);
    lines.push('');
    lines.push('□ ' + pad2Cal_(ymd.m) + '-' + pad2Cal_(ymd.d) + ' (' + week[i] + ')');
    var evs = dayEventLines_(ymd.y, ymd.m, ymd.d, calendarAlias);
    for (var j = 0; j < evs.length; j++) lines.push(evs[j]);
  }

  return lines.join('\n');
}

function dayEventLines_(y, month, day, calendarAlias) {
  var calId = calendarIdForAlias_(calendarAlias);
  var timeMin = new Date(isoSeoul_(y, month, day, 0, 0)).toISOString();
  var nx = addDaysSeoulYmd_(y, month, day, 1);
  var timeMax = new Date(isoSeoul_(nx.y, nx.m, nx.d, 0, 0)).toISOString();
  var resp = Calendar.Events.list(calId, {
    timeMin: timeMin,
    timeMax: timeMax,
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 100,
  });

  var items = resp.items || [];
  var lines = [];

  for (var i = 0; i < items.length; i++) {
    var ev = items[i];
    lines.push(formatOneEventLine_(ev));
  }
  if (!lines.length) lines.push('(일정 없음)');
  return lines;
}

function calendarLabelSuffix_(calendarAlias) {
  return calendarAlias ? ' - ' + String(calendarAlias).trim() : '';
}

function formatOneEventLine_(ev) {
  var s = ev.start;
  if (s.date) {
    return '• 종일 ~ ' + (ev.summary || '(제목 없음)');
  }
  var st = s.dateTime || '';
  if (st) {
    var d = new Date(st);
    var hhmm = Utilities.formatDate(d, TZ_SEOUL, 'HH:mm');
    return '• ' + hhmm + ' ~ ' + (ev.summary || '(제목 없음)');
  }
  return '• ~ ' + (ev.summary || '(제목 없음)');
}

function dailyMorningSummaryPayload_() {
  return listAndFormatDay_(0);
}
