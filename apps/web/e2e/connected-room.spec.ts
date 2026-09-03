import {
  expect,
  test,
  type BrowserContext,
  type Route,
} from "@playwright/test";

type Participant = {
  id: string;
  displayName: string;
  status: "pending" | "active" | "left";
};

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
  const candidates = [
    { id: "candidate_garden", name: "Garden Table", status: "active" as const },
    { id: "candidate_noodle", name: "Night Noodle", status: "active" as const },
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
          payload: { participantId?: string };
        };
        if (command.type === "participant.approve") {
          const guest = participants.find(
            ({ id }) => id === command.payload.participantId,
          );
          if (guest) guest.status = "active";
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

  try {
    await host.goto("/");
    await host.getByLabel("When?").fill("2026-09-04T19:00");
    await host
      .getByLabel("Starter options · one per line")
      .fill("Garden Table\nNight Noodle");
    await host.getByLabel("Your name").fill("Maya");
    await host.getByRole("button", { name: "Create temporary room" }).click();
    await expect(host.getByText("r1.AAAAAAAAAAAAAAAAAAAAAA")).toBeVisible();

    await guest.goto("/?join=r1.AAAAAAAAAAAAAAAAAAAAAA");
    await guest.getByLabel("Your name").fill("Sam");
    await guest.getByRole("button", { name: "Ask to join" }).click();
    await expect(guest.getByText("Waiting for the host")).toBeVisible();

    await host.getByRole("button", { name: "Refresh" }).click();
    await host.getByRole("button", { name: "Admit" }).click();
    await guest.getByRole("button", { name: "Refresh" }).click();
    await expect(
      guest.locator(".connected-roster").getByText("Sam"),
    ).toBeVisible();

    await host
      .getByRole("button", { name: "Lock roster and begin voting" })
      .click();
    await guest.getByRole("button", { name: "Refresh" }).click();
    await host.getByRole("button", { name: "Prefer" }).click();
    await host.getByRole("button", { name: "Prefer" }).click();
    await guest.getByRole("button", { name: "Refresh progress" }).click();
    await guest.getByRole("button", { name: "Accept" }).click();
    await guest.getByRole("button", { name: "Accept" }).click();
    await host.getByRole("button", { name: "Refresh progress" }).click();
    await host.getByRole("button", { name: "Resolve fairly" }).click();
    await guest.getByRole("button", { name: "Refresh progress" }).click();

    await expect(host.getByTestId("connected-result")).toContainText(
      "Garden Table",
    );
    await expect(guest.getByTestId("connected-result")).toContainText(
      "Garden Table",
    );
    const dimensions = await host.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});
