import { qatarDateKey, addCalendarDays, qatarWeekday } from "./qatarTime.mjs";

const WEEKDAYS = new Map([
  ["sun",0],["sunday",0],["mon",1],["monday",1],["tue",2],["tues",2],["tuesday",2],
  ["wed",3],["wednesday",3],["thu",4],["thur",4],["thurs",4],["thursday",4],
  ["fri",5],["friday",5],["sat",6],["saturday",6],
  ["الاحد",0],["الاثنين",1],["الثلاثاء",2],["الاربعاء",3],["الخميس",4],["الجمعه",5],["السبت",6],
]);
const MONTHS = new Map([
  ["jan",0],["january",0],["feb",1],["february",1],["mar",2],["march",2],["apr",3],["april",3],
  ["may",4],["jun",5],["june",5],["jul",6],["july",6],["aug",7],["august",7],["sep",8],
  ["sept",8],["september",8],["oct",9],["october",9],["nov",10],["november",10],["dec",11],["december",11],
  ["يناير",0],["فبراير",1],["مارس",2],["ابريل",3],["مايو",4],["يونيو",5],["يوليو",6],
  ["اغسطس",7],["سبتمبر",8],["اكتوبر",9],["نوفمبر",10],["ديسمبر",11],
]);
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

function normalizeWithMap(input) {
  let value = "";
  const starts = [], ends = [];
  let offset = 0;
  for (const character of input) {
    const length = character.length;
    let normalized = character.normalize("NFD").replace(/[\u0300-\u036f\u064b-\u065f\u0670\u06d6-\u06ed]/gu, "");
    normalized = normalized
      .replace(/[أإآٱ]/gu, "ا")
      .replace(/ة/gu, "ه")
      .replace(/ى/gu, "ي")
      .replace(/[٠-٩]/gu, digit => String(ARABIC_DIGITS.indexOf(digit)))
      .toLocaleLowerCase();
    if (!normalized && /[\\u0300-\\u036f\\u064b-\\u065f\\u0670\\u06d6-\\u06ed]/u.test(character) && ends.length) {
      ends[ends.length - 1] = offset + length;
    }
    for (const part of normalized) {
      value += part;
      starts.push(offset);
      ends.push(offset + length);
    }
    offset += length;
  }
  return { value, starts, ends };
}
const normalizeName = value => normalizeWithMap(String(value ?? "").trim()).value;
const dateFromParts = (year, month, day) => {
  const date = new Date(Date.UTC(year, month, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
};
const getDateMatch = (normalized, pattern) => {
  const match = pattern.exec(normalized.value);
  if (!match) return null;
  const group = match[1] ?? match[0];
  const relativeStart = match[1] ? match[0].indexOf(group) : 0;
  const startIndex = match.index + relativeStart;
  const endIndex = startIndex + group.length;
  return {
    token: normalized.value.slice(startIndex, endIndex),
    start: normalized.starts[startIndex] ?? 0,
    end: normalized.ends[endIndex - 1] ?? 0,
    match,
    normalizedStart: startIndex,
    normalizedEnd: endIndex,
  };
};
const weekdayOffset = (target, today, forceNext) => {
  let offset = (target - qatarWeekday(today) + 7) % 7;
  if (forceNext && offset === 0) offset = 7;
  return offset;
};

function extractDate(source, now) {
  const normalized = normalizeWithMap(source);
  const today = qatarDateKey(now);
  const [year, month, day] = today.split("-").map(Number);
  const relatives = [
    { regex: /\b(?:day\s+after\s+tomorrow|after\s+tomorrow)\b/u, offset: 2 },
    { regex: /بعد\s+(?:غد(?:ا)?|بكره)/u, offset: 2 },
    { regex: /\b(?:today)\b|اليوم/u, offset: 0 },
    { regex: /\b(?:tomorrow)\b|غدا|بكره/u, offset: 1 },
  ];
  for (const relative of relatives) {
    const found = getDateMatch(normalized, relative.regex);
    if (found) return { date: addCalendarDays(today, relative.offset), start: found.start, end: found.end };
  }

  const nextWeek = getDateMatch(normalized, /الاسبوع\s+القادم/u);
  if (nextWeek) {
    const offset = weekdayOffset(0, today, true);
    return { date: addCalendarDays(today, offset), start: nextWeek.start, end: nextWeek.end };
  }

  const explicitDates = [
    /(?<![\p{L}\d])(\d{1,2})\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|يناير|فبراير|مارس|ابريل|مايو|يونيو|يوليو|اغسطس|سبتمبر|اكتوبر|نوفمبر|ديسمبر)(?![\p{L}])/u,
    /(?<![\p{L}\d])(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|يناير|فبراير|مارس|ابريل|مايو|يونيو|يوليو|اغسطس|سبتمبر|اكتوبر|نوفمبر|ديسمبر)\s+(\d{1,2})(?![\p{L}\d])/u,
  ];
  for (let i = 0; i < explicitDates.length; i++) {
    const match = explicitDates[i].exec(normalized.value);
    if (!match) continue;
    const dayNumber = Number(i === 0 ? match[1] : match[2]);
    const monthName = i === 0 ? match[2] : match[1];
    const monthNumber = MONTHS.get(monthName);
    if (!Number.isInteger(dayNumber) || monthNumber === undefined) continue;
    let result = dateFromParts(year, monthNumber, dayNumber);
    if (!result) continue;
    if (result < today) result = dateFromParts(year + 1, monthNumber, dayNumber);
    const startIndex = match.index;
    const endIndex = startIndex + match[0].length;
    return { date: result, start: normalized.starts[startIndex] ?? 0, end: normalized.ends[endIndex - 1] ?? 0 };
  }

  const englishDays = [...WEEKDAYS.keys()].filter(name => /^[a-z]/u.test(name)).sort((a,b)=>b.length-a.length);
  const arabicDays = [...WEEKDAYS.keys()].filter(name => /^[\u0600-\u06ff]/u.test(name)).sort((a,b)=>b.length-a.length);
  for (const name of englishDays) {
    const escaped = name.replace(/[.*+?^\u0024{}()|[\]\\]/gu, "\\$&");
    const found = getDateMatch(normalized, new RegExp("(?<![\\p{L}])((?:(?:next|this|on)\\s+)?"+escaped+")(?![\\p{L}])", "u"));
    if (!found) continue;
    const target = WEEKDAYS.get(name);
    const forceNext = found.token.startsWith("next ");
    return { date: addCalendarDays(today, weekdayOffset(target, today, forceNext)), start: found.start, end: found.end };
  }
  for (const name of arabicDays) {
    const escaped = name.replace(/[.*+?^\u0024{}()|[\]\\]/gu, "\\$&");
    const match = new RegExp("(?<![\\p{L}])(" + escaped + ")(?:\\s+(القادم))?(?![\\p{L}])", "u").exec(normalized.value);
    if (!match) continue;
    const startIndex = match.index;
    const endIndex = startIndex + match[0].length;
    return {
      date: addCalendarDays(today, weekdayOffset(WEEKDAYS.get(name), today, Boolean(match[2]))),
      start: normalized.starts[startIndex] ?? 0,
      end: normalized.ends[endIndex - 1] ?? 0,
    };
  }
  return null;
}

function stripRanges(source, ranges) {
  let result = source;
  for (const range of ranges.sort((a,b)=>b.start-a.start)) result = result.slice(0, range.start) + " " + result.slice(range.end);
  return result.replace(/\s+/gu, " ").replace(/\s+([،,.;])/gu, "$1").trim();
}

/** Stored priority values: 3 = high, 2 = medium, 1 = low. Tokens !1/!2/!3 map high/medium/low. */
export function parseQuickAdd(input, subjects = [], now = new Date()) {
  const original = String(input ?? "");
  try {
    const normalized = normalizeWithMap(original);
    const ranges = [];
    let subjectId = null;
    const subjectMatch = /#([^\s#]+)/u.exec(original);
    if (subjectMatch) {
      const wanted = normalizeName(subjectMatch[1]);
      const subject = subjects.find(item => normalizeName(item?.name) === wanted);
      if (subject) {
        subjectId = subject.id;
        ranges.push({ start: subjectMatch.index, end: subjectMatch.index + subjectMatch[0].length });
      }
    }

    let priority = 2, priorityToken = "!2", priorityNotice = false;
    const priorityMatch = /!(\d+)\+?/u.exec(normalized.value);
    if (priorityMatch) {
      const rank = Number(priorityMatch[1]);
      const start = normalized.starts[priorityMatch.index] ?? 0;
      const end = normalized.ends[priorityMatch.index + priorityMatch[0].length - 1] ?? start;
      if (rank >= 1) {
        const normalizedRank = Math.min(rank, 3);
        priority = 4 - normalizedRank;
        priorityToken = "!" + normalizedRank;
        priorityNotice = rank > 3;
        ranges.push({ start, end });
      }
    }

    let estMinutes = 45;
    const durationMatch = /(?:(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m|دقيقه|دقائق|د|ساعه|ساعات))|(?<![\p{L}])(ساعه)(?![\p{L}])/u.exec(normalized.value);
    if (durationMatch) {
      const amount = durationMatch[1] ? Number(durationMatch[1]) : 1;
      const unit = durationMatch[2] ?? durationMatch[3];
      estMinutes = Math.min(600, Math.max(5, Math.round(amount * (unit.startsWith("h") || unit.startsWith("س") ? 60 : 1))));
      const start = normalized.starts[durationMatch.index] ?? 0;
      const end = normalized.ends[durationMatch.index + durationMatch[0].length - 1] ?? start;
      ranges.push({ start, end });
    }

    const parsedDate = extractDate(original, now);
    if (parsedDate) ranges.push({ start: parsedDate.start, end: parsedDate.end });

    return {
      title: stripRanges(original, ranges),
      subjectId,
      dueDate: parsedDate?.date ?? null,
      estMinutes,
      priority,
      priorityToken,
      priorityNotice,
    };
  } catch {
    return { title: original.trim(), subjectId: null, dueDate: null, estMinutes: 45, priority: 2, priorityToken: "!2", priorityNotice: false };
  }
}
