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
  for (const value of [undefined, "", "not-a-date", 1_800_000_000, {}, false]) {
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

