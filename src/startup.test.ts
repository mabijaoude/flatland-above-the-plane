import { describe, expect, it } from "vitest";
import type { FlatworldSaveV3 } from "./types";
import { chooseStartupDestination } from "./startup";

const save = { version: 3 } as FlatworldSaveV3;

describe("startup destination", () => {
  it("keeps the welcome screen for a first visit", () => {
    expect(chooseStartupDestination(false, undefined)).toBe("welcome");
    expect(chooseStartupDestination(false, { kind: "v3", save })).toBe("welcome");
  });

  it("resumes a valid save after the welcome has been seen", () => {
    expect(chooseStartupDestination(true, { kind: "v3", save })).toBe("resume");
  });

  it("opens a fresh town when a returning visitor has no usable save", () => {
    expect(chooseStartupDestination(true, undefined)).toBe("fresh");
    expect(chooseStartupDestination(true, { kind: "legacy" })).toBe("fresh");
  });
});

