"use client";

import type {
  Candidate,
  DecisionResult,
  HardConstraint,
} from "@consensus/domain";
import { useState } from "react";
import { formatDistance } from "@/lib/format";

interface DecisionDemoProps {
  candidates: Candidate[];
  constraints: HardConstraint[];
  participants: readonly { id: string; name: string }[];
  decision: DecisionResult;
}

export function DecisionDemo({
  candidates,
  constraints,
  participants,
  decision,
}: DecisionDemoProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const candidate = candidates[activeIndex] ?? candidates[0];
  const winner =
    decision.status === "decided"
      ? (candidates.find((item) => item.id === decision.winnerCandidateId) ??
        null)
      : null;

  const move = (direction: -1 | 1) => {
    setShowResult(false);
    setActiveIndex(
      (current) =>
        (current + direction + candidates.length) % candidates.length,
    );
  };

  if (!candidate) return null;

  return (
    <section className="room-shell" aria-labelledby="room-title">
      <header className="room-header">
        <div>
          <p className="section-kicker">Friday dinner · sample room</p>
          <h2 id="room-title">
            Three people. Three constraints. One useful answer.
          </h2>
        </div>
        <div
          className="roster"
          aria-label={`${participants.length} locked participants`}
        >
          <span className="lock" aria-hidden="true">
            ◆
          </span>
          <span>Roster locked</span>
          <strong>{participants.length}</strong>
        </div>
      </header>

      <div className="room-grid">
        <aside className="constraints" aria-labelledby="constraint-title">
          <p className="section-kicker">Non-negotiables</p>
          <h3 id="constraint-title">Applied before voting</h3>
          <ul>
            {constraints.map((constraint) => (
              <li key={constraint.id}>
                <span aria-hidden="true">✓</span>
                {constraint.label}
              </li>
            ))}
          </ul>
          <p className="privacy-note">
            The final product shares only a group-safe summary—not who declared
            a need.
          </p>
        </aside>

        <div className="candidate-stage">
          <div className="progress-row">
            <span>
              Candidate {activeIndex + 1} of {candidates.length}
            </span>
            <span>{candidate.openConfidence.replace("-", " ")}</span>
          </div>

          <article className="candidate-card" aria-live="polite">
            <div className="candidate-visual" aria-hidden="true">
              <span>{candidate.name.slice(0, 1)}</span>
              <div className="orbit orbit-one" />
              <div className="orbit orbit-two" />
            </div>
            <div className="candidate-copy">
              <div className="candidate-meta">
                <span>{candidate.priceLabel ?? "Price unknown"}</span>
                <span>{formatDistance(candidate.distanceMeters)}</span>
              </div>
              <h3>{candidate.name}</h3>
              <p>{candidate.summary}</p>
              <small>{candidate.sourceLabel}</small>
            </div>
          </article>

          <div className="demo-controls" aria-label="Inspect sample candidates">
            <button
              type="button"
              className="secondary"
              onClick={() => move(-1)}
            >
              Previous
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => setShowResult(true)}
            >
              Explain the result
            </button>
            <button type="button" className="secondary" onClick={() => move(1)}>
              Next
            </button>
          </div>
        </div>

        <aside
          className={`result-panel ${showResult ? "is-visible" : ""}`}
          aria-labelledby="result-title"
        >
          <p className="section-kicker">Ruleset {decision.rulesetVersion}</p>
          <h3 id="result-title">
            {showResult && winner ? winner.name : "Result stays explainable"}
          </h3>
          {showResult && decision.status === "decided" ? (
            <>
              <ol>
                {decision.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ol>
              <p className="result-note">
                Runner-up:{" "}
                {candidates.find(
                  (item) => item.id === decision.runnerUpCandidateId,
                )?.name ?? "None"}
              </p>
            </>
          ) : (
            <p>
              Open the result to see why a choice won, what protected the group,
              and what still needs confirmation.
            </p>
          )}
        </aside>
      </div>
    </section>
  );
}
