import { describe, expect, it } from "vitest";
import { formatDistance } from "./format";

describe("formatDistance", () => {
  it("keeps nearby distances in meters", () =>
    expect(formatDistance(850)).toBe("850 m"));
  it("uses one decimal for kilometers", () =>
    expect(formatDistance(1250)).toBe("1.3 km"));
});
