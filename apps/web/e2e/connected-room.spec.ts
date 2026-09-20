import {
  expect,
  test,
  type BrowserContext,
  type Page,
  type Route,
} from "@playwright/test";

const uncaughtErrors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  uncaughtErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.stack ?? error.message));
});
test.afterEach(async ({ page }) => {
  expect(uncaughtErrors.get(page) ?? []).toEqual([]);
});

test("separates the live entry from the illustrative demo", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Create temporary room" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Review candidates" }),
  ).toHaveCount(0);
  await page
    .getByRole("link", { name: "Explore the separate single-device demo" })
    .click();
  await expect(
    page.getByRole("button", { name: "Review candidates" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create temporary room" }),
  ).toHaveCount(0);
  await page.goto("/?join=r1.AAAAAAAAAAAAAAAAAAAAAA&demo=1");
  await expect(page.getByRole("button", { name: "Ask to join" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Review candidates" }),
  ).toHaveCount(0);
});

type Participant = {
  id: string;
  displayName: string;
  status: "pending" | "active" | "left";
};

const activateEntryMode = async (page: Page, mode: "Create" | "Join") => {
  const button = page.getByRole("button", { name: mode, exact: true });
  await expect(async () => {
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
  }).toPass();
};

const projection = ({
  phase = "lobby",
  role = "host",
  participantStatus = "active",
}: {
  phase?: "lobby" | "expired";
  role?: "host" | "participant";
  participantStatus?: "pending" | "active" | "left";
} = {}) => ({
  room: {
    protocolVersion: "1.0.0",
    roomId: "room_connected_state_0001",
    revision: phase === "expired" ? 2 : 1,
    phase,
    title: "Friday dinner",
    targetAt: "2027-09-04T23:00:00.000Z",
    createdAt: "2026-09-03T12:00:00.000Z",
    expiresAt: "2026-09-03T14:00:00.000Z",
    rosterLocked: false,
    participants: [
      {
        id:
          role === "host"
            ? "member_host_state_0001"
            : "member_guest_state_0001",
        displayName: role === "host" ? "Maya" : "Sam",
        status: participantStatus,
      },
    ],
    constraintIds: [],
    candidates: [
      { id: "candidate_garden", name: "Garden Table", status: "active" },
      { id: "candidate_noodle", name: "Night Noodle", status: "active" },
    ],
    ballotProgress: [],
    decision: null,
  },
  actor: {
    memberId:
      role === "host" ? "member_host_state_0001" : "member_guest_state_0001",
    role,
    nextSequence: 1,
  },
});

test("does not replace membership when resume is offline or denied", async ({
  page,
}) => {
  let denied = false;
  let posts = 0;
  await page.route("**/api/v1/rooms**", async (route) => {
    if (route.request().method() === "POST") posts += 1;
    if (!denied) return route.abort("failed");
    return route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ code: "unauthorized-or-missing" }),
    });
  });
  await page.goto(
    "/?room=room_connected_state_0001&join=r1.AAAAAAAAAAAAAAAAAAAAAA",
  );
  await expect(
    page.getByRole("button", { name: "Retry connection" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Ask to join" })).toHaveCount(
    0,
  );
  denied = true;
  await page.getByRole("button", { name: "Retry connection" }).click();
  await expect(page.getByRole("button", { name: "Ask to join" })).toBeVisible();
  expect(posts).toBe(0);
  await expect(page).not.toHaveURL(/room=/);
});

