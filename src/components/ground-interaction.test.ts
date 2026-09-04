import { describe, expect, it } from "vitest";
import { groundInteractionIntent } from "./groundInteraction";

describe("ground interaction priority", () => {
  it("targets placement instead of selecting citizens during autonomous carry", () => {
    expect(groundInteractionIntent("explore", "reinsert")).toBe("place");
  });

  it("keeps each normal world mode mapped to one intent", () => {
    expect(groundInteractionIntent("explore", "none")).toBe("select");
    expect(groundInteractionIntent("join", "reinsert")).toBe("place");
    expect(groundInteractionIntent("intervene", "none")).toBe("edit-boundary");
    expect(groundInteractionIntent("join", "carry")).toBe("none");
  });
});
