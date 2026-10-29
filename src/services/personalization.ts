const STORAGE_KEY = "maehwa-melo:personalization:v1";

export interface PersonalizationPreferences {
  ambientBackground: boolean;
  motionEffects: boolean;
  accentColor: string;
}

export const ACCENT_PALETTE = [
  { name: "기본", color: "#d5aa83" },
  { name: "세이지", color: "#91b397" },
  { name: "하늘", color: "#83a9cf" },
  { name: "라벤더", color: "#ad96cf" },
  { name: "로즈", color: "#d28fa5" },
  { name: "민트", color: "#75b8aa" },
  { name: "스칼렛", color: "#e5484d" },
  { name: "코발트", color: "#4169e1" },
  { name: "바이올렛", color: "#8b5cf6" },
] as const;

const DEFAULT_PREFERENCES: PersonalizationPreferences = {
  ambientBackground: true,
  motionEffects: true,
  accentColor: ACCENT_PALETTE[0].color,
};

export function readPersonalizationPreferences(): PersonalizationPreferences {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<PersonalizationPreferences>;
    const accentColor = ACCENT_PALETTE.some((item) => item.color === stored.accentColor) ? stored.accentColor! : DEFAULT_PREFERENCES.accentColor;
    return {
      ambientBackground: stored.ambientBackground ?? DEFAULT_PREFERENCES.ambientBackground,
      motionEffects: stored.motionEffects ?? DEFAULT_PREFERENCES.motionEffects,
      accentColor,
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function updatePersonalizationPreference<K extends keyof PersonalizationPreferences>(key: K, value: PersonalizationPreferences[K]): PersonalizationPreferences {
  if (key === "accentColor" && !ACCENT_PALETTE.some((item) => item.color === value)) return readPersonalizationPreferences();
  const preferences = { ...readPersonalizationPreferences(), [key]: value };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Keep the current session preference even when storage is unavailable.
  }
  return preferences;
}

export function applyPersonalizationPreferences(preferences = readPersonalizationPreferences()): void {
  document.documentElement.style.setProperty("--accent", preferences.accentColor);
  document.body.classList.toggle("personal-no-ambient", !preferences.ambientBackground);
  document.body.classList.toggle("personal-no-motion", !preferences.motionEffects);
}
