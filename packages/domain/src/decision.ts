import {
  DECISION_RULESET_VERSION,
  type BallotChoice,
  type Candidate,
  type CandidateEvaluation,
  type DecisionInput,
  type DecisionResult,
} from "./types";

const preferenceUtility = (choice: BallotChoice): number => {
  const base =
    choice.preference === "prefer" ? 3 : choice.preference === "accept" ? 2 : 0;
  return base + (choice.mustPick ? 1 : 0);
};

const openConfidenceRank = (candidate: Candidate): number => {
  if (candidate.openConfidence === "verified-open") return 2;
  if (candidate.openConfidence === "likely-open") return 1;
  return 0;
};

const evaluateCandidate = (
  input: DecisionInput,
  candidate: Candidate,
): CandidateEvaluation => {
  const failedConstraintIds = input.constraints
    .filter(
      (constraint) => candidate.constraintEvidence[constraint.id] !== true,
    )
    .map((constraint) => constraint.id);

  const choices = input.participantIds.map(
    (participantId) =>
      input.ballots[participantId]?.[candidate.id] as BallotChoice,
  );
  const utilities = choices.map(preferenceUtility);
  const acceptanceCount = choices.filter(
    (choice) => choice.preference !== "avoid",
  ).length;

  return {
    candidateId: candidate.id,
    feasible: failedConstraintIds.length === 0,
    failedConstraintIds,
    unanimousAcceptance: acceptanceCount === input.participantIds.length,
    acceptanceCount,
    acceptanceCoverage: acceptanceCount / input.participantIds.length,
    minimumUtility: Math.min(...utilities),
    totalUtility: utilities.reduce((total, utility) => total + utility, 0),
  };
};

const compareEvaluations = (
  candidatesById: ReadonlyMap<string, Candidate>,
  left: CandidateEvaluation,
  right: CandidateEvaluation,
): number => {
  if (left.unanimousAcceptance !== right.unanimousAcceptance) {
    return left.unanimousAcceptance ? -1 : 1;
  }
  if (left.acceptanceCoverage !== right.acceptanceCoverage) {
    return right.acceptanceCoverage - left.acceptanceCoverage;
  }
  if (left.minimumUtility !== right.minimumUtility) {
    return right.minimumUtility - left.minimumUtility;
  }
  if (left.totalUtility !== right.totalUtility) {
    return right.totalUtility - left.totalUtility;
  }

  const leftCandidate = candidatesById.get(left.candidateId);
  const rightCandidate = candidatesById.get(right.candidateId);
  if (!leftCandidate || !rightCandidate)
    return left.candidateId.localeCompare(right.candidateId);

  const confidenceDifference =
    openConfidenceRank(rightCandidate) - openConfidenceRank(leftCandidate);
  if (confidenceDifference !== 0) return confidenceDifference;
  if (leftCandidate.distanceMeters !== rightCandidate.distanceMeters) {
    return leftCandidate.distanceMeters - rightCandidate.distanceMeters;
  }
  return left.candidateId.localeCompare(right.candidateId);
};

export function resolveDecision(input: DecisionInput): DecisionResult {
  const candidateIds = new Set(
    input.candidates.map((candidate) => candidate.id),
  );
  const incompleteParticipantIds = input.participantIds.filter(
    (participantId) => {
      const ballot = input.ballots[participantId];
      return (
        !ballot || [...candidateIds].some((candidateId) => !ballot[candidateId])
      );
    },
  );

  if (incompleteParticipantIds.length > 0) {
    return {
      status: "incomplete",
      rulesetVersion: DECISION_RULESET_VERSION,
      incompleteParticipantIds,
    };
  }

  const evaluations = input.candidates
    .map((candidate) => evaluateCandidate(input, candidate))
    .sort((left, right) => left.candidateId.localeCompare(right.candidateId));
  const candidatesById = new Map(
    input.candidates.map((candidate) => [candidate.id, candidate]),
  );
  const eligible = evaluations
    .filter((evaluation) => evaluation.feasible)
    .sort((left, right) => compareEvaluations(candidatesById, left, right));

  if (eligible.length === 0) {
    return {
      status: "no-safe-result",
      rulesetVersion: DECISION_RULESET_VERSION,
      evaluations,
      failedConstraintIds: [
        ...new Set(
          evaluations.flatMap((evaluation) => evaluation.failedConstraintIds),
        ),
      ].sort(),
    };
  }

  const winner = eligible[0];
  if (!winner) throw new Error("Eligible decision set unexpectedly empty");
  const runnerUp = eligible[1] ?? null;
  const winnerCandidate = candidatesById.get(winner.candidateId);

  return {
    status: "decided",
    rulesetVersion: DECISION_RULESET_VERSION,
    winnerCandidateId: winner.candidateId,
    runnerUpCandidateId: runnerUp?.candidateId ?? null,
    evaluations,
    reasons: [
      winner.unanimousAcceptance
        ? "Everyone can accept this option."
        : `It has the broadest acceptance (${winner.acceptanceCount}/${input.participantIds.length}).`,
      winner.minimumUtility > 0
        ? "No eligible participant strongly opposed it."
        : "It is the highest-ranked feasible compromise.",
      winnerCandidate?.openConfidence === "verified-open"
        ? "Its open status is verified in this sample."
        : "Confirm current hours before leaving.",
    ],
  };
}
