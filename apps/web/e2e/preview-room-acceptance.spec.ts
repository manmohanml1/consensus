import { expect, test, type Page } from "@playwright/test";

// This is intentionally opt-in: it exercises the deployed Preview runtime and
// creates one clearly labelled synthetic room that is removed only through the
// separately authorized operator cleanup procedure.
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
  test.setTimeout(180_000);

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
  const deniedContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    extraHTTPHeaders: {
      "x-vercel-protection-bypass": bypassSecret!,
      "x-vercel-set-bypass-cookie": "true",
    },
  });
  const recoveryContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    extraHTTPHeaders: {
      "x-vercel-protection-bypass": bypassSecret!,
      "x-vercel-set-bypass-cookie": "true",
    },
  });

  const consoleFailures: string[] = [];
  const observe = (page: Page) => {
    page.on("console", (message) => {
      if (message.type() === "error") consoleFailures.push(message.text());
    });
    page.on("pageerror", (error) => consoleFailures.push(error.message));
  };

  try {
    const host = await hostContext.newPage();
    observe(host);
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

    const denied = await deniedContext.newPage();
    observe(denied);
    await denied.goto(`/?join=${encodeURIComponent(locator ?? "")}`);
    await denied.getByLabel("Your name").fill("Denied guest");
    await denied.getByRole("button", { name: "Ask to join" }).click();
    await expect(denied.getByText("Waiting for the host")).toBeVisible();
    await host.getByRole("button", { name: "Refresh" }).click();
    await host
      .locator(".connected-roster li", { hasText: "Denied guest" })
      .getByRole("button", { name: "Deny" })
      .click();
    await denied.getByRole("button", { name: "Refresh" }).click();
    await expect(
      denied.getByText(
        "That room is unavailable or this browser no longer has access.",
        { exact: true },
      ),
    ).toBeVisible();

    const guest = await guestContext.newPage();
    observe(guest);
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
    await expect(
      host.getByRole("button", { name: /^Prefer — a positive choice$/ }),
    ).toBeVisible();
    await guest.getByRole("button", { name: "Refresh" }).click();
    await expect(
      guest.getByRole("button", { name: /^Accept — a workable compromise$/ }),
    ).toBeVisible();
    for (let index = 0; index < 4; index += 1) {
      await host
        .getByRole("button", { name: /^Prefer — a positive choice$/ })
        .click();
      if (index < 3) {
        await expect(host.locator(".connected-progress strong")).toHaveText(
          `${index + 2}/4`,
        );
      }
    }
    await expect(host.getByText("Waiting for the group.")).toBeVisible();
    await guest.getByRole("button", { name: "Refresh progress" }).click();
    for (let index = 0; index < 4; index += 1) {
      await guest
        .getByRole("button", { name: /^Accept — a workable compromise$/ })
        .click();
      if (index < 3) {
        await expect(guest.locator(".connected-progress strong")).toHaveText(
          `${index + 2}/4`,
        );
      }
    }
    await expect(guest.getByText("Waiting for the group.")).toBeVisible();
    await host.getByRole("button", { name: "Refresh progress" }).click();
    await expect(
      host.getByRole("button", { name: "Resolve fairly" }),
    ).toBeEnabled();
    await host.getByRole("button", { name: "Resolve fairly" }).click();
    const hostResult = host.getByTestId("connected-result");
    await expect(hostResult).toBeVisible();
    await guest.getByRole("button", { name: "Refresh progress" }).click();

    const guestResult = guest.getByTestId("connected-result");
    await expect(guestResult).toBeVisible();
    const hostWinner = hostResult.getByRole("heading", { level: 3 });
    const guestWinner = guestResult.getByRole("heading", { level: 3 });
    await expect(guestWinner).toHaveText(await hostWinner.textContent());

    await host.locator(".recovery-panel").getByText("Host recovery").click();
    const recoveryPanel = host.locator(".recovery-panel");
    const roomId = await recoveryPanel.locator("code").first().textContent();
    expect(roomId).toMatch(/^room_[a-f0-9]{32}$/);
    await recoveryPanel
      .getByRole("button", { name: "Create recovery code" })
      .click();
    const recoveryCode = await recoveryPanel
      .locator("code")
      .nth(1)
      .textContent();
    expect(recoveryCode).toMatch(/^hr1\.[A-Za-z0-9_-]{32}$/);

    const recoveredHost = await recoveryContext.newPage();
    observe(recoveredHost);
    await recoveredHost.goto("/");
    await recoveredHost.getByRole("button", { name: "Recover" }).click();
    await recoveredHost.getByLabel("Room ID").fill(roomId ?? "");
    await recoveredHost
      .getByLabel("One-time recovery code")
      .fill(recoveryCode ?? "");
    await recoveredHost
      .getByRole("button", { name: "Restore host access" })
      .click();
    await expect(recoveredHost.getByText("Hosting as")).toBeVisible();
    await expect(recoveredHost.getByTestId("connected-result")).toBeVisible();

    const oldHostResponse = await host.evaluate(async (id) => {
      const response = await fetch(`/api/v1/rooms/${id}/projection`, {
        cache: "no-store",
      });
      return { status: response.status, body: await response.json() };
    }, roomId);
    const missingResponse = await recoveredHost.evaluate(async () => {
      const response = await fetch(
        "/api/v1/rooms/room_00000000000000000000000000000000/projection",
        { cache: "no-store" },
      );
      return { status: response.status, body: await response.json() };
    });
    expect(oldHostResponse.status).toBe(404);
    expect(missingResponse.status).toBe(404);
    const stableUnavailableResponse = {
      protocolVersion: "1.0.0",
      code: "unauthorized-or-missing",
      message: "The room is unavailable.",
      retryable: false,
    };
    expect(oldHostResponse.body).toMatchObject(stableUnavailableResponse);
    expect(missingResponse.body).toMatchObject(stableUnavailableResponse);
    const oldHostCorrelationId = (
      oldHostResponse.body as { correlationId?: unknown }
    ).correlationId;
    const missingCorrelationId = (
      missingResponse.body as { correlationId?: unknown }
    ).correlationId;
    expect(oldHostCorrelationId).toMatch(/^correlation_[a-f0-9]{32}$/);
    expect(missingCorrelationId).toMatch(/^correlation_[a-f0-9]{32}$/);
    expect(oldHostCorrelationId).not.toBe(missingCorrelationId);

    for (const testedPage of [host, guest, denied, recoveredHost]) {
      const dimensions = await testedPage.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(
        dimensions.clientWidth,
      );
    }
    for (const width of [768, 1024, 1440]) {
      await recoveredHost.setViewportSize({ width, height: 1000 });
      const dimensions = await recoveredHost.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(
        dimensions.clientWidth,
      );
    }
    expect(consoleFailures).toEqual([]);
  } finally {
    await hostContext.close();
    await guestContext.close();
    await deniedContext.close();
    await recoveryContext.close();
  }
});
