import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const motionSpec = readFileSync(new URL("../docs/MOTION_SYSTEM.md", import.meta.url), "utf8");
const experienceSpec = readFileSync(new URL("../docs/WEB_EXPERIENCE_SPEC.md", import.meta.url), "utf8");

test("shared motion tokens define a restrained and consistent timing scale", () => {
  assert.match(styles, /--motion-duration-feedback:\s*120ms/);
  assert.match(styles, /--motion-duration-micro:\s*160ms/);
  assert.match(styles, /--motion-duration-standard:\s*220ms/);
  assert.match(styles, /--motion-duration-emphasis:\s*280ms/);
  assert.match(styles, /--motion-ease-standard:/);
  assert.match(styles, /--motion-ease-enter:/);
  assert.match(styles, /--motion-ease-exit:/);
});

test("shared controls consume motion tokens instead of arbitrary common timings", () => {
  assert.match(styles, /\.quiet-button, \.icon-button[\s\S]*?var\(--motion-duration-micro\)/);
  assert.match(styles, /\.primary-button[\s\S]*?var\(--motion-duration-micro\)/);
  assert.match(styles, /\.workspace-nav button[\s\S]*?var\(--motion-duration-micro\)/);
  assert.match(styles, /\.document-upload-dropzone[\s\S]*?var\(--motion-duration-micro\)/);
});

test("reduced-motion preference disables animation and transitions globally", () => {
  assert.match(styles, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\*[\s\S]*?animation:\s*none\s*!important/);
  assert.match(styles, /transition:\s*none\s*!important/);
  assert.match(styles, /scroll-behavior:\s*auto\s*!important/);
});

test("motion specification protects focus, truthful progress, and task-specific intensity", () => {
  assert.match(motionSpec, /Never simulate upload or AI progress/);
  assert.match(motionSpec, /Focus:\*\*\s*static and distraction-free/);
  assert.match(motionSpec, /keyboard, touch, and visible focus/);
  assert.match(experienceSpec, /Motion foundation/);
  assert.match(experienceSpec, /global reduced-motion fallback/);
});
