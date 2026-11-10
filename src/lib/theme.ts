// Light / dark theme preference, stored per browser. Light is the default; "system" (shown as Auto)
// follows the device setting only when the user picks it.

export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "oasys-theme";
const CHANGE_EVENT = "oasys-theme-change";
const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * Runs inline in <head> before the first paint so a dark-mode visitor never sees a white flash.
 * Kept dependency-free and wrapped in try/catch (storage can be blocked in private windows).
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${STORAGE_KEY}");var d=t==="dark"||(t==="system"&&window.matchMedia("${DARK_QUERY}").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;

export function getThemePreference(): ThemePreference {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "dark" || value === "system" ? value : "light";
  } catch {
    return "light";
  }
}

function systemPrefersDark() {
  return typeof window !== "undefined" && window.matchMedia(DARK_QUERY).matches;
}

export function resolveTheme(pref: ThemePreference): "light" | "dark" {
  return pref === "system" ? (systemPrefersDark() ? "dark" : "light") : pref;
}

function applyTheme(pref: ThemePreference) {
  document.documentElement.classList.toggle("dark", resolveTheme(pref) === "dark");
}

export function setThemePreference(pref: ThemePreference) {
  try {
    if (pref === "light") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    // Storage blocked: the choice still applies to this page view.
  }
  applyTheme(pref);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** useSyncExternalStore subscriber: own changes, other tabs, and device theme changes. */
export function subscribeTheme(onChange: () => void) {
  const media = window.matchMedia(DARK_QUERY);
  const onSystem = () => {
    if (getThemePreference() === "system") applyTheme("system");
    onChange();
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key !== null && e.key !== STORAGE_KEY) return;
    applyTheme(getThemePreference());
    onChange();
  };
  media.addEventListener("change", onSystem);
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    media.removeEventListener("change", onSystem);
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}
