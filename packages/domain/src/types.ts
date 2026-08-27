export const DECISION_RULESET_VERSION = "1.0.0" as const;

export type ConstraintEvidence = true | false | "unknown";

export interface HardConstraint {
  id: string;
  label: string;
  required: true;
}

export interface Candidate {
  id: string;
  name: string;
  summary: string;
  distanceMeters: number;
  priceLabel: string | null;
  openConfidence: "verified-open" | "likely-open" | "unknown";
  constraintEvidence: Record<string, ConstraintEvidence>;
  sourceLabel: string;
  websiteUrl: string | null;
}

export type Preference = "prefer" | "accept" | "avoid";

export interface BallotChoice {
  preference: Preference;
  mustPick?: boolean;
}

export interface DecisionInput {
  participantIds: readonly string[];
  constraints: readonly HardConstraint[];
  candidates: readonly Candidate[];
  ballots: Readonly<Record<string, Readonly<Record<string, BallotChoice>>>>;
}

export interface CandidateEvaluation {
  candidateId: string;
  feasible: boolean;
  failedConstraintIds: string[];
  unanimousAcceptance: boolean;
  acceptanceCount: number;
  acceptanceCoverage: number;
  minimumUtility: number;
  totalUtility: number;
}

export type DecisionResult =
  | {
      status: "incomplete";
      rulesetVersion: typeof DECISION_RULESET_VERSION;
      incompleteParticipantIds: string[];
    }
  | {
      status: "no-safe-result";
      rulesetVersion: typeof DECISION_RULESET_VERSION;
      evaluations: CandidateEvaluation[];
      failedConstraintIds: string[];
    }
  | {
      status: "decided";
      rulesetVersion: typeof DECISION_RULESET_VERSION;
      winnerCandidateId: string;
      runnerUpCandidateId: string | null;
      evaluations: CandidateEvaluation[];
      reasons: string[];
    };
