import { describe, expect, it } from "vitest";
import {
  buildSampleCandidates,
  candidateMapUrl,
  parseSafeHttpUrl,
  selectedConstraints,
  validateRoomSetup,
} from "./decision-mvp";

describe("decision MVP contracts", () => {
  it("rejects duplicate and undersized rosters", () => {
    expect(
      validateRoomSetup({
        title: "Dinner",
        targetAt: "2026-09-01T19:00",
        participants: ["Maya", "maya"],
        constraintIds: [],
      }).participants,
    ).toMatch(/unique/);
    expect(
      validateRoomSetup({
        title: "Dinner",
        targetAt: "2026-09-01T19:00",
        participants: ["Maya"],
        constraintIds: [],
      }).participants,
    ).toMatch(/2–8/);
  });

  it("returns only explicitly selected hard constraints", () => {
    expect(selectedConstraints(["step-free", "budget-30"])).toEqual([
      { id: "step-free", label: "Step-free entrance", required: true },
      {
        id: "budget-30",
        label: "$30 per person or less",
        required: true,
      },
    ]);
  });

  it("preserves unknown sample evidence instead of inventing facts", () => {
    const candidates = buildSampleCandidates(["vegan", "open-target"]);
    expect(
      candidates.find(({ id }) => id === "night-noodle")?.constraintEvidence,
    ).toEqual({
      vegan: true,
      "open-target": "unknown",
    });
  });

  it("accepts only HTTP links and safely encodes map searches", () => {
    expect(parseSafeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(parseSafeHttpUrl("https://example.com/menu")).toBe(
      "https://example.com/menu",
    );
    expect(candidateMapUrl({ name: "Rice & Spice" })).toContain(
      "Rice%20%26%20Spice",
    );
  });
});
