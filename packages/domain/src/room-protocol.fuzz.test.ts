import { describe, expect, it } from "vitest";
import {
  parseCreateHostRecoveryRequest,
  parseCreateRoomRequest,
  parseJoinRoomRequest,
  parseRedeemHostRecoveryRequest,
  parseRoomCommand,
  parseRoomProjection,
} from "./room-protocol";

const DEFAULT_CASES = 256;
const MAX_CASES = 10_000;
const environment = (
  globalThis as {
    process?: { env?: Readonly<Record<string, string | undefined>> };
  }
).process?.env;
const requestedCases = Number.parseInt(
  environment?.CONSENSUS_FUZZ_CASES ?? `${DEFAULT_CASES}`,
  10,
);
const fuzzCases = Number.isSafeInteger(requestedCases)
  ? Math.min(Math.max(requestedCases, 1), MAX_CASES)
  : DEFAULT_CASES;

const parsers = [
  parseRoomCommand,
  parseRoomProjection,
  parseCreateRoomRequest,
  parseJoinRoomRequest,
  parseCreateHostRecoveryRequest,
  parseRedeemHostRecoveryRequest,
] as const;

function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4_294_967_296;
  };
}

function arbitraryJson(seed: number): unknown {
  const next = random(seed);
  const scalar = () => {
    const choice = Math.floor(next() * 6);
    if (choice === 0) return null;
    if (choice === 1) return next() > 0.5;
    if (choice === 2) return Math.floor(next() * 1_000_000) - 500_000;
    if (choice === 3) return `value_${Math.floor(next() * 1_000_000)}`;
    if (choice === 4) return "A".repeat(Math.floor(next() * 200));
    return "";
  };
  const value = (depth: number): unknown => {
    if (depth >= 3 || next() < 0.45) return scalar();
    if (next() < 0.35) {
      return Array.from({ length: Math.floor(next() * 6) }, () =>
        value(depth + 1),
      );
    }
    const record: Record<string, unknown> = {};
    const keys = [
      "protocolVersion",
      "roomId",
      "actor",
      "payload",
      "token",
      "__proto__",
      `unknown_${seed}`,
    ];
    for (let index = 0; index < Math.floor(next() * 6); index += 1) {
      record[keys[Math.floor(next() * keys.length)]!] = value(depth + 1);
    }
    return record;
  };
  return value(0);
}

const regressionCorpus: ReadonlyArray<{ name: string; value: unknown }> = [
  { name: "null", value: null },
  { name: "array root", value: [] },
  { name: "unsafe nested secret", value: { payload: { secret: "x" } } },
  { name: "prototype key", value: JSON.parse('{"__proto__":{"token":"x"}}') },
  { name: "deep array", value: [[[[{ capability: "x" }]]]] },
  { name: "oversized string", value: { title: "x".repeat(20_000) } },
];

describe("room protocol bounded fuzz properties", () => {
  it("rejects the persisted malformed-input regression corpus without throwing", () => {
    for (const reproduction of regressionCorpus) {
      for (const parser of parsers) {
        const result = parser(reproduction.value);
        expect(
          result.success,
          `${reproduction.name} parser=${parser.name}`,
        ).toBe(false);
        if (!result.success) {
          expect(
            result.issues.length,
            `${reproduction.name} parser=${parser.name}`,
          ).toBeGreaterThan(0);
        }
      }
    }
  });

  it(`never throws for ${fuzzCases} deterministic generated JSON values`, () => {
    for (let seed = 1; seed <= fuzzCases; seed += 1) {
      const input = arbitraryJson(seed);
      for (const parser of parsers) {
        const result = parser(input);
        expect(
          result.success || result.issues.length > 0,
          `seed=${seed} parser=${parser.name} input=${JSON.stringify(input)}`,
        ).toBe(true);

        if (result.success) {
          expect(
            parser(result.data),
            `canonical reparse seed=${seed} parser=${parser.name}`,
          ).toEqual(result);
        }
      }
    }
  });
});
