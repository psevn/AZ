import test from "node:test";
import assert from "node:assert/strict";
import { formatArabicCount } from "../src/lib/arabicPlural.mjs";

const taskForms = {
  zero: "لا مهام",
  one: "مهمة واحدة",
  two: "مهمتان",
  few: "مهام",
  many: "مهمة",
};

test("formats Arabic task counts across the cardinality rules", () => {
  assert.equal(formatArabicCount(0, taskForms), "لا مهام");
  assert.equal(formatArabicCount(1, taskForms), "مهمة واحدة");
  assert.equal(formatArabicCount(2, taskForms), "مهمتان");
  assert.equal(formatArabicCount(3, taskForms), "3 مهام");
  assert.equal(formatArabicCount(10, taskForms), "10 مهام");
  assert.equal(formatArabicCount(11, taskForms), "11 مهمة");
  assert.equal(formatArabicCount(21, taskForms), "21 مهمة");
});

test("clamps negative and fractional counts to safe whole numbers", () => {
  assert.equal(formatArabicCount(-1, taskForms), "لا مهام");
  assert.equal(formatArabicCount(2.9, taskForms), "مهمتان");
});
