import { afterEach, describe, expect, it, vi } from "vitest";
import { connectRoomEventHints } from "./room-event-client";
import { roomEventChannel } from "./room-event-channel";

const fake = vi.hoisted(() => ({
  constructed: 0,
  closed: 0,
  listener: null as null | ((message: { data?: unknown }) => void),
  connection: null as null | ((change: { current: string }) => void),
  subscribedChannel: "",
}));

vi.mock("ably", () => ({
  Realtime: class {
    constructor() {
      fake.constructed += 1;
    }
    connection = {
      on: (listener: (change: { current: string }) => void) => {
        fake.connection = listener;
      },
    };
    channels = {
      get: (channel: string) => {
        fake.subscribedChannel = channel;
        return {
          subscribe: async (
            _name: string,
            listener: (message: { data?: unknown }) => void,
          ) => {
            fake.listener = listener;
          },
          unsubscribe: () => {
            fake.listener = null;
          },
        };
      },
    };
    close() {
      fake.closed += 1;
    }
  },
}));

afterEach(() => {
  vi.unstubAllGlobals();
  fake.constructed = 0;
  fake.closed = 0;
  fake.listener = null;
  fake.connection = null;
  fake.subscribedChannel = "";
});

describe("room hint subscriber", () => {
  it("does not start a provider connection while delivery is disabled", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 204 }));
    const stop = await connectRoomEventHints(
      "room_12345678",
      vi.fn(),
      vi.fn(),
      new AbortController().signal,
    );
    stop();
    expect(fake.constructed).toBe(0);
  });

  it("subscribes only to its room and rejects malformed or foreign hints", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => ({
          keyName: "app.key",
          mac: "synthetic-mac",
          nonce: "synthetic-nonce",
          timestamp: 1_000,
          ttl: 60_000,
          capability: "{}",
        }),
      }),
    );
    const onHint = vi.fn();
    const onConnection = vi.fn();
    const stop = await connectRoomEventHints(
      "room_12345678",
      onHint,
      onConnection,
      new AbortController().signal,
    );
    expect(fake.subscribedChannel).toBe(roomEventChannel("room_12345678"));
    const event = {
      eventVersion: "1.0.0",
      eventId: "evt_12345678",
      roomId: "room_12345678",
      revision: 4,
      type: "room.updated",
      occurredAt: "2026-09-18T03:00:00.000Z",
    };
    fake.listener?.({ data: { ...event, roomId: "room_other_12345678" } });
    fake.listener?.({ data: { ...event, capability: "forbidden" } });
    fake.listener?.({ data: event });
    expect(onHint).toHaveBeenCalledExactlyOnceWith(event);
    fake.connection?.({ current: "disconnected" });
    expect(onConnection).toHaveBeenCalledWith("interrupted");
    stop();
    expect(fake.closed).toBe(1);
    expect(fake.listener).toBeNull();
  });

  it("fails safely when token issuance is denied", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ status: 404, ok: false }),
    );
    await expect(
      connectRoomEventHints(
        "room_12345678",
        vi.fn(),
        vi.fn(),
        new AbortController().signal,
      ),
    ).rejects.toThrow("Room notifications unavailable.");
    expect(fake.constructed).toBe(0);
  });

  it("rejects a successful HTTP response without a signed token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => ({ room: { revision: 1 } }),
      }),
    );
    await expect(
      connectRoomEventHints(
        "room_12345678",
        vi.fn(),
        vi.fn(),
        new AbortController().signal,
      ),
    ).rejects.toThrow("Room notifications unavailable.");
    expect(fake.constructed).toBe(0);
  });
});
