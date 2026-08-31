const DEFAULTS = {
  quality: "medium",
  muted: false,
  reducedMotion: false,
  camera: "follow",
};
export function loadPreferences(storage = globalThis.localStorage) {
  try {
    const value = JSON.parse(storage?.getItem("deep-sea-preferences") || "{}");
    return {
      ...DEFAULTS,
      ...(value && typeof value === "object" ? value : {}),
    };
  } catch {
    // Sugadintas JSON arba užblokuotas localStorage neturi sustabdyti programos.
    return { ...DEFAULTS };
  }
}
export function savePreferences(value, storage = globalThis.localStorage) {
  try {
    storage?.setItem("deep-sea-preferences", JSON.stringify(value));
  } catch {
    // Kai kurios naršyklės privačiame režime draudžia rašyti į localStorage.
  }
}
export function resetPreferences(storage = globalThis.localStorage) {
  try {
    storage?.removeItem("deep-sea-preferences");
  } catch {
    // Nustatymai vis tiek grąžinami, net jeigu saugyklos išvalyti nepavyko.
  }
  return { ...DEFAULTS };
}
export { DEFAULTS };
