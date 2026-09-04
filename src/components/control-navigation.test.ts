import { describe, expect, it } from "vitest";
import { desktopCitizenInputMode } from "./controlNavigation";

describe("desktop citizen controls", () => {
  it("uses direct camera-relative movement in chase and overhead views", () => {
    expect(desktopCitizenInputMode("chase")).toBe("directional");
    expect(desktopCitizenInputMode("overhead")).toBe("directional");
  });

  it("reserves forward-and-turn steering for the citizen's native view", () => {
    expect(desktopCitizenInputMode("native")).toBe("steering");
  });
});
