import { describe, expect, it } from "vitest";
import { loadPreferences } from "../utils/preferences";

describe("preferences", () => {
  it("loads valid saved values", () => {
    localStorage.setItem(
      "deep-sea-preferences",
      JSON.stringify({ quality: "low" }),
    );
    expect(loadPreferences().quality).toBe("low");
  });
  it("recovers from malformed storage", () => {
    localStorage.setItem("deep-sea-preferences", "{bad");
    expect(loadPreferences()).toMatchObject({
      quality: "medium",
      camera: "follow",
    });
  });
});
