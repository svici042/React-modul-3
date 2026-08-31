import { distance3 } from "./calculations";

export const OBJECTIVES = [
  "Descend below 3,755 m",
  "Navigate to Beacon 07",
  "Use active sonar to locate the signal",
  "Approach the unidentified signal",
  "Scan three wreck data points",
  "Return to the extraction beacon",
];

// Funkcija yra be React ar Zustand priklausomybių, todėl misijos taisykles
// lengva testuoti pateikiant esamą misiją ir naujausią simuliacijos būseną.
export function progressMission(mission, snapshot) {
  if (snapshot.hull <= 0 || snapshot.battery <= 0) {
    return { ...mission, status: "failed" };
  }

  if (mission.status !== "running") {
    return mission;
  }

  let step = mission.step;

  if (step === 0 && snapshot.depth >= 3755) {
    step = 1;
  }

  if (step === 1 && distance3(snapshot.position, [0, 10, -38]) < 10) {
    step = 2;
  }

  if (
    step === 2 &&
    snapshot.sonarFired &&
    snapshot.contacts.includes("wreck")
  ) {
    step = 3;
  }

  if (step === 3 && distance3(snapshot.position, [46, 8, -74]) < 18) {
    step = 4;
  }

  if (step === 4 && snapshot.samples.length >= 3) {
    step = 5;
  }

  if (step === 5 && distance3(snapshot.position, [-7, 28, 12]) < 11) {
    return { ...mission, step: 6, status: "complete" };
  }

  return step === mission.step ? mission : { ...mission, step };
}
