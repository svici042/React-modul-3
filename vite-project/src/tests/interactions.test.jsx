import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { useSimulationStore } from "../store/useSimulationStore";

vi.mock("../scene/UnderwaterScene", () => ({
  default: () => <div data-testid="scene" />,
}));
beforeEach(() =>
  act(() =>
    useSimulationStore.setState({
      mission: { status: "intro", step: 0 },
      showControls: false,
      showSettings: false,
    }),
  ),
);

describe("application controls", () => {
  it("starts the mission from the briefing", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /begin descent/i }));
    expect(useSimulationStore.getState().mission.status).toBe("running");
  });
  it("pauses, resumes, and restarts", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /begin descent/i }));
    fireEvent.click(screen.getByTitle(/pause simulation/i));
    expect(
      screen.getByRole("dialog", { name: /simulation paused/i }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /resume dive/i }));
    expect(useSimulationStore.getState().mission.status).toBe("running");
    act(() => useSimulationStore.getState().pause());
    fireEvent.click(screen.getByRole("button", { name: /restart mission/i }));
    expect(useSimulationStore.getState().mission.step).toBe(0);
  });
});