test("retries uncertain commands exactly without rolling back newer snapshots", async ({
  page,
}) => {
  const current = projection();
  const bodies: string[] = [];
  await page.route("**/api/v1/rooms**", async (route) => {
    if (route.request().url().endsWith("/commands")) {
      bodies.push(route.request().postData() ?? "");
      if (bodies.length === 1) {
        current.room.revision = 3;
        current.actor.nextSequence = 2;
        return route.abort("failed");
      }
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ...current,
          room: { ...current.room, revision: 2 },
        }),
      });
    }
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(current),
    });
  });
  await page.goto("/?room=room_connected_state_0001");
  await page.getByLabel("Add an option").fill("Lantern Café");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Retry pending action" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add", exact: true }),
  ).toBeDisabled();
  await expect(page.getByText("Revision 3", { exact: true })).toBeVisible({
    timeout: 8_000,
  });
  await page.getByRole("button", { name: "Retry pending action" }).click();
  await expect(
    page.getByRole("button", { name: "Retry pending action" }),
  ).toHaveCount(0);
  expect(bodies).toHaveLength(2);
  expect(bodies[1]).toBe(bodies[0]);
  await expect(page.getByText("Revision 3", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Add an option")).toHaveValue("");
});

test("ignores a slow refresh response after a newer command", async ({
  page,
}) => {
  const current = projection();
  let delayed: Route | undefined;
  let holdNext = false;
  await page.route("**/api/v1/rooms**", async (route) => {
    if (route.request().url().endsWith("/commands")) {
      current.room.revision = 2;
      current.actor.nextSequence = 2;
    } else if (holdNext && !delayed) {
      delayed = route;
      return;
    }
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(current),
    });
  });
  await page.goto("/?room=room_connected_state_0001");
  await expect(page.getByText("Hosting as")).toBeVisible();
  holdNext = true;
  await expect.poll(() => Boolean(delayed)).toBe(true);
  await page.getByLabel("Add an option").fill("Lantern Café");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Revision 2", { exact: true })).toBeVisible();
  await delayed!.fulfill({
    contentType: "application/json",
    body: JSON.stringify(projection()),
  });
  await expect(page.getByText("Revision 2", { exact: true })).toBeVisible();
});

test("shows polling interruption and recovers on connectivity return", async ({
  page,
}) => {
  let fail = false;
  await page.route("**/api/v1/rooms**", async (route) => {
    if (fail) return route.abort("failed");
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(projection()),
    });
  });
  await page.goto("/?room=room_connected_state_0001");
  await expect(page.getByText("Hosting as")).toBeVisible();
  await expect(page.getByTestId("room-sync-status")).toContainText(
    /auto-sync on/i,
  );
  fail = true;
  await expect(page.getByText(/Updates are delayed/)).toBeVisible({
    timeout: 12_000,
  });
  await expect(page.getByTestId("room-sync-status")).toContainText("Delayed");
  await expect(page.getByText("Hosting as")).toBeVisible();
  fail = false;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByText(/Updates are delayed/)).toHaveCount(0);
  await expect(page.getByTestId("room-sync-status")).toContainText(
    /auto-sync on/i,
  );
});

test("labels offline state without hiding the last confirmed room", async ({
  page,
}) => {
  await page.route("**/api/v1/rooms**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(projection()),
    }),
  );
  await page.goto("/?room=room_connected_state_0001");
  await expect(page.getByText("Hosting as")).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect(page.getByTestId("room-sync-status")).toContainText("Offline");
  await expect(page.getByRole("button", { name: "Sync now" })).toBeDisabled();
  await expect(
    page.getByText(/confirmed room state remains visible/i),
  ).toBeVisible();
  await expect(page.getByText("Hosting as")).toBeVisible();
});

