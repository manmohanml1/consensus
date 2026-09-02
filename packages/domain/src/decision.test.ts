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

  it("preserves the result across deterministic candidate permutations", () => {
    const expected = resolveDecision(baseInput);

    for (let seed = 1; seed <= 64; seed += 1) {
      const shuffled = [...candidates];
      let state = seed;
      for (let index = shuffled.length - 1; index > 0; index -= 1) {
        state = (state * 16_807) % 2_147_483_647;
        const swapIndex = state % (index + 1);
        [shuffled[index], shuffled[swapIndex]] = [
          shuffled[swapIndex]!,
          shuffled[index]!,
        ];
      }

      expect(resolveDecision({ ...baseInput, candidates: shuffled })).toEqual(
        expected,
      );
    }
  });

  it("never selects a hard-constraint failure across varied preferences", () => {
    for (let seed = 1; seed <= 64; seed += 1) {
      const unsafe = {
        ...candidates[0]!,
        constraintEvidence: {
          vegetarian: seed % 2 === 0 ? false : ("unknown" as const),
          accessible: true,
        },
      };
      const safe = candidates[1]!;
      const result = resolveDecision({
        ...baseInput,
        candidates: seed % 3 === 0 ? [safe, unsafe] : [unsafe, safe],
        ballots: {
          a: {
            garden: { preference: "prefer", mustPick: seed % 2 === 0 },
            noodle: { preference: seed % 5 === 0 ? "avoid" : "accept" },
          },
          b: {
            garden: { preference: "prefer", mustPick: true },
            noodle: { preference: seed % 7 === 0 ? "avoid" : "accept" },
          },
        },
      });

      expect(result.status, `seed=${seed}`).toBe("decided");
      if (result.status === "decided") {
        expect(result.winnerCandidateId, `seed=${seed}`).toBe("noodle");
      }
    }
  });
});
