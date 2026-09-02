import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import TouchControls from "../components/hud/TouchControls";
import { useKeyboardControls } from "../hooks/useKeyboardControls";
import { useSimulationStore } from "../store/useSimulationStore";

function KeyboardHarness() {
  useKeyboardControls();

  return (
    <div>
      <button type="button">Interface action</button>
      <input aria-label="Text field" />
      <div contentEditable suppressContentEditableWarning>
        Editable field
      </div>
    </div>
  );
}

function resetRunningState() {
  useSimulationStore.setState({
    mission: { status: "running", step: 0 },
    showControls: false,
    showSettings: false,
    controlsReturnStatus: null,
    input: {},
    speed: 0,
    verticalSpeed: 0,
  });
}

describe("keyboard input lifecycle", () => {
  beforeEach(() => {
    resetRunningState();
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
  });

  it("activates input on keydown and releases it on keyup", () => {
    render(<KeyboardHarness />);

    fireEvent.keyDown(window, { code: "KeyW" });
    expect(useSimulationStore.getState().input.forward).toBe(true);

    fireEvent.keyUp(window, { code: "KeyW" });
    expect(useSimulationStore.getState().input.forward).toBeUndefined();
  });

  it("clears input on blur and visibility loss", () => {
    render(<KeyboardHarness />);
    fireEvent.keyDown(window, { code: "KeyW" });
    fireEvent.blur(window);
    expect(useSimulationStore.getState().input).toEqual({});

    fireEvent.keyDown(window, { code: "KeyD" });
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    fireEvent(document, new Event("visibilitychange"));
    expect(useSimulationStore.getState().input).toEqual({});
  });

  it("pause and restart clear active input", () => {
    useSimulationStore.setState({ input: { forward: true, right: true } });
    useSimulationStore.getState().pause();
    expect(useSimulationStore.getState().input).toEqual({});

    useSimulationStore.setState({ input: { ascend: true } });
    useSimulationStore.getState().restart();
    expect(useSimulationStore.getState().input).toEqual({});
  });

  it("does not steal shortcuts from interactive elements", () => {
    render(<KeyboardHarness />);
    const button = screen.getByRole("button", { name: "Interface action" });
    const input = screen.getByRole("textbox", { name: "Text field" });

    button.focus();
    const spaceWasNotCancelled = fireEvent.keyDown(button, { code: "Space" });
    fireEvent.keyDown(button, { code: "KeyD" });
    fireEvent.keyDown(input, { code: "ArrowUp" });

    expect(spaceWasNotCancelled).toBe(true);
    expect(useSimulationStore.getState().input).toEqual({});
    expect(useSimulationStore.getState().heading).toBe(0);
  });

  it("blocks gameplay shortcuts behind a modal", () => {
    render(<KeyboardHarness />);
    const cameraBefore = useSimulationStore.getState().preferences.camera;

    useSimulationStore.getState().openControls();
    fireEvent.keyDown(window, { code: "KeyW" });
    fireEvent.keyDown(window, { code: "KeyC" });

    expect(useSimulationStore.getState().input).toEqual({});
    expect(useSimulationStore.getState().preferences.camera).toBe(cameraBefore);
  });
});

describe("touch input lifecycle", () => {
  beforeEach(resetRunningState);

  function preparePointerButton(button) {
    button.setPointerCapture = () => {};
    button.hasPointerCapture = () => true;
    button.releasePointerCapture = () => {};
  }

  it("releases input on pointer up, cancel and lost capture", () => {
    render(<TouchControls />);
    const button = screen.getByRole("button", { name: "Move forward" });
    preparePointerButton(button);

    fireEvent.pointerDown(button, { pointerId: 1 });
    expect(useSimulationStore.getState().input.forward).toBe(true);
    fireEvent.pointerUp(button, { pointerId: 1 });
    expect(useSimulationStore.getState().input.forward).toBeUndefined();

    fireEvent.pointerDown(button, { pointerId: 2 });
    fireEvent.pointerCancel(button, { pointerId: 2 });
    expect(useSimulationStore.getState().input.forward).toBeUndefined();

    fireEvent.pointerDown(button, { pointerId: 3 });
    fireEvent.lostPointerCapture(button, { pointerId: 3 });
    expect(useSimulationStore.getState().input.forward).toBeUndefined();
  });

  it("supports independent multi-touch actions", () => {
    render(<TouchControls />);
    const forward = screen.getByRole("button", { name: "Move forward" });
    const ascend = screen.getByRole("button", { name: "Ascend" });
    preparePointerButton(forward);
    preparePointerButton(ascend);

    fireEvent.pointerDown(forward, { pointerId: 1 });
    fireEvent.pointerDown(ascend, { pointerId: 2 });
    fireEvent.pointerUp(forward, { pointerId: 1 });

    expect(useSimulationStore.getState().input.forward).toBeUndefined();
    expect(useSimulationStore.getState().input.ascend).toBe(true);

    fireEvent.pointerUp(ascend, { pointerId: 2 });
    expect(useSimulationStore.getState().input).toEqual({});
  });
});
