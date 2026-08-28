"use client";

import {
  resolveDecision,
  type BallotChoice,
  type Candidate,
  type ConstraintEvidence,
  type DecisionResult,
  type Preference,
} from "@consensus/domain";
import Image from "next/image";
import { useMemo, useRef, useState, type PointerEvent } from "react";
import {
  buildSampleCandidates,
  candidateMapUrl,
  constraintOptions,
  hasErrors,
  MAX_CANDIDATES,
  MAX_PARTICIPANTS,
  MIN_CANDIDATES,
  MIN_PARTICIPANTS,
  parseSafeHttpUrl,
  selectedConstraints,
  type RoomSetup,
  validateRoomSetup,
} from "@/lib/decision-mvp";
import { formatDistance } from "@/lib/format";

type WorkflowStep = "setup" | "candidates" | "ballot" | "result";
type Ballots = Record<string, Record<string, BallotChoice>>;

interface BallotHistoryEntry {
  ballots: Ballots;
  participantIndex: number;
  candidateIndex: number;
}

interface ManualCandidateDraft {
  name: string;
  summary: string;
  distanceMeters: string;
  priceLabel: string;
  websiteUrl: string;
  evidence: Record<string, ConstraintEvidence>;
}

const initialSetup: RoomSetup = {
  title: "Friday dinner",
  targetAt: "2026-09-04T19:00",
  participants: ["Maya", "Jon", "Lee"],
  constraintIds: ["vegetarian", "step-free", "budget-30"],
};

const emptyManualDraft = (
  constraintIds: readonly string[],
): ManualCandidateDraft => ({
  name: "",
  summary: "",
  distanceMeters: "",
  priceLabel: "",
  websiteUrl: "",
  evidence: Object.fromEntries(
    constraintIds.map((id) => [id, "unknown" as const]),
  ),
});

const cloneBallots = (ballots: Ballots): Ballots =>
  Object.fromEntries(
    Object.entries(ballots).map(([participantId, choices]) => [
      participantId,
      { ...choices },
    ]),
  );

const participantId = (index: number) => `participant-${index + 1}`;

const fixtureMedia: Record<
  string,
  { src: string; alt: string; vibe: string; highlights: readonly string[] }
> = {
  "garden-table": {
    src: "/fixtures/garden-table.png",
    alt: "Illustrative seasonal vegetable plates in a plant-filled dining room",
    vibe: "Calm · plant-forward · date-night",
    highlights: ["Seasonal vegetables", "Shareable plates", "Quiet tables"],
  },
  "night-noodle": {
    src: "/fixtures/night-noodle.png",
    alt: "Illustrative bowl of spicy noodles at a colorful evening counter",
    vibe: "Lively · quick · late-night",
    highlights: ["Handmade noodles", "Flexible bowls", "Fast service"],
  },
  "harbor-kitchen": {
    src: "/fixtures/harbor-kitchen.png",
    alt: "Illustrative shared lunch spread beside a bright waterfront window",
    vibe: "Relaxed · roomy · waterfront",
    highlights: ["Comfort plates", "Group tables", "Clear menu"],
  },
  "cellar-club": {
    src: "/fixtures/cellar-club.png",
    alt: "Illustrative candlelit tasting plates in a brick cellar dining room",
    vibe: "Intimate · tasting menu · moody",
    highlights: ["Small plates", "Candlelit room", "Limited menu"],
  },
};

