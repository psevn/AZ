import test from "node:test";
import assert from "node:assert/strict";
import { parseQuickAdd } from "../src/lib/quickAdd.mjs";
import { qatarDateKey, addCalendarDays, qatarDateTimeToIso, qatarWeekday, formatQatarDate } from "../src/lib/qatarTime.mjs";

const now = new Date("2026-11-09T09:00:00.000Z"); // 12:00 in Qatar
const subjects = [
  { id: "math-id", name: "رياضيات" },
  { id: "bio-id", name: "Biology" },
  { id: "calc-id", name: "Math" },
  { id: "econ-id", name: "Économics" },
  { id: "arabic-id", name: "الإحصاء" },
  { id: "school-id", name: "مدرسة" },
  { id: "boy-id", name: "فتى" },
];

test("Arabic date, subject, high priority, duration", () => {
  assert.deepEqual(parseQuickAdd("مراجعة الفصل غداً #رياضيات !1 45د", subjects, now),
    { title: "مراجعة الفصل", subjectId: "math-id", dueDate: "2026-11-10", estMinutes: 45, priority: 3, priorityToken: "!1", priorityNotice: false });
});
test("English and mixed language input", () => {
  const result = parseQuickAdd("Econ quiz review tomorrow #Biology !1 45m", subjects, now);
  assert.equal(result.title, "Econ quiz review");
  assert.equal(result.subjectId, "bio-id");
  assert.equal(result.dueDate, "2026-11-10");
  assert.equal(result.priority, 3);
  assert.equal(result.estMinutes, 45);
});
test("Arabic spelling variants and diacritic-insensitive subjects", () => {
  assert.equal(parseQuickAdd("مراجعة غدا #الاحصاء", subjects, now).subjectId, "arabic-id");
  assert.equal(parseQuickAdd("مراجعة #مدرسه", subjects, now).subjectId, "school-id");
  assert.equal(parseQuickAdd("مراجعة #فتي", subjects, now).subjectId, "boy-id");
  assert.equal(parseQuickAdd("Review #economics", subjects, now).subjectId, "econ-id");
  assert.equal(parseQuickAdd("Review بكرة", subjects, now).dueDate, "2026-11-10");
});
test("Arabic-Indic digits work in dates, priorities, and durations", () => {
  const result = parseQuickAdd("حل الواجب غداً !١ ٤٥د", subjects, now);
  assert.equal(result.dueDate, "2026-11-10");
  assert.equal(result.priority, 3);
  assert.equal(result.estMinutes, 45);
});
test("English weekday names and next weekday", () => {
  assert.equal(parseQuickAdd("Review Thursday", [], now).dueDate, "2026-11-12");
  assert.equal(parseQuickAdd("Review next Sunday", [], now).dueDate, "2026-11-15");
});
test("Arabic weekdays and next week phrase", () => {
  assert.equal(parseQuickAdd("مراجعة الخميس", [], now).dueDate, "2026-11-12");
  assert.equal(parseQuickAdd("مراجعة الأسبوع القادم", [], now).dueDate, "2026-11-15");
});
test("English and Arabic explicit month dates", () => {
  assert.equal(parseQuickAdd("Submit on 15 Nov", [], now).dueDate, "2026-11-15");
  assert.equal(parseQuickAdd("Submit Nov 15", [], now).dueDate, "2026-11-15");
  assert.equal(parseQuickAdd("تسليم ١٥ نوفمبر", [], now).dueDate, "2026-11-15");
});
test("Day after tomorrow in both languages", () => {
  assert.equal(parseQuickAdd("Submit day after tomorrow", [], now).dueDate, "2026-11-11");
  assert.equal(parseQuickAdd("التسليم بعد غد", [], now).dueDate, "2026-11-11");
});
test("Duration formats: minutes, hours, decimal hours, Arabic hour", () => {
  assert.equal(parseQuickAdd("Review 45min", [], now).estMinutes, 45);
  assert.equal(parseQuickAdd("Review 1h", [], now).estMinutes, 60);
  assert.equal(parseQuickAdd("Review 1.5h", [], now).estMinutes, 90);
  assert.equal(parseQuickAdd("Review ساعة", [], now).estMinutes, 60);
});
test("Priority !4+ clamps to low and keeps the warning", () => {
  const result = parseQuickAdd("Review !9", [], now);
  assert.equal(result.priority, 1);
  assert.equal(result.priorityToken, "!3");
  assert.equal(result.priorityNotice, true);
  assert.equal(result.title, "Review");
});
test("Unknown subjects and unmatched text are never removed", () => {
  const result = parseQuickAdd("Review #Unknown after lab", subjects, now);
  assert.equal(result.title, "Review #Unknown after lab");
  assert.equal(result.subjectId, null);
});
test("Invalid dates and priorities remain in the title", () => {
  assert.equal(parseQuickAdd("Review 32 November !0", [], now).title, "Review 32 November !0");
});
test("Parser does not throw for fuzz-like inputs and never loses unparsed text", () => {
  const samples = ["", null, undefined, "🪐", "###", "!999999999999999999999", "1.5h", "15 نوفمبر", "غَدًا", "abc\u0000def", "{[()]}", "ا".repeat(2000)];
  for (const sample of samples) {
    assert.doesNotThrow(() => parseQuickAdd(sample, subjects, now));
    const result = parseQuickAdd(sample, subjects, now);
    assert.equal(typeof result.title, "string");
    assert.ok(result.title.length <= String(sample ?? "").length);
  }
});

test("Qatar date uses UTC+3 at the UTC day boundary", () => {
  const instant = new Date("2026-11-15T22:30:00.000Z");
  assert.equal(qatarDateKey(instant), "2026-11-16");
});
test("Qatar date-only end-of-day is stored as the intended UTC instant", () => {
  assert.equal(qatarDateTimeToIso("2026-11-16", 23, 59), "2026-11-16T20:59:00.000Z");
  assert.equal(qatarDateKey(new Date(qatarDateTimeToIso("2026-11-16", 23, 59))), "2026-11-16");
});
test("Qatar calendar math is host-timezone independent", () => {
  assert.equal(addCalendarDays("2026-11-15", 1), "2026-11-16");
  assert.equal(qatarWeekday("2026-11-15"), 0);
});

test("Qatar date formatting keeps the calendar day and Western digits", () => {
  assert.equal(formatQatarDate("2026-11-16", "en-GB", { weekday: "long", day: "numeric", month: "long" }), "Monday 16 November");
  assert.match(formatQatarDate("2026-11-16", "ar-QA", { day: "numeric", month: "long" }), /16/u);
});