test("orchestrates a two-browser secure-room journey", async ({
  browser,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "The test creates its own two isolated mobile contexts",
  );
  test.setTimeout(60_000);
  const participants: Participant[] = [
    { id: "member_host_0001", displayName: "Maya", status: "active" },
  ];
  const candidates: Array<{
    id: string;
    name: string;
    status: "active";
  }> = [
    { id: "candidate_garden", name: "Garden Table", status: "active" },
    { id: "candidate_noodle", name: "Night Noodle", status: "active" },
  ];
  const completed = new Map([
    ["member_host_0001", 0],
    ["member_guest_0001", 0],
  ]);
  const sequences = new Map([
    ["member_host_0001", 1],
    ["member_guest_0001", 1],
  ]);
  let revision = 0;
  let phase: "lobby" | "voting" | "resolved" = "lobby";
  let rosterLocked = false;

  const room = () => ({
    protocolVersion: "1.0.0",
    roomId: "room_connected_0001",
    revision,
    phase,
    title: "Friday dinner",
    targetAt: "2026-09-04T23:00:00.000Z",
    createdAt: "2026-09-03T12:00:00.000Z",
    expiresAt: "2026-09-03T14:00:00.000Z",
    rosterLocked,
    participants,
    constraintIds: [],
    candidates,
    ballotProgress: rosterLocked
      ? participants
          .filter(({ status }) => status === "active")
          .map(({ id }) => ({
            participantId: id,
            completed: completed.get(id) ?? 0,
            total: candidates.length,
          }))
      : [],
    decision:
      phase === "resolved"
        ? {
            status: "decided",
            rulesetVersion: "1.0.0",
            winnerCandidateId: "candidate_garden",
          }
        : null,
  });

  const respond = async (route: Route, body: unknown, status = 200) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

  const installApi = async (
    context: BrowserContext,
    actor: { memberId: string; role: "host" | "participant" },
  ) => {
    await context.route("**/api/v1/rooms**", async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (path === "/api/v1/rooms" && request.method() === "POST") {
        return respond(
          route,
          {
            room: room(),
            actor: { ...actor, nextSequence: sequences.get(actor.memberId) },
            invitation: {
              locator: "r1.AAAAAAAAAAAAAAAAAAAAAA",
              expiresAt: room().expiresAt,
            },
          },
          201,
        );
      }
      if (path === "/api/v1/rooms/join" && request.method() === "POST") {
        participants.push({
          id: actor.memberId,
          displayName: "Sam",
          status: "pending",
        });
        revision += 1;
        return respond(
          route,
          { room: room(), actor: { ...actor, nextSequence: 1 } },
          202,
        );
      }
      if (path.endsWith("/projection")) {
        return respond(route, {
          room: room(),
          actor: { ...actor, nextSequence: sequences.get(actor.memberId) },
        });
      }
      if (path.endsWith("/commands")) {
        const command = request.postDataJSON() as {
          type: string;
          payload: { participantId?: string; name?: string };
        };
        if (command.type === "participant.approve") {
          const guest = participants.find(
            ({ id }) => id === command.payload.participantId,
          );
          if (guest) guest.status = "active";
        } else if (
          command.type === "candidate.create" &&
          command.payload.name
        ) {
          candidates.push({
            id: "candidate_lantern",
            name: command.payload.name,
            status: "active",
          });
        } else if (command.type === "roster.lock") {
          rosterLocked = true;
          phase = "voting";
        } else if (command.type === "vote.submit") {
          completed.set(
            actor.memberId,
            (completed.get(actor.memberId) ?? 0) + 1,
          );
        } else if (command.type === "decision.resolve") {
          phase = "resolved";
        }
        revision += 1;
        sequences.set(actor.memberId, (sequences.get(actor.memberId) ?? 1) + 1);
        return respond(
          route,
          {
            room: room(),
            actor: { ...actor, nextSequence: sequences.get(actor.memberId) },
          },
          201,
        );
      }
      return route.fallback();
    });
  };

  const hostContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const guestContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await installApi(hostContext, { memberId: "member_host_0001", role: "host" });
  await installApi(guestContext, {
    memberId: "member_guest_0001",
    role: "participant",
  });
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  const roomErrors: string[] = [];
  for (const page of [host, guest])
    page.on("pageerror", (error) =>
      roomErrors.push(error.stack ?? error.message),
    );

  try {
    await host.goto("/");
    await activateEntryMode(host, "Join");
    await activateEntryMode(host, "Create");
    const targetAt = host.getByLabel("When?");
    await targetAt.fill("2027-09-04T19:00");
    await expect(targetAt).toHaveValue("2027-09-04T19:00");
    await host
      .getByLabel("Starter options · one per line")
      .fill("Garden Table\nNight Noodle");
    await host.getByLabel("Your name").fill("Maya");
    await host.getByRole("button", { name: "Create temporary room" }).click();
    await expect(host.getByText("r1.AAAAAAAAAAAAAAAAAAAAAA")).toBeVisible();
    await host.reload();
    await expect(host.getByText("Hosting as")).toBeVisible();
    await expect(host.getByText("r1.AAAAAAAAAAAAAAAAAAAAAA")).toBeVisible();
    await host.getByLabel("Add an option").fill("Lantern Café");
    await host.getByRole("button", { name: "Add", exact: true }).click();
    await expect(host.locator(".candidate-review-list")).toContainText(
      "Lantern Café",
    );

    await guest.goto("/?join=r1.AAAAAAAAAAAAAAAAAAAAAA");
    await activateEntryMode(guest, "Create");
    await activateEntryMode(guest, "Join");
    await guest.getByLabel("Your name").fill("Sam");
    await guest.getByRole("button", { name: "Ask to join" }).click();
    await expect(guest.getByText("Waiting for the host")).toBeVisible();
    await guest.reload();
    await expect(guest.getByText("Waiting for the host")).toBeVisible();
    expect(
      participants.filter(({ id }) => id === "member_guest_0001"),
    ).toHaveLength(1);

    await expect(
      host.locator(".connected-roster").getByText("Sam"),
    ).toBeVisible({ timeout: 6_000 });
    await host.getByRole("button", { name: "Admit" }).click();
    await expect(guest.getByText("Waiting for the host")).toHaveCount(0, {
      timeout: 6_000,
    });
    await expect(
      guest.locator(".connected-roster").getByText("Sam"),
    ).toBeVisible();

    await host
      .getByRole("button", { name: "Lock roster and begin voting" })
      .click();
    await expect(guest.getByTestId("connected-ballot")).toBeVisible({
      timeout: 10_000,
    });
    const card = host.getByTestId("connected-ballot").locator("article");
    await card.scrollIntoViewIfNeeded();
    const box = await card.boundingBox();
    if (!box) throw new Error("Voting card is missing");
    await host.mouse.move(box.x + 30, box.y + 30);
    await host.mouse.down();
    await host.mouse.move(box.x + 150, box.y + 30, { steps: 8 });
    await card.dispatchEvent("pointercancel", {
      pointerId: 1,
      pointerType: "mouse",
    });
    await host.mouse.up();
    expect(completed.get("member_host_0001")).toBe(0);
    for (let index = 0; index < 3; index += 1) {
      if (index === 2) {
        await expect(
          host.getByTestId("connected-custom-option-media"),
        ).toBeVisible();
      }
      await host
        .getByRole("button", { name: /^Prefer — a positive choice$/ })
        .click();
    }
    await expect(guest.getByTestId("connected-ballot")).toBeVisible();
    for (let index = 0; index < 3; index += 1) {
      if (index === 1) {
        await guest.reload();
        await expect(guest.getByTestId("connected-ballot")).toBeVisible();
        expect(completed.get("member_guest_0001")).toBe(1);
      }
      await guest
        .getByRole("button", { name: /^Accept — a workable compromise$/ })
        .click();
    }
    await expect(
      host.getByRole("button", { name: "Resolve fairly" }),
    ).toBeEnabled({ timeout: 10_000 });
    await host.getByRole("button", { name: "Resolve fairly" }).click();

    await expect(host.getByTestId("connected-result")).toContainText(
      "Garden Table",
    );
    await expect(guest.getByTestId("connected-result")).toContainText(
      "Garden Table",
      { timeout: 10_000 },
    );
    await guest.reload();
    await expect(guest.getByTestId("connected-result")).toContainText(
      "Garden Table",
    );
    const dimensions = await host.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
    expect(roomErrors).toEqual([]);
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});

