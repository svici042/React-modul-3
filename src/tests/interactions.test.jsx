import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { defaultProgress } from "../utils/progression";
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
      controlsReturnStatus: null,
      input: {},
    }),
  ),
);

describe("application controls", () => {
  it("shows mission selection and the first-launch tutorial", () => {
    useSimulationStore.setState({
      mission: { status: "select", step: 0 },
      progress: defaultProgress(),
      tutorialComplete: false,
      tutorialStep: 0,
    });
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /training dive/i }));
    expect(
      screen.getByRole("dialog", { name: /pilot tutorial/i }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /skip tutorial/i }));
    expect(
      screen.getByRole("button", { name: /begin descent/i }),
    ).toBeInTheDocument();
  });

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

  it("pauses behind the controls guide and restores gameplay on close", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /begin descent/i }));
    const controlsTrigger = screen.getByTitle(/open controls guide/i);

    useSimulationStore.setState({ input: { forward: true } });
    controlsTrigger.focus();
    fireEvent.click(controlsTrigger);

    expect(useSimulationStore.getState().mission.status).toBe("paused");
    expect(useSimulationStore.getState().input).toEqual({});

    fireEvent.click(screen.getByRole("button", { name: /close controls/i }));

    expect(useSimulationStore.getState().mission.status).toBe("running");
    expect(controlsTrigger).toHaveFocus();
  });

  it("reopens the tutorial from the pause settings", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /begin descent/i }));
    fireEvent.click(screen.getByTitle(/pause simulation/i));
    fireEvent.click(screen.getByRole("button", { name: /reopen tutorial/i }));

    expect(
      screen.getByRole("dialog", { name: /pilot tutorial/i }),
    ).toBeInTheDocument();
  });
});