export function DecisionWorkflow() {
  const [step, setStep] = useState<WorkflowStep>("setup");
  const [setup, setSetup] = useState<RoomSetup>(initialSetup);
  const [setupErrors, setSetupErrors] = useState(
    {} as ReturnType<typeof validateRoomSetup>,
  );
  const [candidates, setCandidates] = useState<Candidate[]>(() =>
    buildSampleCandidates(initialSetup.constraintIds),
  );
  const [manualDraft, setManualDraft] = useState<ManualCandidateDraft>(() =>
    emptyManualDraft(initialSetup.constraintIds),
  );
  const [manualError, setManualError] = useState("");
  const [ballots, setBallots] = useState<Ballots>({});
  const [history, setHistory] = useState<BallotHistoryEntry[]>([]);
  const [participantIndex, setParticipantIndex] = useState(0);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [strongestPick, setStrongestPick] = useState(false);
  const [decision, setDecision] = useState<DecisionResult | null>(null);
  const [committedIds, setCommittedIds] = useState<string[]>([]);
  const [shareStatus, setShareStatus] = useState("");
  const [dragX, setDragX] = useState(0);
  const dragStartX = useRef<number | null>(null);
  const dragCurrentX = useRef(0);

  const constraints = useMemo(
    () => selectedConstraints(setup.constraintIds),
    [setup.constraintIds],
  );
  const participants = setup.participants.map((name, index) => ({
    id: participantId(index),
    name: name.trim(),
  }));
  const currentParticipant = participants[participantIndex];
  const currentCandidate = candidates[candidateIndex];
  const winner =
    decision?.status === "decided"
      ? (candidates.find(({ id }) => id === decision.winnerCandidateId) ?? null)
      : null;
  const runnerUp =
    decision?.status === "decided"
      ? (candidates.find(({ id }) => id === decision.runnerUpCandidateId) ??
        null)
      : null;

  const updateParticipantCount = (count: number) => {
    const bounded = Math.min(
      MAX_PARTICIPANTS,
      Math.max(MIN_PARTICIPANTS, count),
    );
    setSetup((current) => ({
      ...current,
      participants: Array.from(
        { length: bounded },
        (_, index) => current.participants[index] ?? `Guest ${index + 1}`,
      ),
    }));
  };

  const toggleConstraint = (id: string) => {
    setSetup((current) => ({
      ...current,
      constraintIds: current.constraintIds.includes(id)
        ? current.constraintIds.filter((constraintId) => constraintId !== id)
        : [...current.constraintIds, id],
    }));
  };

  const beginCandidateReview = () => {
    const errors = validateRoomSetup(setup);
    setSetupErrors(errors);
    if (hasErrors(errors)) return;

    const normalizedSetup = {
      ...setup,
      title: setup.title.trim(),
      participants: setup.participants.map((name) => name.trim()),
    };
    setSetup(normalizedSetup);
    setCandidates(buildSampleCandidates(normalizedSetup.constraintIds));
    setManualDraft(emptyManualDraft(normalizedSetup.constraintIds));
    setStep("candidates");
  };

  const addManualCandidate = () => {
    setManualError("");
    if (candidates.length >= MAX_CANDIDATES) {
      setManualError(
        `A room can contain at most ${MAX_CANDIDATES} candidates.`,
      );
      return;
    }
    const name = manualDraft.name.trim();
    const summary = manualDraft.summary.trim();
    const distanceMeters = Number(manualDraft.distanceMeters);
    const websiteUrl = parseSafeHttpUrl(manualDraft.websiteUrl);
    if (name.length < 2 || name.length > 60) {
      setManualError("Use a candidate name between 2 and 60 characters.");
      return;
    }
    if (
      candidates.some(
        (candidate) =>
          candidate.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
      )
    ) {
      setManualError("Candidate names must be unique in this room.");
      return;
    }
    if (summary.length < 8 || summary.length > 180) {
      setManualError("Add an honest summary between 8 and 180 characters.");
      return;
    }
    if (
      !Number.isFinite(distanceMeters) ||
      distanceMeters < 0 ||
      distanceMeters > 100_000
    ) {
      setManualError("Distance must be between 0 and 100,000 meters.");
      return;
    }
    if (manualDraft.websiteUrl.trim() && !websiteUrl) {
      setManualError("Website links must begin with http:// or https://.");
      return;
    }

    setCandidates((current) => [
      ...current,
      {
        id: `host-${current.length + 1}-${
          name
            .toLocaleLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "") || "candidate"
        }`,
        name,
        summary,
        distanceMeters,
        priceLabel: manualDraft.priceLabel || null,
        openConfidence:
          manualDraft.evidence["open-target"] === true
            ? "verified-open"
            : "unknown",
        constraintEvidence: Object.fromEntries(
          setup.constraintIds.map((id) => [
            id,
            manualDraft.evidence[id] ?? "unknown",
          ]),
        ),
        sourceLabel: "Added by host — confirm details with the venue",
        websiteUrl,
      },
    ]);
    setManualDraft(emptyManualDraft(setup.constraintIds));
  };

  const startBallot = () => {
    if (candidates.length < MIN_CANDIDATES) {
      setManualError(
        `Keep at least ${MIN_CANDIDATES} candidates before voting.`,
      );
      return;
    }
    setBallots({});
    setHistory([]);
    setParticipantIndex(0);
    setCandidateIndex(0);
    setStrongestPick(false);
    setStep("ballot");
  };

  const advanceBallot = () => {
    if (candidateIndex < candidates.length - 1) {
      setCandidateIndex(candidateIndex + 1);
      return;
    }
    if (participantIndex < participants.length - 1) {
      setParticipantIndex(participantIndex + 1);
      setCandidateIndex(0);
      return;
    }
  };

  const castVote = (preference: Preference) => {
    if (!currentParticipant || !currentCandidate) return;
    setHistory((current) => [
      ...current,
      {
        ballots: cloneBallots(ballots),
        participantIndex,
        candidateIndex,
      },
    ]);
    const next = cloneBallots(ballots);
    const participantBallot = { ...(next[currentParticipant.id] ?? {}) };
    if (strongestPick) {
      for (const [id, choice] of Object.entries(participantBallot)) {
        participantBallot[id] = { ...choice, mustPick: false };
      }
    }
    participantBallot[currentCandidate.id] = {
      preference,
      mustPick: strongestPick || undefined,
    };
    next[currentParticipant.id] = participantBallot;
    setBallots(next);
    setStrongestPick(false);
    setDragX(0);
    dragCurrentX.current = 0;
    dragStartX.current = null;
    advanceBallot();
  };

  const startDrag = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStartX.current = event.clientX;
  };

  const moveDrag = (event: PointerEvent<HTMLElement>) => {
    if (dragStartX.current === null) return;
    const nextDragX = Math.max(
      -140,
      Math.min(140, event.clientX - dragStartX.current),
    );
    dragCurrentX.current = nextDragX;
    setDragX(nextDragX);
  };

  const endDrag = () => {
    if (dragStartX.current === null) return;
    if (dragCurrentX.current <= -90) castVote("avoid");
    else if (dragCurrentX.current >= 90) castVote("prefer");
    else {
      setDragX(0);
      dragCurrentX.current = 0;
      dragStartX.current = null;
    }
  };

  const undoVote = () => {
    const previous = history.at(-1);
    if (!previous) return;
    setBallots(previous.ballots);
    setParticipantIndex(previous.participantIndex);
    setCandidateIndex(previous.candidateIndex);
    setHistory((current) => current.slice(0, -1));
    setStrongestPick(false);
  };

  const ballotComplete = participants.every((participant) =>
    candidates.every((candidate) => ballots[participant.id]?.[candidate.id]),
  );
  const completedVotes = participants.reduce(
    (total, participant) =>
      total + Object.keys(ballots[participant.id] ?? {}).length,
    0,
  );
  const totalVotes = participants.length * candidates.length;

  const finishBallot = () => {
    const result = resolveDecision({
      participantIds: participants.map(({ id }) => id),
      constraints,
      candidates,
      ballots,
    });
    setDecision(result);
    setStep("result");
  };

  const copyOutcome = async () => {
    if (!winner) return;
    const text = `${setup.title}: ${winner.name} won the group decision. Confirm live hours and venue details before leaving. ${candidateMapUrl(winner)}`;
    try {
      await navigator.clipboard.writeText(text);
      setShareStatus("Result copied.");
    } catch {
      setShareStatus("Copy was blocked. Use the map link instead.");
    }
  };

  const restart = () => {
    setStep("setup");
    setDecision(null);
    setCommittedIds([]);
    setShareStatus("");
  };

  return (
    <section className="workflow-shell" aria-labelledby="workflow-title">
      <header className="workflow-header">
        <div>
          <p className="section-kicker">Milestone 0.2 · local decision MVP</p>
          <h2 id="workflow-title">Take a group from intent to commitment.</h2>
        </div>
        <ol className="stepper" aria-label="Decision progress">
          {(["setup", "candidates", "ballot", "result"] as const).map(
            (item, index) => (
              <li
                key={item}
                aria-current={step === item ? "step" : undefined}
                className={step === item ? "is-current" : ""}
              >
                <span>{index + 1}</span>
                {item === "candidates" ? "Options" : item}
              </li>
            ),
          )}
        </ol>
      </header>

      {step === "setup" && (
        <div className="workflow-panel" data-testid="setup-step">
          <div className="panel-heading">
            <p className="section-kicker">Room setup</p>
            <h3>What are you deciding—and who is here?</h3>
            <p>
              This device keeps the temporary roster. Constraint summaries are
              group-visible; the final connected product will keep who declared
              a need private.
            </p>
          </div>

          <div className="form-grid">
            <label>
              Room name
              <input
                value={setup.title}
                aria-invalid={Boolean(setupErrors.title)}
                aria-describedby={setupErrors.title ? "title-error" : undefined}
                onChange={(event) =>
                  setSetup((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
              />
              {setupErrors.title && (
                <small id="title-error" className="field-error">
                  {setupErrors.title}
                </small>
              )}
            </label>
            <label>
              Target date and time
              <input
                type="datetime-local"
                value={setup.targetAt}
                aria-invalid={Boolean(setupErrors.targetAt)}
                aria-describedby={
                  setupErrors.targetAt ? "time-error" : undefined
                }
                onChange={(event) =>
                  setSetup((current) => ({
                    ...current,
                    targetAt: event.target.value,
                  }))
                }
              />
              {setupErrors.targetAt && (
                <small id="time-error" className="field-error">
                  {setupErrors.targetAt}
                </small>
              )}
            </label>
          </div>

          <fieldset className="roster-fieldset">
            <legend>Locked voter roster</legend>
            <div className="count-control">
              <button
                type="button"
                className="secondary compact"
                aria-label="Remove a participant"
                onClick={() =>
                  updateParticipantCount(setup.participants.length - 1)
                }
                disabled={setup.participants.length <= MIN_PARTICIPANTS}
              >
                −
              </button>
              <strong>{setup.participants.length} people</strong>
              <button
                type="button"
                className="secondary compact"
                aria-label="Add a participant"
                onClick={() =>
                  updateParticipantCount(setup.participants.length + 1)
                }
                disabled={setup.participants.length >= MAX_PARTICIPANTS}
              >
                +
              </button>
            </div>
            <div className="participant-grid">
              {setup.participants.map((name, index) => (
                <label key={index}>
                  Person {index + 1}
                  <input
                    value={name}
                    maxLength={24}
                    onChange={(event) => {
                      const next = [...setup.participants];
                      next[index] = event.target.value;
                      setSetup((current) => ({
                        ...current,
                        participants: next,
                      }));
                    }}
                  />
                </label>
              ))}
            </div>
            {setupErrors.participants && (
              <small className="field-error" role="alert">
                {setupErrors.participants}
              </small>
            )}
          </fieldset>

          <fieldset className="constraint-fieldset">
            <legend>Non-negotiables applied before preferences</legend>
            <div className="constraint-picker">
              {constraintOptions.map((constraint) => (
                <label
                  key={constraint.id}
                  className={
                    setup.constraintIds.includes(constraint.id)
                      ? "constraint-option is-selected"
                      : "constraint-option"
                  }
                >
                  <input
                    type="checkbox"
                    checked={setup.constraintIds.includes(constraint.id)}
                    onChange={() => toggleConstraint(constraint.id)}
                  />
                  <span>
                    <strong>{constraint.label}</strong>
                    <small>{constraint.description}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="panel-actions">
            <span>
              {setup.constraintIds.length} group constraint
              {setup.constraintIds.length === 1 ? "" : "s"}
            </span>
            <button
              type="button"
              className="primary"
              onClick={beginCandidateReview}
            >
              Review candidates
            </button>
          </div>
        </div>
      )}

      {step === "candidates" && (
        <div className="workflow-panel" data-testid="candidate-step">
          <div className="panel-heading split-heading">
            <div>
              <p className="section-kicker">Candidate review</p>
              <h3>Keep the deck small and the facts honest.</h3>
              <p>
                Unknown evidence stays unknown and fails a hard constraint until
                confirmed.
              </p>
            </div>
            <strong className="count-badge">
              {candidates.length}/{MAX_CANDIDATES}
            </strong>
          </div>

          <div className="candidate-list">
            {candidates.map((candidate) => {
              const failed = constraints.filter(
                (constraint) =>
                  candidate.constraintEvidence[constraint.id] !== true,
              );
              return (
                <article key={candidate.id} className="review-card">
                  {fixtureMedia[candidate.id] && (
                    <div className="review-card-media">
                      <Image
                        src={fixtureMedia[candidate.id].src}
                        alt={fixtureMedia[candidate.id].alt}
                        fill
                        sizes="(max-width: 650px) 38vw, 180px"
                      />
                      <span>Illustrative</span>
                    </div>
                  )}
                  <div>
                    <p className="candidate-facts">
                      <span>{candidate.priceLabel ?? "Price unknown"}</span>
                      <span>{formatDistance(candidate.distanceMeters)}</span>
                    </p>
                    <h4>{candidate.name}</h4>
                    <p>{candidate.summary}</p>
                    <small>{candidate.sourceLabel}</small>
                  </div>
                  <div className="review-status">
                    <span
                      className={
                        failed.length ? "status-chip is-blocked" : "status-chip"
                      }
                    >
                      {failed.length
                        ? `${failed.length} constraint check${failed.length === 1 ? "" : "s"} unresolved`
                        : "Eligible to vote"}
                    </span>
                    <button
                      type="button"
                      className="text-button"
                      disabled={candidates.length <= MIN_CANDIDATES}
                      onClick={() =>
                        setCandidates((current) =>
                          current.filter(({ id }) => id !== candidate.id),
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          <details className="manual-candidate">
            <summary>Add a candidate manually</summary>
            <div className="manual-form">
              <div className="form-grid">
                <label>
                  Name
                  <input
                    value={manualDraft.name}
                    onChange={(event) =>
                      setManualDraft((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Distance in meters
                  <input
                    type="number"
                    min="0"
                    max="100000"
                    value={manualDraft.distanceMeters}
                    onChange={(event) =>
                      setManualDraft((current) => ({
                        ...current,
                        distanceMeters: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Price knowledge
                  <select
                    value={manualDraft.priceLabel}
                    onChange={(event) =>
                      setManualDraft((current) => ({
                        ...current,
                        priceLabel: event.target.value,
                      }))
                    }
                  >
                    <option value="">Unknown</option>
                    <option value="$">$</option>
                    <option value="$$">$$</option>
                    <option value="$$$">$$$</option>
                  </select>
                </label>
                <label>
                  Website (optional)
                  <input
                    type="url"
                    placeholder="https://…"
                    value={manualDraft.websiteUrl}
                    onChange={(event) =>
                      setManualDraft((current) => ({
                        ...current,
                        websiteUrl: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              <label>
                Honest summary
                <textarea
                  rows={3}
                  value={manualDraft.summary}
                  onChange={(event) =>
                    setManualDraft((current) => ({
                      ...current,
                      summary: event.target.value,
                    }))
                  }
                />
              </label>
              {constraints.length > 0 && (
                <fieldset className="evidence-fieldset">
                  <legend>What has the host confirmed?</legend>
                  <div className="evidence-grid">
                    {constraints.map((constraint) => (
                      <label key={constraint.id}>
                        {constraint.label}
                        <select
                          value={String(
                            manualDraft.evidence[constraint.id] ?? "unknown",
                          )}
                          onChange={(event) =>
                            setManualDraft((current) => ({
                              ...current,
                              evidence: {
                                ...current.evidence,
                                [constraint.id]:
                                  event.target.value === "true"
                                    ? true
                                    : event.target.value === "false"
                                      ? false
                                      : "unknown",
                              },
                            }))
                          }
                        >
                          <option value="unknown">Unknown</option>
                          <option value="true">Confirmed yes</option>
                          <option value="false">Confirmed no</option>
                        </select>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
              {manualError && (
                <p className="field-error" role="alert">
                  {manualError}
                </p>
              )}
              <button
                type="button"
                className="secondary"
                onClick={addManualCandidate}
              >
                Add to deck
              </button>
            </div>
          </details>

          <div className="panel-actions">
            <button
              type="button"
              className="secondary"
              onClick={() => setStep("setup")}
            >
              Back to setup
            </button>
            <button type="button" className="primary" onClick={startBallot}>
              Lock roster and begin voting
            </button>
          </div>
        </div>
      )}

      {step === "ballot" && currentParticipant && currentCandidate && (
        <div className="workflow-panel ballot-panel" data-testid="ballot-step">
          <div className="ballot-progress">
            <div>
              <p className="section-kicker">
                Private turn · {currentParticipant.name}
              </p>
              <h3>{currentCandidate.name}</h3>
            </div>
            <div>
              <strong>
                {completedVotes}/{totalVotes}
              </strong>
              <span>responses saved locally</span>
            </div>
          </div>
          <div
            className="progress-track"
            aria-label={`${completedVotes} of ${totalVotes} responses complete`}
          >
            <span
              style={{ width: `${(completedVotes / totalVotes) * 100}%` }}
            />
          </div>

          <p className="swipe-hint">Swipe left or right—or use the buttons.</p>
          <article
            className="ballot-card"
            data-testid="ballot-card"
            onPointerDown={startDrag}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            style={{
              transform: `translateX(${dragX}px) rotate(${dragX / 28}deg)`,
            }}
          >
            <div className="candidate-visual">
              {fixtureMedia[currentCandidate.id] ? (
                <Image
                  src={fixtureMedia[currentCandidate.id].src}
                  alt={fixtureMedia[currentCandidate.id].alt}
                  fill
                  draggable={false}
                  priority={candidateIndex === 0 && participantIndex === 0}
                  sizes="(max-width: 650px) 100vw, (max-width: 1000px) 44vw, 420px"
                />
              ) : (
                <span aria-hidden="true">
                  {currentCandidate.name.slice(0, 1)}
                </span>
              )}
              <div className="fixture-label">Illustrative fixture</div>
              <div
                className={`swipe-stamp swipe-no ${dragX < -35 ? "is-visible" : ""}`}
                aria-hidden="true"
              >
                PASS
              </div>
              <div
                className={`swipe-stamp swipe-yes ${dragX > 35 ? "is-visible" : ""}`}
                aria-hidden="true"
              >
                LIKE
              </div>
            </div>
            <div className="ballot-copy">
              {fixtureMedia[currentCandidate.id] && (
                <p className="candidate-vibe">
                  {fixtureMedia[currentCandidate.id].vibe}
                </p>
              )}
              <p className="candidate-facts">
                <span>{currentCandidate.priceLabel ?? "Price unknown"}</span>
                <span>{formatDistance(currentCandidate.distanceMeters)}</span>
                <span>{currentCandidate.openConfidence.replace("-", " ")}</span>
              </p>
              <p>{currentCandidate.summary}</p>
              {fixtureMedia[currentCandidate.id] && (
                <div
                  className="dish-highlights"
                  aria-label="Fixture highlights"
                >
                  {fixtureMedia[currentCandidate.id].highlights.map(
                    (highlight) => (
                      <span key={highlight}>{highlight}</span>
                    ),
                  )}
                </div>
              )}
              <small>{currentCandidate.sourceLabel}</small>
              <label className="must-pick">
                <input
                  type="checkbox"
                  checked={strongestPick}
                  onChange={(event) => setStrongestPick(event.target.checked)}
                />
                Mark as {currentParticipant.name}&apos;s one strongest pick
              </label>
            </div>
          </article>

          <div
            className="vote-controls"
            aria-label={`Vote on ${currentCandidate.name}`}
          >
            <button
              type="button"
              className="vote avoid"
              aria-label="Avoid — preference, not a safety veto"
              onClick={() => castVote("avoid")}
            >
              <span>×</span>Avoid<small>Preference, not a safety veto</small>
            </button>
            <button
              type="button"
              className="vote accept"
              aria-label="Accept — a workable compromise"
              onClick={() => castVote("accept")}
            >
              <span>○</span>Accept<small>A workable compromise</small>
            </button>
            <button
              type="button"
              className="vote prefer"
              aria-label="Prefer — a positive choice"
              onClick={() => castVote("prefer")}
            >
              <span>♥</span>Prefer<small>A positive choice</small>
            </button>
          </div>

          <div className="panel-actions">
            <button
              type="button"
              className="secondary"
              onClick={undoVote}
              disabled={history.length === 0}
            >
              Undo last vote
            </button>
            <span>Roster locked · {participants.length} voters</span>
            {ballotComplete && (
              <button type="button" className="primary" onClick={finishBallot}>
                Resolve fairly
              </button>
            )}
          </div>
        </div>
      )}

      {step === "result" && decision && (
        <div
          className="workflow-panel result-screen"
          data-testid="result-step"
          aria-live="polite"
        >
          {decision.status === "decided" && winner ? (
            <>
              <div className="result-hero">
                <p className="section-kicker">
                  Decision reached · ruleset {decision.rulesetVersion}
                </p>
                <h3>{winner.name}</h3>
                <p>The strongest feasible compromise for this locked roster.</p>
              </div>
              <div className="result-grid">
                <article>
                  <h4>Why it won</h4>
                  <ol>
                    {decision.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ol>
                  <p className="result-note">
                    Runner-up:{" "}
                    <strong>
                      {runnerUp?.name ?? "No other feasible option"}
                    </strong>
                  </p>
                </article>
                <article>
                  <h4>Commit to the plan</h4>
                  <div className="commitment-list">
                    {participants.map((participant) => {
                      const committed = committedIds.includes(participant.id);
                      return (
                        <button
                          type="button"
                          key={participant.id}
                          className={
                            committed ? "commitment is-committed" : "commitment"
                          }
                          aria-pressed={committed}
                          onClick={() =>
                            setCommittedIds((current) =>
                              committed
                                ? current.filter((id) => id !== participant.id)
                                : [...current, participant.id],
                            )
                          }
                        >
                          <span>{committed ? "✓" : "+"}</span>
                          {participant.name}
                        </button>
                      );
                    })}
                  </div>
                  <p>
                    {committedIds.length}/{participants.length} people are in.
                  </p>
                </article>
              </div>
              <div className="handoff-actions">
                <a
                  className="primary button-link"
                  href={candidateMapUrl(winner)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open safe map search
                </a>
                {winner.websiteUrl && (
                  <a
                    className="secondary button-link"
                    href={winner.websiteUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Visit host-provided website
                  </a>
                )}
                <button
                  type="button"
                  className="secondary"
                  onClick={copyOutcome}
                >
                  Copy result
                </button>
              </div>
              {shareStatus && (
                <p className="share-status" role="status">
                  {shareStatus}
                </p>
              )}
              <p className="confirmation-note">
                Illustrative and host-added facts must be confirmed before
                travel. Consensus does not claim a reservation or live
                availability.
              </p>
            </>
          ) : decision.status === "no-safe-result" ? (
            <div className="no-result">
              <p className="section-kicker">
                No safe result · ruleset {decision.rulesetVersion}
              </p>
              <h3>No candidate satisfies every non-negotiable.</h3>
              <p>
                Preferences did not override the group&apos;s constraints.
                Return to the deck to add or verify another option, or revisit
                constraints together.
              </p>
              <ul>
                {decision.failedConstraintIds.map((id) => (
                  <li key={id}>
                    {constraints.find((constraint) => constraint.id === id)
                      ?.label ?? id}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="primary"
                onClick={() => setStep("candidates")}
              >
                Review the deck
              </button>
            </div>
          ) : (
            <div className="no-result">
              <h3>The ballot is incomplete.</h3>
              <button
                type="button"
                className="primary"
                onClick={() => setStep("ballot")}
              >
                Return to voting
              </button>
            </div>
          )}
          <button
            type="button"
            className="text-button restart-button"
            onClick={restart}
          >
            Start a new decision
          </button>
        </div>
      )}
    </section>
  );
}
