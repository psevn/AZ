// Visual QA: renders every main section and exercises opt-in component states in demo mode.
// Usage: node scripts/visual-qa.mjs <baseUrl> <outDir> (Playwright is installed by the workflow, not a dependency)
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
for (const vp of ["desktop", "mobile"]) {
  for (const lang of ["en", "ar"]) {
    for (const theme of ["dark", "light"]) {
      for (const bg of ["plain", "universe"]) runs.push({ vp, lang, theme, bg });
    }
  }
}

const names = ["home", "planning", "az", "me"];
const report = { base, startedAt: new Date().toISOString(), shots: [], stateShots: [], componentStates: [], quizShots: [], problems: [] };
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

  // Render a focused fixture for the new CSS primitives without migrating any product page.
  try {
    await page.evaluate(({ lang }) => {
      const host = document.querySelector(".app-shell") || document.body;
      const fixture = document.createElement("section");
      fixture.id = "az-component-qa";
      fixture.dir = lang === "ar" ? "rtl" : "ltr";
      fixture.lang = lang;
      fixture.style.cssText = "position:fixed;inset:12px;z-index:99999;overflow:auto;padding:20px;background:var(--bg);color:var(--text);display:grid;gap:12px;align-content:start;border:2px solid var(--accent);";
      fixture.innerHTML = `
        <h2 style="margin:0;font:600 18px var(--az-font-sans)">AZ component state QA</h2>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          <button id="qa-hover" class="az-btn az-btn--primary">Hover button</button>
          <button class="az-btn">Default button</button>
          <button class="az-btn az-btn--ghost">Ghost</button>
          <button class="az-btn az-btn--danger">Danger</button>
          <button id="qa-disabled" class="az-btn" disabled>Disabled</button>
        </div>
        <input id="qa-input" class="az-input" placeholder="Input focus state" aria-label="Input focus state" />
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          <button class="az-chip" aria-pressed="false">Filter</button>
          <button class="az-chip" aria-pressed="true">Selected filter</button>
        </div>
        <div class="az-card"><strong>Card surface</strong><p style="margin:6px 0 0">Shared border, radius and elevation.</p></div>
        <div class="az-tabs" role="tablist" aria-label="QA tabs">
          <button class="az-tab" role="tab" aria-selected="true">Selected</button>
          <button class="az-tab" role="tab" aria-selected="false">Inactive</button>
        </div>
        <div class="az-popover">Popover surface</div>
        <div class="az-toast" role="status" aria-live="polite" style="position:static;margin:0">Toast surface preview</div>
      `;
      host.appendChild(fixture);
    }, { lang: r.lang });

    const hover = page.locator("#qa-hover");
    await hover.hover();
    // Wait for the browser to finish the CSS transition; fixed sleeps can be too short on busy CI workers.
    await page.waitForFunction(() => {
      const el = document.querySelector("#qa-hover");
      return !!el && el.matches(":hover") && getComputedStyle(el).filter === "brightness(1.06)";
    }, null, { timeout: 1200 }).catch(() => {});
    const hoverState = await hover.evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        hovered: el.matches(":hover"),
        filter: style.filter,
        transitionDuration: style.transitionDuration,
        transitionDelay: style.transitionDelay,
      };
    });
    await page.keyboard.press("Tab");
    await page.locator("#qa-input").focus();
    const state = await page.evaluate((hoverState) => {
      const input = document.querySelector("#qa-input");
      const disabled = document.querySelector("#qa-disabled");
      return {
        hoverMatched: hoverState.hovered,
        hoverFilter: hoverState.filter,
        inputFocusVisible: input.matches(":focus-visible"),
        inputFocusShadow: getComputedStyle(input).boxShadow,
        disabled: disabled.disabled,
        disabledCursor: getComputedStyle(disabled).cursor,
        buttonMinHeight: getComputedStyle(document.querySelector("#qa-hover")).minHeight,
      };
    }, hoverState);
    if (!state.hoverMatched || state.hoverFilter !== "brightness(1.06)") report.problems.push({ tag, kind: "component-hover", message: `Expected active primary-button hover filter brightness(1.06), received: ${JSON.stringify(hoverState)}` });
    if (!state.inputFocusVisible || state.inputFocusShadow === "none") report.problems.push({ tag, kind: "component-focus", message: `Input focus-visible ring missing: ${JSON.stringify(state)}` });
    if (!state.disabled || state.disabledCursor !== "not-allowed") report.problems.push({ tag, kind: "component-disabled", message: `Disabled button state incorrect: ${JSON.stringify(state)}` });
    if (r.vp === "mobile" && Number.parseFloat(state.buttonMinHeight) < 44) report.problems.push({ tag, kind: "component-touch-target", message: `Mobile button is below 44px: ${state.buttonMinHeight}` });
    const componentFile = `${tag}-component-states.png`;
    await page.locator("#az-component-qa").screenshot({ path: `${out}/${componentFile}` });
    report.componentStates.push({ file: componentFile, ...state });
  } catch (e) {
    report.problems.push({ tag, kind: "component-fixture", message: String(e).slice(0, 300) });
  }
  // Exercise real PlanningPage loading, empty and error branches with demo fixtures.
  for (const state of ["loading", "empty", "error"]) {
    try {
      await page.goto(`${base}/?qa-planning-state=${state}`, { waitUntil: "networkidle" });
      if (r.vp === "mobile") await page.locator(".mobile-nav-toggle").first().click({ timeout: 4000 });
      await page.locator(".primary-nav > .primary-nav-item > button").nth(1).click({ timeout: 6000 });
      await page.waitForTimeout(250);
      const file = `${tag}-planning-${state}.png`;
      await page.screenshot({ path: `${out}/${file}`, fullPage: true });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      report.stateShots.push({ file, section: "planning", state, horizontalOverflow: overflow });
    } catch (e) {
      report.problems.push({ tag, kind: "planning-state", state, message: String(e).slice(0, 300) });
    }
  }
  // Exercise Home loading, empty and error branches using demo-only fixtures.
  for (const state of ["loading", "empty", "error"]) {
    try {
      await page.goto(`${base}/?qa-home-state=${state}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(250);
      const file = `${tag}-home-${state}.png`;
      await page.screenshot({ path: `${out}/${file}`, fullPage: true });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      report.stateShots.push({ file, section: "home", state, horizontalOverflow: overflow });
    } catch (e) {
      report.problems.push({ tag, kind: "home-state", state, message: String(e).slice(0, 300) });
    }
  }

  // Exercise the Quiz screen states in both themes, languages and viewport sizes.
  for (const state of ["question", "feedback", "result", "empty", "error", "loading"]) {
    try {
      await page.goto(`${base}/?qa-quiz-state=${state}`, { waitUntil: "networkidle" });
      await page.locator(".home-quiz-action").click({ timeout: 6000 });
      await page.waitForTimeout(250);
      const file = `${tag}-quiz-${state}.png`;
      await page.screenshot({ path: `${out}/${file}`, fullPage: true });
      const metrics = await page.evaluate(() => ({
        horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        visible: !!document.querySelector(".quiz-page"),
      }));
      if (!metrics.visible) report.problems.push({ tag, kind: "quiz-navigation", state, message: "Quiz page did not render after Home action." });
      report.quizShots.push({ file, state, horizontalOverflow: metrics.horizontalOverflow });
    } catch (e) {
      report.problems.push({ tag, kind: "quiz-state", state, message: String(e).slice(0, 300) });
    }
  }
  // Verify number-key selection and Enter confirmation on the live question interaction.
  if (r.vp === "desktop" && r.lang === "en" && r.theme === "dark" && r.bg === "plain") {
    try {
      await page.goto(base, { waitUntil: "networkidle" });
      await page.locator(".home-quiz-action").click({ timeout: 6000 });
      await page.locator(".quiz-page").waitFor();
      await page.locator(".quiz-choice").first().waitFor();
      await page.keyboard.press("1");
      const selected = await page.locator(".quiz-choice").first().getAttribute("aria-checked");
      await page.keyboard.press("Enter");
      await page.locator(".quiz-feedback").waitFor({ timeout: 3000 });
      if (selected !== "true") report.problems.push({ tag, kind: "quiz-keyboard", message: "Number key 1 did not select the first radio choice." });
    } catch (e) {
      report.problems.push({ tag, kind: "quiz-keyboard", message: String(e).slice(0, 300) });
    }
  }

  // Check accent, subject-label, primary-action and danger-action contrast in both themes.
  if (r.theme === "light" || r.theme === "dark") {
    await page.goto(base, { waitUntil: "networkidle" });
    if (r.vp === "mobile") await page.locator(".mobile-nav-toggle").first().click({ timeout: 4000 });
      await page.locator(".primary-nav > .primary-nav-item > button").nth(1).click({ timeout: 6000 });
    await page.waitForTimeout(150);
    const contrast = await page.evaluate((theme) => {
      const rgb = (value) => {
        if (value.startsWith("#")) {
          const hex=value.slice(1);
          const full=hex.length===3?hex.split("").map(x=>x+x).join(""):hex;
          return [0,2,4].map(i=>parseInt(full.slice(i,i+2),16));
        }
        const match = value.match(/[\\d.]+/g)?.map(Number) ?? [];
        return match.length >= 3 ? match.slice(0,3) : [0,0,0];
      };
      const luminance = (color) => {
        const [r,g,b] = rgb(color).map(v => { const c=v/255; return c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4; });
        return 0.2126*r+0.7152*g+0.0722*b;
      };
      const ratio = (a,b) => { const x=luminance(a),y=luminance(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05); };
      const shell = document.querySelector(".app-shell");
      const surface = theme === "light" ? "#FFFFFF" : "#0E1013";
      const accent = getComputedStyle(shell).getPropertyValue("--accent").trim();
      const accentRatio = ratio(accent, surface);
      const subject = document.querySelector(".plan-meta-subject");
      const subjectColor = subject ? getComputedStyle(subject).color : "";
      const subjectRatio = subjectColor ? ratio(subjectColor, surface) : null;
      const primaryGradientMinRatio = ["#0668C5","#075EBB","#2520D8"].reduce((min,color)=>Math.min(min,ratio("#FFFFFF",color)),Infinity);
      const dangerRatio = ratio(theme === "light" ? "#B42332" : "#FF6B6B",surface);
      return { accent, surface, accentRatio, subjectColor, subjectRatio, primaryGradientMinRatio, dangerRatio };
    }, r.theme);
    if (contrast.accentRatio < 4.5) report.problems.push({ tag, kind: `${r.theme}-accent-contrast`, message: JSON.stringify(contrast) });
    if (contrast.subjectRatio !== null && contrast.subjectRatio < 4.5) report.problems.push({ tag, kind: `${r.theme}-subject-contrast`, message: JSON.stringify(contrast) });
    if (contrast.primaryGradientMinRatio < 4.5 || contrast.dangerRatio < 4.5) report.problems.push({ tag, kind: `${r.theme}-action-contrast`, message: JSON.stringify(contrast) });
  }

  // Offline remains a small, non-blocking banner.
  try {
    await page.goto(base, { waitUntil: "networkidle" });
    await page.context().setOffline(true);
    await page.waitForTimeout(150);
    const homeOfflineVisible = await page.locator(".home-offline").isVisible().catch(() => false);
    if (!homeOfflineVisible) report.problems.push({ tag, kind: "home-offline-banner", message: "Home offline banner was not visible after the browser context went offline." });
    if (r.vp === "mobile") await page.locator(".mobile-nav-toggle").first().click({ timeout: 4000 });
    await page.locator(".primary-nav > .primary-nav-item > button").nth(1).click({ timeout: 6000 });
    await page.waitForTimeout(150);
    const planningOfflineVisible = await page.locator(".plan-offline").isVisible().catch(() => false);
    if (!planningOfflineVisible) report.problems.push({ tag, kind: "planning-offline-banner", message: "Planning offline banner was not visible after the browser context went offline." });
    await page.context().setOffline(false);
  } catch (e) {
    await page.context().setOffline(false).catch(() => {});
    report.problems.push({ tag, kind: "offline-banner", message: String(e).slice(0, 300) });
  }
  await ctx.close();
}

await browser.close();
report.finishedAt = new Date().toISOString();
await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
console.log(`shots: ${report.shots.length}, state shots: ${report.stateShots.length}, component states: ${report.componentStates.length}, quiz shots: ${report.quizShots.length}, problems: ${report.problems.length}, overflow: ${report.shots.concat(report.stateShots, report.quizShots).filter((s) => s.horizontalOverflow).length}`);
if (report.problems.length > 0) {
  throw new Error(`Visual QA failed with ${report.problems.length} problem(s). See report.json for details.`);
}
