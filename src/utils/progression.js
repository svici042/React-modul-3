import { LEVEL_IDS } from "../data/levels";

const PROGRESS_KEY = "deep-sea-level-progress";
const TUTORIAL_KEY = "deep-sea-tutorial-complete";

export const defaultProgress = () => ({
  unlocked: [LEVEL_IDS[0]],
  completed: {},
  bestBattery: {},
});

export function loadProgress(storage = globalThis.localStorage) {
  try {
    const parsed = JSON.parse(storage?.getItem(PROGRESS_KEY) ?? "null");

    if (!parsed || !Array.isArray(parsed.unlocked)) {
      return defaultProgress();
    }

    const unlocked = parsed.unlocked.filter((id) => LEVEL_IDS.includes(id));

    return {
      unlocked: [...new Set([LEVEL_IDS[0], ...unlocked])],
      completed:
        parsed.completed && typeof parsed.completed === "object"
          ? Object.fromEntries(
              Object.entries(parsed.completed).filter(([id]) =>
                LEVEL_IDS.includes(id),
              ),
            )
          : {},
      bestBattery:
        parsed.bestBattery && typeof parsed.bestBattery === "object"
          ? Object.fromEntries(
              Object.entries(parsed.bestBattery)
                .filter(
                  ([id, value]) =>
                    LEVEL_IDS.includes(id) && Number.isFinite(value),
                )
                .map(([id, value]) => [id, Math.min(100, Math.max(0, value))]),
            )
          : {},
    };
  } catch {
    return defaultProgress();
  }
}

export function saveProgress(progress, storage = globalThis.localStorage) {
  try {
    storage?.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // Storage failures must not interrupt gameplay.
  }
}

export function completeLevel(progress, levelId, battery) {
  const index = LEVEL_IDS.indexOf(levelId);
  const nextId = LEVEL_IDS[index + 1];
  const best = progress.bestBattery[levelId];
  const updated = {
    unlocked: [
      ...new Set([...progress.unlocked, levelId, ...(nextId ? [nextId] : [])]),
    ],
    completed: { ...progress.completed, [levelId]: true },
    bestBattery: {
      ...progress.bestBattery,
      [levelId]: best === undefined ? battery : Math.max(best, battery),
    },
  };

  saveProgress(updated);
  return updated;
}

export function resetProgress(storage = globalThis.localStorage) {
  const progress = defaultProgress();

  try {
    storage?.removeItem(PROGRESS_KEY);
  } catch {
    // Return defaults even when storage cannot be cleared.
  }

  return progress;
}

export function loadTutorialCompletion(storage = globalThis.localStorage) {
  try {
    return storage?.getItem(TUTORIAL_KEY) === "true";
  } catch {
    return false;
  }
}

export function saveTutorialCompletion(
  complete,
  storage = globalThis.localStorage,
) {
  try {
    storage?.setItem(TUTORIAL_KEY, String(Boolean(complete)));
  } catch {
    // Tutorial persistence is optional when storage is unavailable.
  }
}

export function resetTutorial(storage = globalThis.localStorage) {
  try {
    storage?.removeItem(TUTORIAL_KEY);
  } catch {
    // The in-memory tutorial state can still be reset.
  }

  return false;
}
