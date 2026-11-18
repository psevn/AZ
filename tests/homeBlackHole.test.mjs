import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const app = readFileSync(resolve(root, "src/App.tsx"), "utf8");
const focus = readFileSync(resolve(root, "src/components/FocusUniverse.tsx"), "utf8");
const styles = readFileSync(resolve(root, "src/styles.css"), "utf8");

test("the black hole is exclusive to the Focus Universe, not the Home hero", () => {
  const homeVisualStart = app.indexOf('<div className="home-universe-visual"');
  const homeVisualEnd = app.indexOf("</section>", homeVisualStart);
  const homeVisual = app.slice(homeVisualStart, homeVisualEnd);
  assert.ok(homeVisualStart >= 0 && homeVisualEnd > homeVisualStart);
  assert.doesNotMatch(homeVisual, /home-black-hole|black-hole-core|black-hole-disk/);
  assert.match(focus, /className="focus-black-hole"/);
  assert.match(focus, /is-active/);
  assert.match(focus, /black-hole-disk black-hole-disk-back/);
  assert.match(focus, /black-hole-disk black-hole-disk-front/);
  assert.match(focus, /black-hole-photon-ring/);
});

test("Focus Universe presents elapsed time, the selected subject, and working session controls", () => {
  assert.match(focus, /className="focus-timer-display"/);
  assert.match(app, /focusSessionStartedAt!==null\) && <><div className="ambient ambient-one"\/>/);
  assert.match(focus, /className="focus-subject-name"/);
  assert.match(focus, /onPause/);
  assert.match(focus, /onResume/);
  assert.match(focus, /onEnd/);
  assert.match(focus, /requestFullscreen/);
  assert.match(focus, /exitFullscreen/);
});

test("the cosmic focus scene is responsive and respects reduced motion", () => {
  assert.match(styles, /\.focus-universe \{/);
  assert.match(styles, /\.focus-black-hole \{/);
  assert.match(styles, /\.focus-universe\.is-active \.focus-cosmos \{ opacity:1; \}/);
  assert.match(styles, /@keyframes focus-star-twinkle/);
  assert.match(styles, /@media \(max-width:680px\)[\s\S]*?\.focus-black-hole/);
  assert.match(styles, /@media \(prefers-reduced-motion:reduce\)[\s\S]*?\.focus-starfield-a[\s\S]*?animation:none !important/);
  assert.match(styles, /\.app-shell\.is-focus-mode \.workspace-rail/);
});
