import { expect, test } from "@playwright/test";

// This is intentionally opt-in: it exercises the deployed Preview runtime and
// creates one clearly labelled synthetic room that is removed immediately by
// the documented operator cleanup procedure.
test("accepts a real Preview invitation in a separate browser session", async ({
  browser,
}, testInfo) => {
  const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  const syntheticTitle = process.env.CONSENSUS_PREVIEW_TEST_TITLE;
  test.skip(
    process.env.CONSENSUS_LIVE_PREVIEW_ACCEPTANCE !== "1",
    "Set CONSENSUS_LIVE_PREVIEW_ACCEPTANCE=1 for an approved shared Preview check.",
  );
  test.skip(
    !bypassSecret || !syntheticTitle,
    "Protected Preview checks require a Vercel automation bypass and an explicit cleanup title.",
  );
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "This check creates its own isolated mobile contexts.",
  );
  test.setTimeout(90_000);

  const hostContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    extraHTTPHeaders: {
      "x-vercel-protection-bypass": bypassSecret!,
      "x-vercel-set-bypass-cookie": "true",
    },
  });
  const guestContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    extraHTTPHeaders: {
      "x-vercel-protection-bypass": bypassSecret!,
      "x-vercel-set-bypass-cookie": "true",
    },
  });

  try {
    const host = await hostContext.newPage();
    await host.goto("/");
    await expect(
      host.getByRole("heading", {
        name: "Start together. No account required.",
      }),
    ).toBeVisible();
    await host.getByLabel("What are you deciding?").fill(syntheticTitle!);
    await host.getByLabel("When?").fill("2027-09-04T19:00");
    await host.getByLabel("Your name").fill("Preview host");
    await host.getByRole("button", { name: "Create temporary room" }).click();

    const locator = await host.locator("code").first().textContent();
    expect(locator).toMatch(/^r1\.[A-Za-z0-9_-]+$/);

    const guest = await guestContext.newPage();
    await guest.goto(`/?join=${encodeURIComponent(locator ?? "")}`);
    await guest.getByLabel("Your name").fill("Preview guest");
    await guest.getByRole("button", { name: "Ask to join" }).click();
    await expect(guest.getByText("Waiting for the host")).toBeVisible();

    await host.getByRole("button", { name: "Refresh" }).click();
    await host.getByRole("button", { name: "Admit" }).click();
    await guest.getByRole("button", { name: "Refresh" }).click();
    await expect(
      guest.locator(".connected-roster").getByText("Preview guest"),
    ).toBeVisible();

    await host
      .getByRole("button", { name: "Lock roster and begin voting" })
      .click();
    await guest.getByRole("button", { name: "Refresh progress" }).click();
    for (let index = 0; index < 4; index += 1) {
      await host
        .getByRole("button", { name: /^Prefer — a positive choice$/ })
        .click();
    }
    await guest.getByRole("button", { name: "Refresh progress" }).click();
    for (let index = 0; index < 4; index += 1) {
      await guest
        .getByRole("button", { name: /^Accept — a workable compromise$/ })
        .click();
    }
    await host.getByRole("button", { name: "Refresh progress" }).click();
    await host.getByRole("button", { name: "Resolve fairly" }).click();
    await guest.getByRole("button", { name: "Refresh progress" }).click();

    const hostResult = host.getByTestId("connected-result");
    const guestResult = guest.getByTestId("connected-result");
    await expect(hostResult).toBeVisible();
    await expect(guestResult).toBeVisible();
    await expect(guestResult).toHaveText(await hostResult.innerText());
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});
