"use client";

import {
  ROOM_PROTOCOL_VERSION,
  type Preference,
  type RoomCommand,
  type RoomProjection,
  type RoomProtocolError,
  type RoomRole,
} from "@consensus/domain";
import { useMemo, useState } from "react";

type Actor = { memberId: string; role: RoomRole; nextSequence: number };
type RoomState = { room: RoomProjection; actor: Actor };
type EntryMode = "create" | "join" | "recover";

const starterCandidates = [
  "Garden Table",
  "Night Noodle",
  "Harbor Kitchen",
  "Cellar Club",
].join("\n");

const requestJson = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = (await response.json()) as T | RoomProtocolError;
  if (!response.ok) throw body;
  return body as T;
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
    return "Someone updated the room first. Refresh, then try again.";
  if (code === "unauthorized-or-missing")
    return "That room is unavailable or this browser no longer has access.";
  return "The room could not be updated. Refresh and try again.";
};

export function ConnectedRoom({
  initialLocator = "",
}: {
  initialLocator?: string;
}) {
  const [mode, setMode] = useState<EntryMode>(
    initialLocator ? "join" : "create",
  );
  const [title, setTitle] = useState("Friday dinner");
  const [displayName, setDisplayName] = useState("");
  const [targetAt, setTargetAt] = useState("");
  const [candidateText, setCandidateText] = useState(starterCandidates);
  const [locator, setLocator] = useState(initialLocator);
  const [recoverRoomId, setRecoverRoomId] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [issuedRecovery, setIssuedRecovery] = useState("");
  const [invitation, setInvitation] = useState("");
  const [state, setState] = useState<RoomState | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const me = useMemo(
    () =>
      state?.room.participants.find(({ id }) => id === state.actor.memberId) ??
      null,
    [state],
  );

  const run = async (operation: () => Promise<void>) => {
    setBusy(true);
    setNotice("");
    try {
      await operation();
    } catch (error) {
      setNotice(messageFor(error));
    } finally {
      setBusy(false);
    }
  };

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
      setState({ room: created.room, actor: created.actor });
      setInvitation(created.invitation.locator);
    });

  const joinRoom = () =>
    run(async () => {
      setState(
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
      setState(
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
      setState(
        await requestJson<RoomState>(
          `/api/v1/rooms/${state.room.roomId}/projection`,
        ),
      );
    });

  const command = (
    type: RoomCommand["type"],
    payload: RoomCommand["payload"],
  ) =>
    state &&
    run(async () => {
      const nonce = crypto.randomUUID();
      setState(
        await requestJson<RoomState>(
          `/api/v1/rooms/${state.room.roomId}/commands`,
          {
            method: "POST",
            body: JSON.stringify({
              protocolVersion: ROOM_PROTOCOL_VERSION,
              commandId: `command_${nonce}`,
              idempotencyKey: `browser:${nonce}`,
              roomId: state.room.roomId,
              expectedRevision: state.room.revision,
              sequence: state.actor.nextSequence,
              issuedAt: new Date().toISOString(),
              actor: { memberId: state.actor.memberId, role: state.actor.role },
              type,
              payload,
            }),
          },
        ),
      );
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

  return (
    <section className="room-shell connected-room" aria-labelledby="room-title">
      <div className="connected-room__topline">
        <div>
          <p className="section-kicker">Milestone 0.3 · connected room</p>
          <h2 id="room-title">{state.room.title}</h2>
        </div>
        <span className="room-status">{state.room.phase}</span>
      </div>
      <div className="connected-room__identity">
        <span>{state.actor.role === "host" ? "Hosting as" : "Joining as"}</span>
        <strong>{me?.displayName ?? "Room member"}</strong>
        <span>Revision {state.room.revision}</span>
      </div>

      {state.actor.role === "host" && invitation ? (
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

      {me?.status === "pending" ? (
        <div className="waiting-card" role="status">
          <span className="waiting-pulse" aria-hidden="true" />
          <div>
            <strong>Waiting for the host</strong>
            <p>You are in the lobby. Ask the host to admit you.</p>
          </div>
        </div>
      ) : null}

      {!state.room.rosterLocked ? (
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
              Refresh
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
              <p className="section-kicker">
                Option {(myProgress?.completed ?? 0) + 1} of{" "}
                {activeCandidates.length}
              </p>
              <h3>{nextCandidate.name}</h3>
              <p>How well does this work for you?</p>
              <div className="vote-actions">
                <button
                  type="button"
                  className="vote-prefer"
                  disabled={busy}
                  onClick={() => submitVote("prefer")}
                >
                  Prefer
                </button>
                <button
                  type="button"
                  className="vote-accept"
                  disabled={busy}
                  onClick={() => submitVote("accept")}
                >
                  Accept
                </button>
                <button
                  type="button"
                  className="vote-avoid"
                  disabled={busy}
                  onClick={() => submitVote("avoid")}
                >
                  Avoid
                </button>
              </div>
            </>
          ) : (
            <div role="status">
              <p className="section-kicker">Ballot submitted</p>
              <h3>Waiting for the group.</h3>
              <p>Your private choices are saved. Refresh to see progress.</p>
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
              Refresh progress
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
          <p className="section-kicker">The group has a result</p>
          <h3>{winner?.name ?? "No safe result"}</h3>
          <p>
            {winner
              ? `Selected from ${activeCandidates.length} eligible options after every locked voter completed a ballot.`
              : "No option passed the room's safety and completion rules."}
          </p>
          <small>Decision ruleset {state.room.decision?.rulesetVersion}</small>
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

      {state.actor.role === "host" ? (
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

      {state.actor.role === "participant" &&
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