test("renders expiry as a terminal connected-room state", async ({ page }) => {
  let expired = false;
  await page.route("**/api/v1/rooms**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith("/recovery/redeem") && request.method() === "POST") {
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(projection()),
      });
    }
    if (path.endsWith("/projection")) {
      expired = true;
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(projection({ phase: "expired" })),
      });
    }
    return route.fallback();
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Recover" }).click();
  await page.getByLabel("Room ID").fill("room_connected_state_0001");
  await page
    .getByLabel("One-time recovery code")
    .fill("hr1.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
  await page.getByRole("button", { name: "Restore host access" }).click();
  await page.getByRole("button", { name: "Sync now" }).click();

  expect(expired).toBe(true);
  await expect(page.getByTestId("connected-expired")).toContainText(
    "This temporary room has expired.",
  );
  await expect(
    page.getByRole("button", { name: "Lock roster and begin voting" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Create recovery code" }),
  ).toHaveCount(0);
});

test("keeps denial indistinguishable from missing room access", async ({
  page,
}) => {
  let denied = false;
  await page.route("**/api/v1/rooms**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/v1/rooms/join") {
      return route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify(
          projection({ role: "participant", participantStatus: "pending" }),
        ),
      });
    }
    if (path.endsWith("/projection")) {
      denied = true;
      return route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({
          protocolVersion: "1.0.0",
          code: "unauthorized-or-missing",
        }),
      });
    }
    return route.fallback();
  });

  await page.goto("/?join=r1.AAAAAAAAAAAAAAAAAAAAAA");
  await page.getByLabel("Your name").fill("Sam");
  await page.getByRole("button", { name: "Ask to join" }).click();
  await expect(page.getByText("Waiting for the host")).toBeVisible();
  await expect(page.getByLabel("Private room code")).toHaveValue(
    "r1.AAAAAAAAAAAAAAAAAAAAAA",
    { timeout: 6_000 },
  );
  expect(denied).toBe(true);
  await expect(page.getByText(/previous access ended/i)).toBeVisible();
});

