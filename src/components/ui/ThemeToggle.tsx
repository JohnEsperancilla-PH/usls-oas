"use client";

import { useSyncExternalStore } from "react";
import { getThemePreference, resolveTheme, setThemePreference, subscribeTheme, type ThemePreference } from "@/lib/theme";

const ICONS = {
  light: "M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z",
  dark: "M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z",
  system: "M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
} as const;

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "Auto" },
];

function Icon({ path, className = "w-4 h-4" }: { path: string; className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={path} />
    </svg>
  );
}

function useThemePreference() {
  // Server snapshot is the default (light); the saved value is picked up right after hydration.
  return useSyncExternalStore(subscribeTheme, getThemePreference, () => "light" as ThemePreference);
}

function useIsDark() {
  return useSyncExternalStore(subscribeTheme, () => resolveTheme(getThemePreference()) === "dark", () => false);
}

/**
 * Theme switch.
 *  - "icon": one round button that flips between light and dark (for page headers).
 *  - "segmented": Light / Dark / Auto choice (for the admin sidebar).
 */
export function ThemeToggle({ variant = "icon", className = "" }: { variant?: "icon" | "segmented"; className?: string }) {
  const pref = useThemePreference();
  const isDark = useIsDark();

  if (variant === "segmented") {
    return (
      <div role="radiogroup" aria-label="Appearance" className={`flex items-center gap-0.5 p-0.5 rounded-lg bg-gray-100 ${className}`}>
        {OPTIONS.map((opt) => {
          const active = pref === opt.value;
          return (
            <button key={opt.value} type="button" role="radio" aria-checked={active} onClick={() => setThemePreference(opt.value)}
              title={opt.value === "system" ? "Match this device's setting" : `${opt.label} mode`}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${active ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"}`}>
              <Icon path={ICONS[opt.value]} className="w-3.5 h-3.5" />
              {opt.label}
            </button>
          );
        })}
      </div>
    );
  }

  const next = isDark ? "light" : "dark";
  return (
    <button type="button" onClick={() => setThemePreference(next)} aria-label={`Switch to ${next} mode`} title={`Switch to ${next} mode`}
      className={`inline-flex items-center justify-center w-9 h-9 rounded-full text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors ${className}`}>
      <Icon path={isDark ? ICONS.light : ICONS.dark} className="w-5 h-5" />
    </button>
  );
}
