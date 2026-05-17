/**
 * 서울(Asia/Seoul) 기준 날짜·시간. format 패턴 'u' = 주 번호(월=1…일=7, ISO).
 */
var TZ_SEOUL = 'Asia/Seoul';

function pad2_(n) {
  return n < 10 ? '0' + n : '' + n;
}

/** KST 벽시각 → Date 인스턴스 */
function fromSeoul_(y, month, day, hour, minute) {
  return new Date(
    y + '-' + pad2_(month) + '-' + pad2_(day) + 'T' + pad2_(hour) + ':' + pad2_(minute) + ':00+09:00'
  );
}

function seoulFields_(d) {
  var s = Utilities.formatDate(d, TZ_SEOUL, 'yyyy:MM:dd:HH:mm').split(':');
  return {
    y: Number(s[0]),
    m: Number(s[1]),
    day: Number(s[2]),
    hh: Number(s[3]),
    mm: Number(s[4]),
  };
}

function nowSeoul_() {
  return new Date();
}

function startOfDaySeoulFromFields_(f) {
  return fromSeoul_(f.y, f.m, f.day, 0, 0);
}

function startOfDaySeoul_(d) {
  return startOfDaySeoulFromFields_(seoulFields_(d));
}

function endOfDaySeoul_(d) {
  var f = seoulFields_(d);
  return fromSeoul_(f.y, f.m, f.day, 23, 59);
}

/** yyyy-MM-dd 문자열 간 날짜 가감 (일 단위, 서울 달력) */
function addDaysSeoulYmd_(y, m, day, deltaDays) {
  var mid = fromSeoul_(y, m, day, 12, 0);
  var next = new Date(mid.getTime() + deltaDays * 24 * 60 * 60 * 1000);
  var s = Utilities.formatDate(next, TZ_SEOUL, 'yyyy-MM-dd').split('-').map(Number);
  return { y: s[0], m: s[1], d: s[2] };
}

/** 1=월 … 7=일 (ISO), 파싱 실패 시 월요일 가정 */
function isoWeekdayMon1Sun7_(y, m, day) {
  var cur = fromSeoul_(y, m, day, 12, 0);
  var u = parseInt(Utilities.formatDate(cur, TZ_SEOUL, 'u'), 10);
  if (!isNaN(u) && u >= 1 && u <= 7) return u;
  var label = Utilities.formatDate(cur, TZ_SEOUL, 'EEEE');
  var mapEn = {
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
    Sunday: 7,
  };
  if (mapEn[label]) return mapEn[label];
  var mapKo = {
    월요일: 1,
    화요일: 2,
    수요일: 3,
    목요일: 4,
    금요일: 5,
    토요일: 6,
    일요일: 7,
  };
  return mapKo[label] || 1;
}

/** 해당 날짜가 속한 주의 월요일 0시(KST) */
function mondayOfWeekContainingYmd_(y, m, day) {
  var u = isoWeekdayMon1Sun7_(y, m, day);
  return addDaysSeoulYmd_(y, m, day, -(u - 1));
}

/** 차주 요일 날짜 0시 (KST) — weekday: '월'…'일' */
function nextWeekKoreanWeekdayYmd_(weekdayChar, refDate) {
  var f = seoulFields_(refDate || nowSeoul_());
  var mon = mondayOfWeekContainingYmd_(f.y, f.m, f.day);
  var nextMon = addDaysSeoulYmd_(mon.y, mon.m, mon.d, 7);
  var off = koreanWeekdayFromMonday_(weekdayChar);
  return addDaysSeoulYmd_(nextMon.y, nextMon.m, nextMon.d, off);
}

/** 월요일=0 … 일요일=6 */
function koreanWeekdayFromMonday_(ch) {
  var map = { 월: 0, 화: 1, 수: 2, 목: 3, 금: 4, 토: 5, 일: 6 };
  var v = map[ch];
  return v === undefined ? 0 : v;
}

/**
 * M.D 가 올해보다 과거(날짜만 비교)이면 내년 — 조회 명령(예: 6.20 일정) 등에만 사용
 */
function resolveYearForMonthDay_(month, day, refDate) {
  var r = seoulFields_(refDate || nowSeoul_());
  var y = r.y;
  var cand = fromSeoul_(y, month, day, 0, 0);
  var today0 = startOfDaySeoul_(refDate || nowSeoul_());
  if (cand.getTime() < today0.getTime()) return y + 1;
  return y;
}

/**
 * 일정 등록용 M.D: 올해만. 해당일 0시가 오늘 0시보다 이전이면 불가(PROJECT_CONTEXT.md).
 * @returns {{y:number,m:number,d:number}|null}
 */
function yearMonthDayForRegistration_(month, day, refDate) {
  var y = seoulFields_(refDate || nowSeoul_()).y;
  var today0 = startOfDaySeoul_(refDate || nowSeoul_());
  var cand0 = fromSeoul_(y, month, day, 0, 0);
  if (cand0.getTime() < today0.getTime()) return null;
  return { y: y, m: month, d: day };
}

/**
 * 기간 등록 M.D~M.D: 시작은 올해·첫날 0시 기준 오늘 이상만. 끝이 시작보다 달력상 앞이면 종료 연도 +1.
 * @returns {{ok:true,startYmd:Object,endYmd:Object}|{ok:false,reason:string}}
 */
function resolveRangeRegistrationYmd_(m1, d1, m2, d2, refDate) {
  var y = seoulFields_(refDate || nowSeoul_()).y;
  var today0 = startOfDaySeoul_(refDate || nowSeoul_());
  var start0 = fromSeoul_(y, m1, d1, 0, 0);
  if (start0.getTime() < today0.getTime()) return { ok: false, reason: 'past' };

  var ye = y;
  if (m2 < m1 || (m2 === m1 && d2 < d1)) ye = y + 1;
  var end0 = fromSeoul_(ye, m2, d2, 0, 0);
  if (end0.getTime() < start0.getTime()) return { ok: false, reason: 'invalid' };

  return {
    ok: true,
    startYmd: { y: y, m: m1, d: d1 },
    endYmd: { y: ye, m: m2, d: d2 },
  };
}

/** 2~4자리 연도 → 전체 연도 */
function normalizeYear_(yy) {
  if (yy >= 100) return yy;
  return yy + 2000;
}
