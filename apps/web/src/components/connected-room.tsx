"use client";

import {
  ROOM_PROTOCOL_VERSION,
  type RoomUpdateEvent,
  type Preference,
  type RoomCommand,
} from "@consensus/domain";
import Image from "next/image";
import {
  reconcileRoom,
  requestRoomJson as requestJson,
  isUncertainRoomError,
  type RoomState,
} from "@/lib/room-session";
import {
  createRoomSyncState,
  classifyRoomUpdate,
  nextRoomPollDelayMs,
  reduceRoomSync,
  roomSyncCopy,
} from "@/lib/room-sync";
import {
  connectRoomEventHints,
  type RoomEventConnection,
} from "@/lib/room-event-client";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type PointerEvent,
} from "react";

type EntryMode = "create" | "join" | "recover";

const starterCandidates = [
  "Garden Table",
  "Night Noodle",
  "Harbor Kitchen",
  "Cellar Club",
].join("\n");

const connectedMedia: Record<
  string,
  { src: string; alt: string; vibe: string; highlights: readonly string[] }
> = {
  "garden table": {
    src: "/fixtures/garden-table.png",
    alt: "Illustrative seasonal plates in a plant-filled dining room",
    vibe: "Calm · plant-forward · date-night",
    highlights: ["Seasonal plates", "Quiet tables", "Group-friendly"],
  },
  "night noodle": {
    src: "/fixtures/night-noodle.png",
    alt: "Illustrative noodle bowl at a colorful evening counter",
    vibe: "Lively · quick · late-night",
    highlights: ["Flexible bowls", "Fast service", "Big flavors"],
  },
  "harbor kitchen": {
    src: "/fixtures/harbor-kitchen.png",
    alt: "Illustrative shared meal beside a waterfront window",
    vibe: "Relaxed · roomy · waterfront",
    highlights: ["Comfort plates", "Group tables", "Bright room"],
  },
  "cellar club": {
    src: "/fixtures/cellar-club.png",
    alt: "Illustrative candlelit plates in a brick cellar dining room",
    vibe: "Intimate · tasting menu · moody",
    highlights: ["Small plates", "Candlelit", "Special occasion"],
  },
};

const messageFor = (error: unknown) => {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "";
  if (code === "temporarily-unavailable")
    return "Connected rooms are not enabled in this environment yet.";
  if (code === "rate-limited")
    return "Too many attempts. Wait a moment and try again.";
  if (code === "room-locked") return "This room is locked for that action.";
  if (code === "room-expired") return "This temporary room has expired.";
  if (code === "stale-revision" || code === "sequence-conflict")
    return "Someone updated the room first. Sync, then try again.";
  if (code === "unauthorized-or-missing")
    return "That room is unavailable or this browser no longer has access.";
  return "The room could not be updated. Sync and try again.";
};

const isUnavailableRoomError = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  String(error.code) === "unauthorized-or-missing";

