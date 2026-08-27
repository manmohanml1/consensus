import type {
  Candidate,
  ConstraintEvidence,
  HardConstraint,
} from "@consensus/domain";

export const MIN_PARTICIPANTS = 2;
export const MAX_PARTICIPANTS = 8;
export const MIN_CANDIDATES = 2;
export const MAX_CANDIDATES = 12;

export interface ConstraintOption extends HardConstraint {
  category: "dietary" | "accessibility" | "budget" | "distance" | "timing";
  description: string;
}

export const constraintOptions: readonly ConstraintOption[] = [
  {
    id: "vegetarian",
    label: "Substantial vegetarian option",
    description: "A full meal, not only a side dish.",
    category: "dietary",
    required: true,
  },
  {
    id: "vegan",
    label: "Substantial vegan option",
    description: "A complete plant-based meal is available.",
    category: "dietary",
    required: true,
  },
  {
    id: "gluten-aware",
    label: "Gluten-aware preparation",
    description: "The venue can explain cross-contact handling.",
    category: "dietary",
    required: true,
  },
  {
    id: "step-free",
    label: "Step-free entrance",
    description: "The main guest route has no required steps.",
    category: "accessibility",
    required: true,
  },
  {
    id: "quiet-space",
    label: "Conversation-friendly noise level",
    description: "A calmer environment is needed by the group.",
    category: "accessibility",
    required: true,
  },
  {
    id: "budget-30",
    label: "$30 per person or less",
    description: "A group budget ceiling, excluding optional extras.",
    category: "budget",
    required: true,
  },
  {
    id: "distance-3km",
    label: "Within 3 km",
    description: "The venue must fit the group's travel boundary.",
    category: "distance",
    required: true,
  },
  {
    id: "open-target",
    label: "Open at the target time",
    description: "Unknown hours are treated as needing confirmation.",
    category: "timing",
    required: true,
  },
] as const;

export interface RoomSetup {
  title: string;
  targetAt: string;
  participants: string[];
  constraintIds: string[];
}

export interface SetupErrors {
  title?: string;
  targetAt?: string;
  participants?: string;
}

export function validateRoomSetup(setup: RoomSetup): SetupErrors {
  const errors: SetupErrors = {};
  const title = setup.title.trim();
  const participants = setup.participants.map((name) => name.trim());

  if (title.length < 3 || title.length > 60) {
    errors.title = "Use a room name between 3 and 60 characters.";
  }
  if (!setup.targetAt || Number.isNaN(Date.parse(setup.targetAt))) {
    errors.targetAt = "Choose a valid target date and time.";
  }
  if (
    participants.length < MIN_PARTICIPANTS ||
    participants.length > MAX_PARTICIPANTS
  ) {
    errors.participants = `Add ${MIN_PARTICIPANTS}–${MAX_PARTICIPANTS} people.`;
  } else if (participants.some((name) => name.length < 1 || name.length > 24)) {
    errors.participants = "Each display name must be 1–24 characters.";
  } else if (
    new Set(participants.map((name) => name.toLocaleLowerCase())).size !==
    participants.length
  ) {
    errors.participants = "Display names must be unique in this room.";
  }

  return errors;
}

export function selectedConstraints(ids: readonly string[]): HardConstraint[] {
  const selected = new Set(ids);
  return constraintOptions
    .filter((constraint) => selected.has(constraint.id))
    .map(({ id, label, required }) => ({ id, label, required }));
}

const sampleEvidence: ReadonlyArray<
  Omit<Candidate, "constraintEvidence"> & {
    evidence: Record<string, ConstraintEvidence>;
  }
> = [
  {
    id: "garden-table",
    name: "Garden Table",
    summary: "Seasonal plates, a calm room, and broad plant-forward choices.",
    distanceMeters: 850,
    priceLabel: "$$",
    openConfidence: "verified-open",
    sourceLabel: "Illustrative fixture — confirm details before travel",
    websiteUrl: null,
    evidence: {
      vegetarian: true,
      vegan: true,
      "gluten-aware": true,
      "step-free": true,
      "quiet-space": true,
      "budget-30": true,
      "distance-3km": true,
      "open-target": true,
    },
  },
  {
    id: "night-noodle",
    name: "Night Noodle",
    summary: "Flexible bowls, fast service, and a lively counter.",
    distanceMeters: 540,
    priceLabel: "$",
    openConfidence: "likely-open",
    sourceLabel: "Illustrative fixture — hours need confirmation",
    websiteUrl: null,
    evidence: {
      vegetarian: true,
      vegan: true,
      "gluten-aware": "unknown",
      "step-free": true,
      "quiet-space": false,
      "budget-30": true,
      "distance-3km": true,
      "open-target": "unknown",
    },
  },
  {
    id: "harbor-kitchen",
    name: "Harbor Kitchen",
    summary: "Neighborhood comfort food with roomy tables and clear menus.",
    distanceMeters: 1900,
    priceLabel: "$$",
    openConfidence: "verified-open",
    sourceLabel: "Illustrative fixture — not live venue data",
    websiteUrl: null,
    evidence: {
      vegetarian: true,
      vegan: "unknown",
      "gluten-aware": true,
      "step-free": true,
      "quiet-space": true,
      "budget-30": true,
      "distance-3km": true,
      "open-target": true,
    },
  },
  {
    id: "cellar-club",
    name: "Cellar Club",
    summary: "A small downstairs tasting room with limited menu details.",
    distanceMeters: 410,
    priceLabel: "$$$",
    openConfidence: "unknown",
    sourceLabel: "Illustrative fixture — incomplete facts",
    websiteUrl: null,
    evidence: {
      vegetarian: "unknown",
      vegan: "unknown",
      "gluten-aware": "unknown",
      "step-free": false,
      "quiet-space": true,
      "budget-30": false,
      "distance-3km": true,
      "open-target": "unknown",
    },
  },
];

export function buildSampleCandidates(
  constraintIds: readonly string[],
): Candidate[] {
  return sampleEvidence.map(({ evidence, ...candidate }) => ({
    ...candidate,
    constraintEvidence: Object.fromEntries(
      constraintIds.map((id) => [id, evidence[id] ?? "unknown"]),
    ),
  }));
}

export function parseSafeHttpUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export function candidateMapUrl(candidate: Pick<Candidate, "name">): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(candidate.name)}`;
}

export function hasErrors(errors: object): boolean {
  return Object.values(errors).some(Boolean);
}
