/**
 * Google Calendar API v3 (Advanced Calendar Service)
 */

function calendarId_() {
  var id = getScriptProp_(PROP_CALENDAR_ID);
  return id || 'primary';
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
  if (!rules || !rules.length) return { useDefault: true, overrides: [] };
  var f = seoulFields_(start);
  var evMinutes = f.hh * 60 + f.mm;

  for (var i = 0; i < rules.length; i++) {
    var r = rules[i];
    if (r.kind === 'minutes') out.push({ method: 'popup', minutes: r.n });
    else if (r.kind === 'days_before') out.push({ method: 'popup', minutes: 24 * 60 * r.n });
    else if (r.kind === 'same_day_morning') {
      var tgt = r.hour * 60;
      var diff = evMinutes - tgt;
      if (diff > 0) out.push({ method: 'popup', minutes: diff });
      else if (diff === 0) out.push({ method: 'popup', minutes: 0 });
    }
  }
  if (out.length === 0) return { useDefault: true, overrides: [] };
  return { useDefault: false, overrides: out };
}

function buildRemindersAllDayDefault_() {
  return { useDefault: true, overrides: [] };
}

function rruleUntilStr_(untilYmd) {
  var endInst = fromSeoul_(untilYmd.y, untilYmd.m, untilYmd.d, 23, 59);
  return Utilities.formatDate(endInst, 'UTC', "yyyyMMdd'T'HHmmss'Z'");
}

/**
 * @param {Object} payload from parseRegistrationLine_
 */
function insertRegistration_(payload) {
  var calId = calendarId_();
  var recur = payload.recurrence;

  if (payload.kind === 'timed') {
    var reminders = buildReminderOverrides_(payload.start, payload.reminderRules);
    var resource = {
      summary: payload.title,
      start: { dateTime: isoSeoulFromDate_(payload.start), timeZone: TZ_SEOUL },
      end: { dateTime: isoSeoulFromDate_(payload.end), timeZone: TZ_SEOUL },
      reminders: reminders,
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
      reminders: buildRemindersAllDayDefault_(),
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
      reminders: buildRemindersAllDayDefault_(),
    };
    Calendar.Events.insert(resourceR, calId);
  }

  addSupplementalAlerts_(calId, payload);
}

/**
 * 종일 일정은 리마인더 시각 지정이 API상 까다로워, 필요 시 짧은 알림 일정을 추가한다.
 */
function addSupplementalAlerts_(calId, payload) {
  if (payload.alertEvents && payload.alertEvents.length) {
    for (var i = 0; i < payload.alertEvents.length; i++) {
      var a = payload.alertEvents[i];
      insertShortPopup_(
        calId,
        '[알림] ' + payload.title,
        fromSeoul_(a.y, a.m, a.d, a.hour, a.minute || 0)
      );
    }
    return;
  }

  var rules = payload.reminderRules || [];
  var wantMorning = false;
  for (var j = 0; j < rules.length; j++) {
    if (rules[j].kind === 'same_day_morning') wantMorning = true;
  }
  if (!wantMorning) return;

  if (payload.kind === 'allday_single' && payload.startYmd) {
    insertShortPopup_(
      calId,
      '[알림·오전] ' + payload.title,
      fromSeoul_(payload.startYmd.y, payload.startYmd.m, payload.startYmd.d, 9, 0)
    );
  } else if (payload.kind === 'allday_range' && payload.startYmd) {
    insertShortPopup_(
      calId,
      '[알림·오전] ' + payload.title,
      fromSeoul_(payload.startYmd.y, payload.startYmd.m, payload.startYmd.d, 9, 0)
    );
  }
}

function insertShortPopup_(calId, summary, startDt) {
  var en = new Date(startDt.getTime() + 15 * 60 * 1000);
  Calendar.Events.insert(
    {
      summary: summary,
      start: { dateTime: isoSeoulFromDate_(startDt), timeZone: TZ_SEOUL },
      end: { dateTime: isoSeoulFromDate_(en), timeZone: TZ_SEOUL },
      reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 0 }] },
    },
    calId
  );
}

/**
 * @param {number} dayOffset 서울 기준 오늘으로부터 일 수
 */
function listAndFormatDay_(dayOffset) {
  var f = seoulFields_(nowSeoul_());
  var ymd = addDaysSeoulYmd_(f.y, f.m, f.day, dayOffset);
  return formatDayEvents_(ymd.y, ymd.m, ymd.d);
}

function listAndFormatYmd_(y, m, d) {
  return formatDayEvents_(y, m, d);
}

function formatDayEvents_(y, month, day) {
  var calId = calendarId_();
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
  lines.push(
    '■ ' + y + '-' + pad2Cal_(month) + '-' + pad2Cal_(day) + ' 일정'
  );

  if (!items.length) {
    lines.push('(일정 없음)');
    return lines.join('\n');
  }

  for (var i = 0; i < items.length; i++) {
    var ev = items[i];
    if (ev.summary && ev.summary.indexOf('[알림') === 0) continue;
    lines.push(formatOneEventLine_(ev));
  }
  if (lines.length === 1) lines.push('(일정 없음)');
  return lines.join('\n');
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
