import test from "node:test";
import assert from "node:assert/strict";
import { getUploadTokenExpiryDecision } from "../supabase/functions/_shared/uploadTokenExpiry.mjs";

const FIVE_MINUTES = 5 * 60 * 1000;

test("a null expiry is safe only when the database explicitly reports no issued token", () => {
  assert.deepEqual(getUploadTokenExpiryDecision(null, 1_000_000), { kind: "ready" });
});

test("a valid token expiry waits through the five-minute clock-skew margin", () => {
  const now = Date.parse("2026-11-15T20:00:00.000Z");
  const expiry = new Date(now + 60_000).toISOString();
  assert.deepEqual(getUploadTokenExpiryDecision(expiry, now, FIVE_MINUTES), {
    kind: "wait",
    retryAfterSeconds: 360,
  });
});

test("PostgreSQL-style timezone offsets are accepted", () => {
  const now = Date.parse("2026-11-15T20:00:00.000Z");
  assert.deepEqual(
    getUploadTokenExpiryDecision("2026-11-15T23:00:00+03:00", now, FIVE_MINUTES),
    { kind: "wait", retryAfterSeconds: 300 },
  );
});

test("an expiry inside the clock-skew margin still waits", () => {
  const now = Date.parse("2026-11-15T20:00:00.000Z");
  const expiry = new Date(now - 4 * 60_000).toISOString();
  assert.deepEqual(getUploadTokenExpiryDecision(expiry, now, FIVE_MINUTES), {
    kind: "wait",
    retryAfterSeconds: 60,
  });
});

test("an expiry older than the full safety margin is ready for cleanup", () => {
  const now = Date.parse("2026-11-15T20:00:00.000Z");
  const expiry = new Date(now - 6 * 60_000).toISOString();
  assert.deepEqual(getUploadTokenExpiryDecision(expiry, now, FIVE_MINUTES), {
    kind: "ready",
  });
});

test("missing, malformed, and wrongly typed expiry values fail closed", () => {
  const now = Date.parse("2026-11-15T20:00:00.000Z");
  for (const value of [undefined, "", "not-a-date", "0", "2026-11-15", " 2026-11-15T20:00:00Z ", 1_800_000_000, {}, false]) {
    assert.deepEqual(
      getUploadTokenExpiryDecision(value, now, FIVE_MINUTES),
      { kind: "invalid" },
      `expected ${String(value)} to fail closed`,
    );
  }
});

test("invalid timing configuration fails closed", () => {
  assert.deepEqual(getUploadTokenExpiryDecision(null, Number.NaN), { kind: "invalid" });
  assert.deepEqual(getUploadTokenExpiryDecision(null, 1_000, -1), { kind: "invalid" });
});

test("impossible calendar dates and out-of-range clock fields fail closed", () => {
  const now = Date.parse("2026-11-15T20:00:00.000Z");
  const invalidValues = [
    "2026-02-30T20:00:00Z",
    "2026-11-31T20:00:00Z",
    "2025-02-29T20:00:00Z",
    "2026-11-15T24:00:00Z",
    "2026-11-15T20:60:00Z",
    "2026-11-15T20:00:60Z",
    "2026-11-15T20:00:00+24:00",
    "2026-11-15T20:00:00+03:60",
  ];

  for (const value of invalidValues) {
    assert.deepEqual(
      getUploadTokenExpiryDecision(value, now, FIVE_MINUTES),
      { kind: "invalid" },
      `expected impossible timestamp ${value} to fail closed`,
    );
  }
});

test("a real leap-day timestamp remains valid", () => {
  const now = Date.parse("2024-02-28T20:00:00.000Z");
  assert.deepEqual(
    getUploadTokenExpiryDecision("2024-02-29T20:00:00Z", now, FIVE_MINUTES),
    { kind: "wait", retryAfterSeconds: 24 * 60 * 60 + 5 * 60 },
  );
});
