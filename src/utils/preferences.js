const DEFAULTS = {
  quality: "medium",
  muted: false,
  reducedMotion: false,
  camera: "follow",
};

// --- Fault-tolerant preference persistence ---

export function loadPreferences(storage = globalThis.localStorage) {
  try {
    const value = JSON.parse(storage?.getItem("deep-sea-preferences") || "{}");
    return {
      ...DEFAULTS,
      ...(value && typeof value === "object" ? value : {}),
    };
  } catch {
    // Malformed JSON or blocked storage must not prevent application startup.
    return { ...DEFAULTS };
  }
}
export function savePreferences(value, storage = globalThis.localStorage) {
  try {
    storage?.setItem("deep-sea-preferences", JSON.stringify(value));
  } catch {
    // Some private browsing modes reject localStorage writes.
  }
}
export function resetPreferences(storage = globalThis.localStorage) {
  try {
    storage?.removeItem("deep-sea-preferences");
  } catch {
    // Return defaults even when the browser refuses to clear storage.
  }
  return { ...DEFAULTS };
}
export { DEFAULTS };
