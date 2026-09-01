// @vitest-environment node

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sceneSource = readFileSync(
  new URL("../scene/UnderwaterScene.jsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(new URL("../App.css", import.meta.url), "utf8");

describe("render and short-screen architecture", () => {
  it("keeps static World rendering independent from per-frame vehicle position", () => {
    const worldBody = sceneSource.slice(
      sceneSource.indexOf("function World()"),
      sceneSource.indexOf("export default function UnderwaterScene"),
    );

    expect(worldBody).not.toContain("useSimulationStore((s) => s.position)");
    expect(sceneSource).toContain("useSimulationStore.getState().position");
  });

  it("gives every modal a viewport-relative scroll boundary", () => {
    expect(styles).toMatch(
      /\.modal\s*{[^}]*max-height:\s*calc\(100dvh - 32px\)/s,
    );
    expect(styles).toMatch(/\.modal\s*{[^}]*overflow-y:\s*auto/s);
    expect(styles).toContain("overscroll-behavior: contain");
  });
});