test("restores host access without retaining the recovery code", async ({
  page,
}) => {
  await page.route("**/api/v1/rooms/**/projection", async (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(projection()),
    }),
  );
  await page.route("**/api/v1/rooms/**/recovery/redeem", async (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(projection()),
    }),
  );

  await page.goto("/");
  await page.getByRole("button", { name: "Recover" }).click();
  await page.getByLabel("Room ID").fill("room_connected_state_0001");
  await page
    .getByLabel("One-time recovery code")
    .fill("hr1.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
  await page.getByRole("button", { name: "Restore host access" }).click();

  await expect(page.getByText("Hosting as")).toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    "Host access restored on this browser.",
  );
  await page.reload();
  await expect(page.getByText("Hosting as")).toBeVisible();
  expect(page.url()).not.toContain("hr1.");
  await page.goto("/");
  await page.getByRole("button", { name: "Recover" }).click();
  await expect(page.getByLabel("One-time recovery code")).toHaveValue("");
});

test("reflects a participant departure from committed room state", async ({
  page,
}) => {
  let left = false;
  await page.route("**/api/v1/rooms**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/v1/rooms/join") {
      return route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify(projection({ role: "participant" })),
      });
    }
    if (path.endsWith("/commands") && request.method() === "POST") {
      left = true;
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(
          projection({ role: "participant", participantStatus: "left" }),
        ),
      });
    }
    return route.fallback();
  });

  await page.goto("/?join=r1.AAAAAAAAAAAAAAAAAAAAAA");
  await page.getByLabel("Your name").fill("Sam");
  await page.getByRole("button", { name: "Ask to join" }).click();
  await page.getByRole("button", { name: "Leave room" }).click();

  expect(left).toBe(true);
  await expect(page.getByText("left", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Leave room" })).toHaveCount(0);
});

test("keeps connected entry keyboard-operable and responsive", async ({
  page,
}) => {
  await page.goto("/");
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  }

  await page.getByRole("button", { name: "Create", exact: true }).focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "Join", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Private room code")).toBeFocused();
});

test("honors reduced motion in the connected interface", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect
    .poll(() =>
      page.evaluate(
        () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      ),
    )
    .toBe(true);
  const duration = await page
    .getByRole("button", { name: "Join" })
    .evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(Number.parseFloat(duration)).toBeLessThanOrEqual(0.00001);
});
