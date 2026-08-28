import { describe, expect, it } from "vitest";
import { resolveDecision } from "./decision";
import type { Candidate, DecisionInput } from "./types";

const candidates: Candidate[] = [
  {
    id: "garden",
    name: "Garden Table",
    summary: "Seasonal neighborhood kitchen",
    distanceMeters: 900,
    priceLabel: "$$",
    openConfidence: "verified-open",
    constraintEvidence: { vegetarian: true, accessible: true },
    sourceLabel: "Sample fixture",
    websiteUrl: null,
  },
  {
    id: "noodle",
    name: "Night Noodle",
    summary: "Late-night noodle bar",
    distanceMeters: 600,
    priceLabel: "$",
    openConfidence: "likely-open",
    constraintEvidence: { vegetarian: true, accessible: true },
    sourceLabel: "Sample fixture",
    websiteUrl: null,
  },
];

const baseInput: DecisionInput = {
  participantIds: ["a", "b"],
  constraints: [
    { id: "vegetarian", label: "Vegetarian option", required: true },
    { id: "accessible", label: "Step-free access", required: true },
  ],
  candidates,
  ballots: {
    a: { garden: { preference: "prefer" }, noodle: { preference: "accept" } },
    b: { garden: { preference: "accept" }, noodle: { preference: "avoid" } },
  },
};

describe("resolveDecision", () => {
  it("selects the candidate with unanimous acceptance", () => {
    const result = resolveDecision(baseInput);
    expect(result.status).toBe("decided");
    if (result.status === "decided")
      expect(result.winnerCandidateId).toBe("garden");
  });

  it("never lets preference override a failed hard constraint", () => {
    const unsafe = {
      ...candidates[0]!,
      constraintEvidence: { vegetarian: false, accessible: true },
    };
    const result = resolveDecision({
      ...baseInput,
      candidates: [unsafe, candidates[1]!],
      ballots: {
        a: {
          garden: { preference: "prefer", mustPick: true },
          noodle: { preference: "accept" },
        },
        b: {
          garden: { preference: "prefer", mustPick: true },
          noodle: { preference: "accept" },
        },
      },
    });
    expect(result.status).toBe("decided");
    if (result.status === "decided")
      expect(result.winnerCandidateId).toBe("noodle");
  });

  it("returns no safe result when all candidates fail constraints", () => {
    const result = resolveDecision({
      ...baseInput,
      candidates: candidates.map((candidate) => ({
        ...candidate,
        constraintEvidence: { vegetarian: "unknown", accessible: true },
      })),
    });
    expect(result.status).toBe("no-safe-result");
  });

  it("does not call an incomplete ballot unanimous", () => {
    const result = resolveDecision({
      ...baseInput,
      ballots: { a: baseInput.ballots.a! },
    });
    expect(result).toMatchObject({
      status: "incomplete",
      incompleteParticipantIds: ["b"],
    });
  });

  it("is invariant to candidate input order", () => {
    const normal = resolveDecision(baseInput);
    const reversed = resolveDecision({
      ...baseInput,
      candidates: [...candidates].reverse(),
    });
    expect(normal).toEqual(reversed);
  });
});
