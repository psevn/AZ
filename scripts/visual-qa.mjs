// Visual QA: renders every main section of the built app (demo mode) and saves screenshots + a JSON report.
// Usage: node scripts/visual-qa.mjs <baseUrl> <outDir>   (Playwright is installed by the workflow, not a dependency)
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

const base = process.argv[2] ?? "http://127.0.0.1:4173";
const out = process.argv[3] ?? "visual-qa-output";
await mkdir(out, { recursive: true });

const viewports = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};
const runs = [];
for (const lang of ["en", "ar"]) for (const theme of ["dark", "light"]) runs.push({ vp: "desktop", lang, theme, bg: "plain" });
runs.push({ vp: "desktop", lang: "en", theme: "dark", bg: "universe" });
runs.push({ vp: "desktop", lang: "ar", theme: "dark", bg: "universe" });
for (const lang of ["en", "ar"]) for (const theme of ["dark", "light"]) runs.push({ vp: "mobile", lang, theme, bg: "plain" });

const names = ["home", "planning", "az", "me"];
const report = { base, startedAt: new Date().toISOString(), shots: [], problems: [] };
const browser = await chromium.launch();

for (const r of runs) {
  const ctx = await browser.newContext({ viewport: viewports[r.vp], deviceScaleFactor: 1, locale: r.lang === "ar" ? "ar-QA" : "en-US", timezoneId: "Asia/Qatar" });
  await ctx.addInitScript(([lang, theme, bg]) => {
    try {
      localStorage.setItem("az-language", lang);
      localStorage.setItem("az-theme", theme);
      localStorage.setItem("az-background", bg);
    } catch {}
  }, [r.lang, r.theme, r.bg]);
  const page = await ctx.newPage();
  const tag = `${r.vp}-${r.lang}-${r.theme}-${r.bg}`;
  page.on("pageerror", (e) => report.problems.push({ tag, kind: "pageerror", message: String(e).slice(0, 300) }));
  page.on("console", (m) => { if (m.type() === "error") report.problems.push({ tag, kind: "console", message: m.text().slice(0, 300) }); });
  await page.goto(base, { waitUntil: "networkidle" });
  for (let i = 0; i < names.length; i++) {
    try {
      if (r.vp === "mobile") await page.locator(".mobile-nav-toggle").first().click({ timeout: 4000 }).catch(() => {});
      await page.locator(".primary-nav > .primary-nav-item > button").nth(i).click({ timeout: 6000 });
      await page.waitForTimeout(700);
      if (r.vp === "mobile") {
        await page.waitForTimeout(300);
        const railState = await page.locator(".workspace-rail").evaluate((el) => {
          const rect = el.getBoundingClientRect();
          return { open: el.classList.contains("is-mobile-open"), visible: rect.right > 0 && rect.left < window.innerWidth };
        });
        if (railState.open || railState.visible) report.problems.push({ tag, kind: "mobile-navigation", section: names[i], message: `Navigation drawer should be fully off-canvas after selecting a section; state=${JSON.stringify(railState)}` });
      }
      const file = `${tag}-${names[i]}.png`;
      await page.screenshot({ path: `${out}/${file}`, fullPage: true });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      report.shots.push({ file, horizontalOverflow: overflow });
    } catch (e) {
      report.problems.push({ tag, kind: "navigation", section: names[i], message: String(e).slice(0, 300) });
    }
  }
  await ctx.close();
}
await browser.close();
report.finishedAt = new Date().toISOString();
await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
console.log(`shots: ${report.shots.length}, problems: ${report.problems.length}, overflow: ${report.shots.filter((s) => s.horizontalOverflow).length}`);
