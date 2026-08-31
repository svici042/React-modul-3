import { useEffect } from "react";
import { useSimulationStore } from "../store/useSimulationStore";

const bindings = {
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

export function useKeyboardControls() {
  useEffect(() => {
    // Valdymo klavišai ignoruojami, kai vartotojas rašo formos lauke.
    const typing = (target) =>
      ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName);
    const onKey = (event, value) => {
      if (typing(event.target)) return;
      const action = bindings[event.code];
      if (action) {
        event.preventDefault();
        useSimulationStore.getState().setInput(action, value);
        return;
      }
      if (!value || event.repeat) return;
      const s = useSimulationStore.getState();
      if (event.code === "Space") {
        event.preventDefault();
        s.stop();
      }
      if (event.code === "KeyC") s.cycleCamera();
      if (event.code === "KeyF") s.cycleLights();
      if (event.code === "KeyR") s.fireSonar();
      if (event.code === "KeyX") s.scanNearby();
      if (event.code === "Escape") {
        if (s.mission.status === "paused") s.resume();
        else s.pause();
      }
    };
    const down = (e) => onKey(e, true);
    const up = (e) => onKey(e, false);

    // Klausytuvai registruojami vieną kartą ir pašalinami komponentui užsidarant.
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", useSimulationStore.getState().stop);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", useSimulationStore.getState().stop);
    };
  }, []);
}
