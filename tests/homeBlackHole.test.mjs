import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const app = readFileSync(resolve(root, "src/App.tsx"), "utf8");
const styles = readFileSync(resolve(root, "src/styles.css"), "utf8");

test("the black hole composition is mounted only in the Home universe visual", () => {
  const homeSection = app.indexOf('section==="home" &&');
  const visual = app.indexOf('<div className="home-universe-visual"');
  const blackHole = app.indexOf('<div className="home-black-hole">');
  assert.ok(homeSection >= 0 && visual > homeSection && blackHole > visual);
  assert.equal((app.match(/className="home-black-hole"/g) ?? []).length, 1);
  assert.match(app, /black-hole-disk black-hole-disk-back/);
  assert.match(app, /black-hole-disk black-hole-disk-front/);
  assert.match(app, /black-hole-photon-ring/);
});

test("the accretion disk has restrained motion and respects reduced-motion", () => {
  assert.match(styles, /@keyframes black-hole-disk-turn/);
  assert.match(styles, /@media \(prefers-reduced-motion:no-preference\)[\s\S]*?\.black-hole-disk \{ animation:black-hole-disk-turn/);
  assert.match(styles, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.black-hole-disk,[\s\S]*?\.black-hole-aura,[\s\S]*?animation: none !important/);
});

test("the black hole remains responsive on compact screens", () => {
  assert.match(styles, /@media \(max-width:680px\)[\s\S]*?\.home-universe-visual \.home-black-hole \{ transform:scale\(\.82\); \}/);
});
