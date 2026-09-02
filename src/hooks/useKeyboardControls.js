import { useEffect } from "react";
import {
  isGameplayActive,
  useSimulationStore,
} from "../store/useSimulationStore";

export const KEY_BINDINGS = {
  KeyW: "forward",
  ArrowUp: "forward",
  KeyS: "backward",
  ArrowDown: "backward",
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
  KeyQ: "descend",
  KeyE: "ascend",
};

const INTERACTIVE_SELECTOR = [
  "button",
  "a[href]",
  "input",
  "textarea",
  "select",
  "option",
  "[contenteditable='true']",
  "[role='button']",
  "[role='dialog']",
].join(",");

export function isInteractiveTarget(target) {
  return (
    target instanceof Element && Boolean(target.closest(INTERACTIVE_SELECTOR))
  );
}

export function useKeyboardControls() {
  useEffect(() => {
    // --- Shared lifecycle cleanup ---

    const clearInput = () => useSimulationStore.getState().clearInput();

    // --- Keyboard press handling ---

    function handleKeyDown(event) {
      const state = useSimulationStore.getState();

      // Escape controls only the topmost dialog and is not a gameplay action.
      if (event.code === "Escape" && !event.repeat) {
        if (state.showControls) {
          event.preventDefault();
          state.closeControls();
        } else if (state.mission.status === "running") {
          event.preventDefault();
          state.pause();
        } else if (state.mission.status === "paused" && state.showSettings) {
          event.preventDefault();
          state.resume();
        }

        return;
      }

      // Preserve native keyboard behavior for controls, forms, links, and dialogs.
      if (isInteractiveTarget(event.target) || !isGameplayActive(state)) {
        return;
      }

      const movementAction = KEY_BINDINGS[event.code];

      if (movementAction) {
        event.preventDefault();

        if (!event.repeat) {
          state.setInput(movementAction, true);
        }

        return;
      }

      if (event.repeat) {
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        state.stabilize();
      } else if (event.code === "KeyC") {
        state.cycleCamera();
      } else if (event.code === "KeyF") {
        state.cycleLights();
      } else if (event.code === "KeyR") {
        state.fireSonar();
      } else if (event.code === "KeyX") {
        state.scanNearby();
      }
    }

    function handleKeyUp(event) {
      const movementAction = KEY_BINDINGS[event.code];

      if (movementAction) {
        useSimulationStore.getState().setInput(movementAction, false);
      }
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        clearInput();
      }
    }

    // --- Listener registration and Strict Mode-safe cleanup ---

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", clearInput);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", clearInput);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearInput();
    };
  }, []);
}
