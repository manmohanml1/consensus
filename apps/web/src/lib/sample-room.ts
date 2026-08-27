import type {
  Candidate,
  DecisionInput,
  HardConstraint,
} from "@consensus/domain";

export const sampleParticipants = [
  { id: "maya", name: "Maya" },
  { id: "jon", name: "Jon" },
  { id: "lee", name: "Lee" },
] as const;

export const sampleConstraints: HardConstraint[] = [
  {
    id: "vegetarian",
    label: "A substantial vegetarian option",
    required: true,
  },
  { id: "step-free", label: "Step-free entrance", required: true },
  { id: "budget", label: "About $30 per person or less", required: true },
];

export const sampleCandidates: Candidate[] = [
  {
    id: "garden-table",
    name: "Garden Table",
    summary: "Seasonal plates, calm room, broad vegetarian menu.",
    distanceMeters: 850,
    priceLabel: "$$",
    openConfidence: "verified-open",
    constraintEvidence: { vegetarian: true, "step-free": true, budget: true },
    sourceLabel: "Illustrative sample — not live venue data",
  },
  {
    id: "night-noodle",
    name: "Night Noodle",
    summary: "Fast noodle bar with flexible bowls and a lively counter.",
    distanceMeters: 540,
    priceLabel: "$",
    openConfidence: "likely-open",
    constraintEvidence: { vegetarian: true, "step-free": true, budget: true },
    sourceLabel: "Illustrative sample — confirm details before travel",
  },
  {
    id: "cellar-club",
    name: "Cellar Club",
    summary: "Small downstairs tasting room.",
    distanceMeters: 410,
    priceLabel: "$$$",
    openConfidence: "unknown",
    constraintEvidence: {
      vegetarian: "unknown",
      "step-free": false,
      budget: false,
    },
    sourceLabel: "Illustrative sample — incomplete facts",
  },
];

export const sampleDecisionInput: DecisionInput = {
  participantIds: sampleParticipants.map((participant) => participant.id),
  constraints: sampleConstraints,
  candidates: sampleCandidates,
  ballots: {
    maya: {
      "garden-table": { preference: "prefer", mustPick: true },
      "night-noodle": { preference: "accept" },
      "cellar-club": { preference: "avoid" },
    },
    jon: {
      "garden-table": { preference: "accept" },
      "night-noodle": { preference: "prefer", mustPick: true },
      "cellar-club": { preference: "avoid" },
    },
    lee: {
      "garden-table": { preference: "prefer" },
      "night-noodle": { preference: "avoid" },
      "cellar-club": { preference: "prefer", mustPick: true },
    },
  },
};