export function ConnectedRoom({
  initialLocator = "",
  initialRoomId = "",
}: {
  initialLocator?: string;
  initialRoomId?: string;
}) {
  const [mode, setMode] = useState<EntryMode>(
    initialLocator ? "join" : "create",
  );
  const [title, setTitle] = useState("Friday dinner");
  const [displayName, setDisplayName] = useState("");
  const [targetAt, setTargetAt] = useState("");
  const [candidateText, setCandidateText] = useState(starterCandidates);
  const [newCandidateName, setNewCandidateName] = useState("");
  const [locator, setLocator] = useState(initialLocator);
  const [recoverRoomId, setRecoverRoomId] = useState(initialRoomId);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [issuedRecovery, setIssuedRecovery] = useState("");
  const [invitation, setInvitation] = useState(initialLocator);
  const [state, setState] = useState<RoomState | null>(null);
  const stateRef = useRef<RoomState | null>(null);
  const [working, setBusy] = useState(false);
  const [retryPending, setRetryPending] = useState(false);
  const pendingCommand = useRef<{
    body: string;
    roomId: string;
    onAccepted?: () => void;
  } | null>(null);
  const [resuming, setResuming] = useState(Boolean(initialRoomId));
  const [resumeFailed, setResumeFailed] = useState(false);
  const [syncState, dispatchSync] = useReducer(reduceRoomSync, undefined, () =>
    createRoomSyncState(),
  );
  const busy = working || retryPending || syncState.mode === "offline";
  const operationPending = useRef(false);
  const [notice, setNotice] = useState("");
  const [dragX, setDragX] = useState(0);
  const dragStartX = useRef<number | null>(null);

  const adopt = useCallback((next: RoomState) => {
    if (!stateRef.current) return;
    const merged = reconcileRoom(stateRef.current, next);
    stateRef.current = merged;
    setState(merged);
    dispatchSync({
      type: "projection-confirmed",
      revision: merged.room.revision,
      terminal: merged.room.phase === "expired",
    });
  }, []);

  const enterRoom = (next: RoomState, invite = locator) => {
    stateRef.current = next;
    setState(next);
    dispatchSync({
      type: "projection-confirmed",
      revision: next.room.revision,
      terminal: next.room.phase === "expired",
    });
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("room", next.room.roomId);
    if (invite) url.searchParams.set("join", invite);
    window.history.replaceState(null, "", url);
  };

  const me = useMemo(
    () =>
      state?.room.participants.find(({ id }) => id === state.actor.memberId) ??
      null,
    [state],
  );

  const run = async (operation: () => Promise<void>) => {
    if (operationPending.current) return;
    operationPending.current = true;
    setBusy(true);
    setNotice("");
    try {
      await operation();
    } catch (error) {
      setNotice(messageFor(error));
    } finally {
      operationPending.current = false;
      setBusy(false);
    }
  };

  const returnToJoin = useCallback(() => {
    const previous = stateRef.current;
    stateRef.current = null;
    pendingCommand.current = null;
    setRetryPending(false);
    dispatchSync({ type: "command-settled" });
    setState(null);
    setMode(previous?.actor.role === "host" ? "recover" : "join");
    if (previous) setRecoverRoomId(previous.room.roomId);
    const url = new URL(window.location.href);
    url.searchParams.delete("room");
    window.history.replaceState(null, "", url);
    setNotice(
      previous?.actor.role === "host"
        ? "Host access ended. Use a previously saved recovery code to restore access."
        : "Your previous access ended. Use this invite to ask the host to admit you again.",
    );
  }, []);

  const loadProjection = useCallback(
    async (roomId: string) =>
      requestJson<RoomState>(
        `/api/v1/rooms/${encodeURIComponent(roomId)}/projection`,
      ),
    [],
  );

  useEffect(() => {
    if (!initialRoomId) return;
    let disposed = false;
    void loadProjection(initialRoomId)
      .then((next) => {
        if (disposed) return;
        stateRef.current = next;
        setState(next);
        dispatchSync({
          type: "projection-confirmed",
          revision: next.room.revision,
          terminal: next.room.phase === "expired",
        });
        setResumeFailed(false);
        setResuming(false);
      })
      .catch((error: unknown) => {
        if (disposed) return;
        setResuming(false);
        if (isUnavailableRoomError(error)) returnToJoin();
        else setResumeFailed(true);
      });
    return () => {
      disposed = true;
    };
  }, [initialRoomId, loadProjection, returnToJoin]);

  const createRoom = () =>
    run(async () => {
      const candidateNames = candidateText
        .split("\n")
        .map((name) => name.trim())
        .filter(Boolean);
      const created = await requestJson<
        RoomState & { invitation: { locator: string; expiresAt: string } }
      >("/api/v1/rooms", {
        method: "POST",
        body: JSON.stringify({
          protocolVersion: ROOM_PROTOCOL_VERSION,
          title,
          hostDisplayName: displayName,
          targetAt: new Date(targetAt).toISOString(),
          candidateNames,
        }),
      });
      enterRoom(
        { room: created.room, actor: created.actor },
        created.invitation.locator,
      );
      setInvitation(created.invitation.locator);
    });

  const joinRoom = () =>
    run(async () => {
      enterRoom(
        await requestJson<RoomState>("/api/v1/rooms/join", {
          method: "POST",
          body: JSON.stringify({
            protocolVersion: ROOM_PROTOCOL_VERSION,
            locator,
            displayName,
          }),
        }),
      );
    });

  const recoverHost = () =>
    run(async () => {
      enterRoom(
        await requestJson<RoomState>(
          `/api/v1/rooms/${encodeURIComponent(recoverRoomId.trim())}/recovery/redeem`,
          {
            method: "POST",
            body: JSON.stringify({
              protocolVersion: ROOM_PROTOCOL_VERSION,
              recoveryCode,
            }),
          },
        ),
      );
      setRecoveryCode("");
      setNotice("Host access restored on this browser.");
    });

  const refresh = () =>
    state &&
    run(async () => {
      try {
        adopt(await loadProjection(state.room.roomId));
      } catch (error) {
        if (isUnavailableRoomError(error)) {
          returnToJoin();
          return;
        }
        throw error;
      }
    });

  const sendPendingCommand = async () => {
    const pending = pendingCommand.current;
    if (!pending) return;
    try {
      const next = await requestJson<RoomState>(
        `/api/v1/rooms/${pending.roomId}/commands`,
        {
          method: "POST",
          body: pending.body,
        },
      );
      if (pendingCommand.current !== pending) return;
      adopt(next);
      pendingCommand.current = null;
      setRetryPending(false);
      dispatchSync({ type: "command-settled" });
      pending.onAccepted?.();
    } catch (error) {
      if (pendingCommand.current !== pending) return;
      if (isUncertainRoomError(error)) {
        setRetryPending(true);
        dispatchSync({ type: "command-uncertain" });
        setNotice(
          "Delivery is uncertain. Retry the same action to confirm it safely; do not start another action.",
        );
        return;
      }
      pendingCommand.current = null;
      setRetryPending(false);
      dispatchSync({ type: "command-settled" });
      if (isUnavailableRoomError(error)) returnToJoin();
      else {
        try {
          adopt(await loadProjection(pending.roomId));
        } catch {
          /* Polling reports reconnection state. */
        }
        throw error;
      }
    }
  };

  const command = (
    type: RoomCommand["type"],
    payload: RoomCommand["payload"],
    onAccepted?: () => void,
  ) =>
    state &&
    syncState.mode !== "offline" &&
    !pendingCommand.current &&
    run(async () => {
      const nonce = crypto.randomUUID();
      const current = stateRef.current;
      if (!current) return;
      pendingCommand.current = {
        roomId: current.room.roomId,
        onAccepted,
        body: JSON.stringify({
          protocolVersion: ROOM_PROTOCOL_VERSION,
          commandId: `command_${nonce}`,
          idempotencyKey: `browser:${nonce}`,
          roomId: current.room.roomId,
          expectedRevision: current.room.revision,
          sequence: current.actor.nextSequence,
          issuedAt: new Date().toISOString(),
          actor: { memberId: current.actor.memberId, role: current.actor.role },
          type,
          payload,
        }),
      };
      dispatchSync({ type: "command-started" });
      await sendPendingCommand();
    });

  const createRecovery = () =>
    state &&
    run(async () => {
      const recovery = await requestJson<{
        recoveryCode: string;
        expiresAt: string;
      }>(`/api/v1/rooms/${state.room.roomId}/recovery`, {
        method: "POST",
        body: JSON.stringify({ protocolVersion: ROOM_PROTOCOL_VERSION }),
      });
      setIssuedRecovery(recovery.recoveryCode);
      setNotice("Save this one-time recovery code before continuing.");
    });

  const createCandidate = () => {
    const name = newCandidateName.trim();
    if (!name) return;
    command("candidate.create", { name }, () => setNewCandidateName(""));
  };

  const activeRoomId = state?.room.roomId;
  const terminal = state?.room.phase === "expired";
  useEffect(() => {
    if (!activeRoomId || terminal) return;

    let disposed = false;
    let syncing = false;
    let failures = 0;
    let timer: number;
    const sync = async () => {
      if (document.visibilityState === "hidden" || syncing) return;
      window.clearTimeout(timer);
      syncing = true;
      dispatchSync({ type: "reconcile-started" });
      try {
        const next = await loadProjection(activeRoomId);
        if (!disposed) {
          adopt(next);
          failures = 0;
        }
      } catch (error) {
        if (!disposed) {
          if (isUnavailableRoomError(error)) returnToJoin();
          else {
            failures += 1;
            dispatchSync({ type: "sync-failed" });
          }
        }
      } finally {
        syncing = false;
        if (!disposed)
          timer = window.setTimeout(
            syncWhenVisible,
            nextRoomPollDelayMs(
              failures,
              Math.random(),
              syncState.transport === "connected",
            ),
          );
      }
    };
    const syncWhenVisible = () => void sync();
    const markOffline = () => dispatchSync({ type: "browser-offline" });
    const resumeOnline = () => {
      dispatchSync({ type: "browser-online" });
      syncWhenVisible();
    };
    timer = window.setTimeout(syncWhenVisible, 2_500);
    if (!navigator.onLine) markOffline();
    document.addEventListener("visibilitychange", syncWhenVisible);
    window.addEventListener("offline", markOffline);
    window.addEventListener("online", resumeOnline);
    return () => {
      disposed = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", syncWhenVisible);
      window.removeEventListener("offline", markOffline);
      window.removeEventListener("online", resumeOnline);
    };
  }, [
    activeRoomId,
    terminal,
    loadProjection,
    returnToJoin,
    adopt,
    syncState.transport,
  ]);

  useEffect(() => {
    if (!activeRoomId || terminal) return;
    const controller = new AbortController();
    let disposed = false;
    let disconnect = () => {};
    let reconciling = false;
    let desiredRevision = 0;
    let connecting = false;
    let connected = false;
    let connectFailures = 0;
    let retryTimer: number | undefined;
    const onHint = (event: RoomUpdateEvent) => {
      const confirmed = stateRef.current?.room.revision ?? 0;
      if (classifyRoomUpdate(event, activeRoomId, confirmed) === "ignore")
        return;
      desiredRevision = Math.max(desiredRevision, event.revision);
      dispatchSync({ type: "hint-received", revision: event.revision });
      if (reconciling) return;
      reconciling = true;
      dispatchSync({ type: "reconcile-started" });
      void (async () => {
        try {
          // One coalesced follow-up covers hints arriving during an earlier
          // fetch; bounded polling handles later or unavailable revisions.
          for (let attempt = 0; attempt < 2 && !disposed; attempt += 1) {
            const next = await loadProjection(activeRoomId);
            if (disposed) return;
            adopt(next);
            if (next.room.revision >= desiredRevision) break;
          }
        } catch {
          if (!disposed) dispatchSync({ type: "sync-failed" });
        } finally {
          reconciling = false;
        }
      })();
    };
    const onConnection = (connection: RoomEventConnection) => {
      if (disposed) return;
      dispatchSync({
        type:
          connection === "connected"
            ? "transport-connected"
            : connection === "disabled"
              ? "transport-disabled"
              : "transport-interrupted",
      });
      if (connection === "connected") {
        void loadProjection(activeRoomId)
          .then((next) => {
            if (!disposed) adopt(next);
          })
          .catch(() => {
            if (!disposed) dispatchSync({ type: "sync-failed" });
          });
      }
    };
    const connect = () => {
      if (disposed || connecting || connected || !navigator.onLine) return;
      window.clearTimeout(retryTimer);
      connecting = true;
      void connectRoomEventHints(
        activeRoomId,
        onHint,
        onConnection,
        controller.signal,
      )
        .then((stop) => {
          connecting = false;
          if (disposed) stop();
          else {
            connected = true;
            connectFailures = 0;
            disconnect = stop;
          }
        })
        .catch(() => {
          connecting = false;
          if (disposed) return;
          // Keep polling while retrying a failed token or subscription.
          dispatchSync({ type: "transport-interrupted" });
          connectFailures += 1;
          retryTimer = window.setTimeout(
            connect,
            nextRoomPollDelayMs(connectFailures, Math.random()),
          );
        });
    };
    const reconnectWhenOnline = () => {
      if (!connected) connect();
    };
    window.addEventListener("online", reconnectWhenOnline);
    connect();
    return () => {
      disposed = true;
      controller.abort();
      window.clearTimeout(retryTimer);
      window.removeEventListener("online", reconnectWhenOnline);
      disconnect();
    };
  }, [activeRoomId, terminal, loadProjection, adopt]);

  const shareRoom = async () => {
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("join", invitation);
    try {
      await navigator.clipboard.writeText(url.toString());
      setNotice("Private join link copied.");
    } catch {
      setNotice(`Share this room code: ${invitation}`);
    }
  };

  if (!state && (resuming || resumeFailed)) {
    return (
      <section className="room-shell connected-entry" aria-label="Resume room">
        <h2>
          {resuming
            ? "Reconnecting to your room…"
            : "Your room could not be reached"}
        </h2>
        <p role="status">
          {resuming
            ? "Checking this browser’s existing access. No new participant is being created."
            : "Your access has not been replaced. Check your connection, then retry."}
        </p>
        {resumeFailed && (
          <button className="primary" onClick={() => window.location.reload()}>
            Retry connection
          </button>
        )}
      </section>
    );
  }

  if (!state) {
    const candidateCount = candidateText
      .split("\n")
      .map((name) => name.trim())
      .filter(Boolean).length;
    return (
      <section
        className="room-shell connected-entry"
        aria-labelledby="connected-title"
      >
        <p className="section-kicker">Milestone 0.3 · secure rooms</p>
        <h2 id="connected-title">Start together. No account required.</h2>
        <p className="connected-entry__copy">
          Create a temporary room, join by private link, or recover host access.
        </p>

        <div className="entry-toggle" role="group" aria-label="Room entry mode">
          {(["create", "join", "recover"] as const).map((entryMode) => (
            <button
              key={entryMode}
              type="button"
              className={mode === entryMode ? "is-active" : ""}
              aria-pressed={mode === entryMode}
              onClick={() => setMode(entryMode)}
            >
              {entryMode === "create"
                ? "Create"
                : entryMode === "join"
                  ? "Join"
                  : "Recover"}
            </button>
          ))}
        </div>

        <div className="connected-form">
          {mode === "create" ? (
            <>
              <label>
                What are you deciding?
                <input
                  value={title}
                  maxLength={80}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>
              <label>
                When?
                <input
                  type="datetime-local"
                  value={targetAt}
                  onChange={(event) => setTargetAt(event.target.value)}
                />
              </label>
              <label>
                Starter options · one per line
                <textarea
                  value={candidateText}
                  rows={4}
                  maxLength={1_200}
                  onChange={(event) => setCandidateText(event.target.value)}
                />
                <small>
                  {candidateCount}/12 manual options. These are illustrative,
                  not live venue data.
                </small>
              </label>
            </>
          ) : mode === "join" ? (
            <label>
              Private room code
              <input
                value={locator}
                autoComplete="off"
                onChange={(event) => setLocator(event.target.value)}
              />
            </label>
          ) : (
            <>
              <label>
                Room ID
                <input
                  value={recoverRoomId}
                  autoComplete="off"
                  onChange={(event) => setRecoverRoomId(event.target.value)}
                />
              </label>
              <label>
                One-time recovery code
                <input
                  value={recoveryCode}
                  autoComplete="off"
                  onChange={(event) => setRecoveryCode(event.target.value)}
                />
              </label>
            </>
          )}
          {mode !== "recover" ? (
            <label>
              Your name
              <input
                value={displayName}
                maxLength={48}
                autoComplete="name"
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </label>
          ) : null}
          <button
            className="primary"
            type="button"
            disabled={
              busy ||
              (mode === "recover"
                ? !recoverRoomId.trim() || !recoveryCode.trim()
                : !displayName.trim() ||
                  (mode === "create"
                    ? !title.trim() ||
                      !targetAt ||
                      candidateCount < 2 ||
                      candidateCount > 12
                    : !locator.trim()))
            }
            onClick={
              mode === "create"
                ? createRoom
                : mode === "join"
                  ? joinRoom
                  : recoverHost
            }
          >
            {busy
              ? "Connecting…"
              : mode === "create"
                ? "Create temporary room"
                : mode === "join"
                  ? "Ask to join"
                  : "Restore host access"}
          </button>
        </div>
        {notice ? (
          <p className="connected-notice" role="status">
            {notice}
          </p>
        ) : null}
        <p className="privacy-note">
          Room authority stays in a secure HTTP-only cookie. Join and recovery
          codes are never stored in browser storage.
        </p>
      </section>
    );
  }

  const pending = state.room.participants.filter(
    ({ status }) => status === "pending",
  );
  const active = state.room.participants.filter(
    ({ status }) => status === "active",
  );
  const activeCandidates = state.room.candidates.filter(
    ({ status }) => status === "active",
  );
  const syncLabel =
    syncState.mode === "terminal"
      ? roomSyncCopy.terminal
      : retryPending
        ? "Action pending · retry safely"
        : syncState.pendingCommand
          ? "Saving action…"
          : roomSyncCopy[syncState.mode];
  const myProgress = state.room.ballotProgress.find(
    ({ participantId }) => participantId === state.actor.memberId,
  );
  const nextCandidate = activeCandidates[myProgress?.completed ?? 0];
  const votingComplete =
    state.room.ballotProgress.length > 0 &&
    state.room.ballotProgress.every(
      ({ completed, total }) => completed >= total,
    );
  const winner = state.room.candidates.find(
    ({ id }) => id === state.room.decision?.winnerCandidateId,
  );
  const submitVote = (preference: Preference) =>
    nextCandidate &&
    command("vote.submit", {
      candidateId: nextCandidate.id,
      preference,
      mustPick: false,
    });
  const currentMedia = nextCandidate
    ? connectedMedia[nextCandidate.name.toLowerCase()]
    : undefined;
  const winnerMedia = winner
    ? connectedMedia[winner.name.toLowerCase()]
    : undefined;
  const startDrag = (event: PointerEvent<HTMLElement>) => {
    if (busy || operationPending.current || pendingCommand.current) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStartX.current = event.clientX;
  };
  const moveDrag = (event: PointerEvent<HTMLElement>) => {
    if (dragStartX.current === null) return;
    setDragX(Math.max(-130, Math.min(130, event.clientX - dragStartX.current)));
  };
  const endDrag = () => {
    if (dragStartX.current === null) return;
    const preference = dragX <= -85 ? "avoid" : dragX >= 85 ? "prefer" : null;
    dragStartX.current = null;
    setDragX(0);
    if (preference) submitVote(preference);
  };
  const cancelDrag = () => {
    dragStartX.current = null;
    setDragX(0);
  };

  return (
    <section className="room-shell connected-room" aria-labelledby="room-title">
      {(syncState.mode === "degraded" || syncState.mode === "offline") && (
        <p className="connected-notice" role="status">
          {syncState.mode === "offline"
            ? "You are offline. Confirmed room state remains visible; actions wait until you reconnect."
            : "Updates are delayed. Confirmed room state remains visible while automatic recovery continues."}
        </p>
      )}
      {retryPending && (
        <button
          className="primary"
          disabled={working || syncState.mode === "offline"}
          onClick={() => run(sendPendingCommand)}
        >
          Retry pending action
        </button>
      )}
      <div className="connected-room__topline">
        <div>
          <p className="section-kicker">Connected decision room</p>
          <h2 id="room-title">{state.room.title}</h2>
        </div>
        <div className="room-status-group">
          <span
            className={`sync-status sync-status--${syncState.mode}`}
            data-testid="room-sync-status"
          >
            <span aria-hidden="true" />
            {syncLabel}
          </span>
          <span className="room-status">{state.room.phase}</span>
        </div>
      </div>
      <div className="connected-room__identity">
        <span>{state.actor.role === "host" ? "Hosting as" : "Joining as"}</span>
        <strong>{me?.displayName ?? "Room member"}</strong>
        <span>Revision {state.room.revision}</span>
      </div>

      {state.room.phase === "expired" ? (
        <div
          className="waiting-card"
          data-testid="connected-expired"
          role="status"
        >
          <div>
            <strong>This temporary room has expired.</strong>
            <p>
              Voting and roster changes are closed. Start a new room to decide
              together again.
            </p>
          </div>
        </div>
      ) : null}

      {state.room.phase !== "expired" &&
      state.actor.role === "host" &&
      invitation ? (
        <article className="invite-card">
          <p className="section-kicker">Invite without an account</p>
          <h3>Bring the group into this room.</h3>
          <code>{invitation}</code>
          <button className="primary" type="button" onClick={shareRoom}>
            Copy private join link
          </button>
          <p>The link locates the room but grants no voting authority.</p>
        </article>
      ) : null}

      {state.room.phase !== "expired" && me?.status === "pending" ? (
        <div className="waiting-card" role="status">
          <span className="waiting-pulse" aria-hidden="true" />
          <div>
            <strong>Waiting for the host</strong>
            <p>You are in the lobby. Ask the host to admit you.</p>
          </div>
        </div>
      ) : null}

      {state.room.phase !== "expired" && !state.room.rosterLocked ? (
        <div className="roster-board">
          <div className="panel-heading split-heading">
            <div>
              <p className="section-kicker">Room roster</p>
              <h3>{active.length} active</h3>
            </div>
            <button
              className="secondary"
              type="button"
              onClick={refresh}
              disabled={busy}
            >
              Sync now
            </button>
          </div>
          <ul className="connected-roster">
            {state.room.participants.map((participant) => (
              <li key={participant.id}>
                <span>
                  <strong>{participant.displayName}</strong>
                  <small>{participant.status}</small>
                </span>
                {state.actor.role === "host" &&
                participant.status === "pending" ? (
                  <span className="inline-actions">
                    <button
                      className="primary compact"
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        command("participant.approve", {
                          participantId: participant.id,
                        })
                      }
                    >
                      Admit
                    </button>
                    <button
                      className="secondary compact"
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        command("participant.remove", {
                          participantId: participant.id,
                        })
                      }
                    >
                      Deny
                    </button>
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          <div className="candidate-review-list">
            <p className="section-kicker">
              Options ({activeCandidates.length})
            </p>
            {state.room.candidates.map((candidate) => (
              <div key={candidate.id}>
                <span>{candidate.name}</span>
                {state.actor.role === "host" ? (
                  <button
                    className="text-button"
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      command(
                        candidate.status === "active"
                          ? "candidate.remove"
                          : "candidate.add",
                        { candidateId: candidate.id },
                      )
                    }
                  >
                    {candidate.status === "active" ? "Remove" : "Restore"}
                  </button>
                ) : (
                  <small>{candidate.status}</small>
                )}
              </div>
            ))}
            {state.actor.role === "host" ? (
              <form
                className="candidate-add-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  createCandidate();
                }}
              >
                <label htmlFor="connected-new-candidate">Add an option</label>
                <div>
                  <input
                    id="connected-new-candidate"
                    value={newCandidateName}
                    maxLength={100}
                    placeholder="e.g. Lantern Café"
                    onChange={(event) =>
                      setNewCandidateName(event.target.value)
                    }
                  />
                  <button
                    className="secondary compact"
                    type="submit"
                    disabled={busy || !newCandidateName.trim()}
                  >
                    Add
                  </button>
                </div>
                <small>
                  Host-added options have no venue details or photo yet.
                </small>
              </form>
            ) : null}
          </div>
          {state.actor.role === "host" && pending.length === 0 ? (
            <button
              className="primary"
              type="button"
              disabled={busy || activeCandidates.length < 2}
              onClick={() => command("roster.lock", {})}
            >
              Lock roster and begin voting
            </button>
          ) : null}
        </div>
      ) : null}

      {state.room.phase === "voting" && me?.status === "active" ? (
        <div className="connected-ballot" data-testid="connected-ballot">
          {nextCandidate ? (
            <>
              <div className="connected-progress">
                <span>{me.displayName}&apos;s picks</span>
                <strong>
                  {(myProgress?.completed ?? 0) + 1}/{activeCandidates.length}
                </strong>
              </div>
              <div className="connected-progress-track" aria-hidden="true">
                <span
                  style={{
                    width: `${((myProgress?.completed ?? 0) / activeCandidates.length) * 100}%`,
                  }}
                />
              </div>
              <p className="connected-swipe-hint">
                Swipe to decide—or use the buttons.
              </p>
              <article
                className="connected-profile-card"
                onPointerDown={startDrag}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={cancelDrag}
                style={{
                  transform: `translateX(${dragX}px) rotate(${dragX / 28}deg)`,
                }}
              >
                <div className="connected-profile-media">
                  {currentMedia ? (
                    <Image
                      src={currentMedia.src}
                      alt={currentMedia.alt}
                      fill
                      draggable={false}
                      priority
                      sizes="(max-width: 650px) 100vw, 480px"
                    />
                  ) : (
                    <div
                      className="connected-profile-placeholder"
                      data-testid="connected-custom-option-media"
                    >
                      <span aria-hidden="true">
                        {nextCandidate.name.slice(0, 1)}
                      </span>
                      <small>Host-added option</small>
                    </div>
                  )}
                  <div className="connected-fixture-label">
                    {currentMedia
                      ? "Illustrative fixture · confirm details"
                      : "Host-added · details to confirm"}
                  </div>
                  <div
                    className={`connected-swipe-stamp connected-pass ${dragX < -35 ? "is-visible" : ""}`}
                    aria-hidden="true"
                  >
                    PASS
                  </div>
                  <div
                    className={`connected-swipe-stamp connected-like ${dragX > 35 ? "is-visible" : ""}`}
                    aria-hidden="true"
                  >
                    LIKE
                  </div>
                  <div className="connected-profile-overlay">
                    <p>{currentMedia?.vibe ?? "Host-added option"}</p>
                    <h3>{nextCandidate.name}</h3>
                    <div className="connected-profile-chips">
                      {(
                        currentMedia?.highlights ?? [
                          "No image supplied",
                          "Confirm details",
                        ]
                      ).map((highlight) => (
                        <span key={highlight}>{highlight}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </article>
              <div
                className="connected-vote-dock"
                aria-label={`Vote on ${nextCandidate.name}`}
              >
                <button
                  type="button"
                  className="connected-vote connected-vote--avoid"
                  aria-label="Avoid — preference, not a safety veto"
                  disabled={busy}
                  onClick={() => submitVote("avoid")}
                >
                  <span>×</span>
                  <small>Avoid</small>
                </button>
                <button
                  type="button"
                  className="connected-vote connected-vote--accept"
                  aria-label="Accept — a workable compromise"
                  disabled={busy}
                  onClick={() => submitVote("accept")}
                >
                  <span>○</span>
                  <small>Accept</small>
                </button>
                <button
                  type="button"
                  className="connected-vote connected-vote--prefer"
                  aria-label="Prefer — a positive choice"
                  disabled={busy}
                  onClick={() => submitVote("prefer")}
                >
                  <span>♥</span>
                  <small>Prefer</small>
                </button>
              </div>
            </>
          ) : (
            <div role="status">
              <p className="section-kicker">Ballot submitted</p>
              <h3>Waiting for the group.</h3>
              <p>
                Your private choices are saved. The room updates automatically.
              </p>
            </div>
          )}
          <div className="ballot-progress-list">
            {state.room.ballotProgress.map((progress) => {
              const participant = state.room.participants.find(
                ({ id }) => id === progress.participantId,
              );
              return (
                <span key={progress.participantId}>
                  {participant?.displayName ?? "Member"}: {progress.completed}/
                  {progress.total}
                </span>
              );
            })}
          </div>
          <div className="connected-room__actions">
            <button
              className="secondary"
              type="button"
              onClick={refresh}
              disabled={busy}
            >
              Sync now
            </button>
            {state.actor.role === "host" ? (
              <button
                className="primary"
                type="button"
                disabled={busy || !votingComplete}
                onClick={() => command("decision.resolve", {})}
              >
                Resolve fairly
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {state.room.phase === "resolved" ? (
        <div className="connected-result" data-testid="connected-result">
          <div className="connected-result-media">
            {winnerMedia ? (
              <Image
                src={winnerMedia.src}
                alt={winnerMedia.alt}
                fill
                sizes="(max-width: 650px) 100vw, 480px"
              />
            ) : (
              <span aria-hidden="true">{winner?.name.slice(0, 1) ?? "?"}</span>
            )}
            <div className="connected-result-badge">It&apos;s a match</div>
          </div>
          <div className="connected-result-copy">
            <p className="section-kicker">The group has a result</p>
            <h3>{winner?.name ?? "No safe result"}</h3>
            <p>
              {winner
                ? `Selected from ${activeCandidates.length} eligible options after every locked voter completed a ballot.`
                : "No option passed the room's safety and completion rules."}
            </p>
            <small>
              Decision ruleset {state.room.decision?.rulesetVersion}
            </small>
          </div>
          <div className="connected-room__actions">
            <button
              type="button"
              className="primary"
              disabled={busy}
              onClick={() => command("commitment.set", { committed: true })}
            >
              I’m in
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => command("commitment.set", { committed: false })}
            >
              I’m out
            </button>
          </div>
        </div>
      ) : null}

      {state.room.phase !== "expired" && state.actor.role === "host" ? (
        <details className="recovery-panel">
          <summary>Host recovery</summary>
          <p>
            Room ID: <code>{state.room.roomId}</code>
          </p>
          {issuedRecovery ? (
            <p>
              One-time code: <code>{issuedRecovery}</code>
            </p>
          ) : (
            <button
              className="secondary"
              type="button"
              disabled={busy}
              onClick={createRecovery}
            >
              Create recovery code
            </button>
          )}
        </details>
      ) : null}

      {state.room.phase !== "expired" &&
      state.actor.role === "participant" &&
      me?.status === "active" &&
      !state.room.rosterLocked ? (
        <button
          className="secondary"
          type="button"
          disabled={busy}
          onClick={() => command("participant.leave", {})}
        >
          Leave room
        </button>
      ) : null}
      {notice ? (
        <p className="connected-notice" role="status">
          {notice}
        </p>
      ) : null}
    </section>
  );
}
