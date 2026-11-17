import { expect, test } from "@playwright/test";

test("two real browser sessions edit the same AZ Projects document", async ({ browser }) => {
  const leadContext = await browser.newContext({
    viewport: { width: 1365, height: 900 },
  });
  const memberContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const leadPage = await leadContext.newPage();
  const memberPage = await memberContext.newPage();
  leadPage.on("console", (message) => console.log("[lead console]", message.type(), message.text()));
  leadPage.on("pageerror", (error) => console.log("[lead pageerror]", error.stack || error.message));
  memberPage.on("console", (message) => console.log("[member console]", message.type(), message.text()));
  memberPage.on("pageerror", (error) => console.log("[member pageerror]", error.stack || error.message));

  await leadPage.goto("/e2e/collaboration-harness.html?user=1&lang=en");
  console.log("[lead body]", (await leadPage.locator("body").innerText()).slice(0, 3000));
  await expect(leadPage.getByRole("heading", { name: "AZ Shared Document E2E" })).toBeVisible();
  await leadPage.getByRole("button", { name: "Main document" }).click();
  await expect(leadPage.locator(".project-collab-status")).toContainText("Connected");
  await expect(leadPage.locator(".project-collab-status")).toContainText("Synced");

  await memberPage.goto("/e2e/collaboration-harness.html?user=2&lang=ar");
  await expect(memberPage.getByRole("heading", { name: "AZ Shared Document E2E" })).toBeVisible();
  await memberPage.getByRole("button", { name: "المستند الرئيسي" }).click();
  await expect(memberPage.locator(".project-collab-status")).toContainText("متصل");
  await expect(memberPage.locator(".project-collab-status")).toContainText("مزامنة");

  const leadEditor = leadPage.locator(".project-editor-content[contenteditable='true']");
  const memberEditor = memberPage.locator(".project-editor-content[contenteditable='true']");
  await expect(leadEditor).toBeVisible();
  await expect(memberEditor).toBeVisible();

  const sharedText = "مرحبا AZ — Shared document 123";
  await leadEditor.fill(sharedText);
  await expect(memberEditor).toContainText(sharedText);

  await expect(leadPage.locator(".project-collab-presence")).toContainText("Member Two");
  await expect(memberPage.locator(".project-collab-presence")).toContainText("Lead One");
  await expect(memberPage.locator(".project-editor-canvas")).toBeVisible();

  await leadContext.close();
  await memberContext.close();
});
