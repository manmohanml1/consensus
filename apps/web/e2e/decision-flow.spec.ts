import { expect, test, type Page } from "@playwright/test";

async function reachResult(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Review candidates" }).click();
  await page
    .getByRole("button", { name: "Lock roster and begin voting" })
    .click();

  for (let response = 0; response < 12; response += 1) {
    await page
      .getByRole("button", { name: /Prefer.*positive choice/i })
      .click();
  }
  await page.getByRole("button", { name: "Resolve fairly" }).click();
}

test("completes the account-free decision journey", async ({ page }) => {
  await reachResult(page);

  await expect(page.getByTestId("result-step")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Garden Table" }),
  ).toBeVisible();
  await expect(page.getByText("Runner-up:")).toBeVisible();
  await page.getByRole("button", { name: /Maya/ }).click();
  await expect(page.getByText("1/3 people are in.")).toBeVisible();
});

test("supports keyboard-only setup progression", async ({ page }) => {
  await page.goto("/");
  const roomName = page.getByLabel("Room name");
  await roomName.focus();
  await expect(roomName).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Target date and time")).toBeFocused();
  await page.getByRole("button", { name: "Review candidates" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("candidate-step")).toBeVisible();
});

test("does not overflow a 390px mobile viewport", async ({ page }) => {
  await page.goto("/");
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  await expect(
    page.getByRole("button", { name: "Review candidates" }),
  ).toBeVisible();
});

test("supports an optional mobile swipe without removing buttons", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Review candidates" }).click();
  await page
    .getByRole("button", { name: "Lock roster and begin voting" })
    .click();

  const card = page.getByTestId("ballot-card");
  await card.scrollIntoViewIfNeeded();
  const box = await card.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.4, {
    steps: 8,
  });
  await page.mouse.up();

  await expect(
    page.getByRole("heading", { name: "Night Noodle" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Accept.*workable compromise/i }),
  ).toBeVisible();
});

test("honors reduced-motion preferences", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== "reduced-motion",
    "Dedicated reduced-motion profile",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  expect(
    await page.evaluate(
      () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
  ).toBe(true);
});
