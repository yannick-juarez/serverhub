import type { PreferencesResponse } from "../../api/settings";

export const APP_VISIBILITY_PREF_KEY = "appVisibilityById";
export const APP_ENABLED_PREF_KEY = "appEnabledById";

export type AppFlagMap = Record<string, boolean>;

function readBooleanMap(value: unknown): AppFlagMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const entries = Object.entries(value).filter((entry): entry is [string, boolean] => {
    const [, flag] = entry;
    return typeof flag === "boolean";
  });

  return Object.fromEntries(entries);
}

export function getAppVisibilityMap(preferences: PreferencesResponse | null | undefined): AppFlagMap {
  return readBooleanMap(preferences?.[APP_VISIBILITY_PREF_KEY]);
}

export function getAppEnabledMap(preferences: PreferencesResponse | null | undefined): AppFlagMap {
  return readBooleanMap(preferences?.[APP_ENABLED_PREF_KEY]);
}

export function isAppVisible(appId: string, visibilityMap: AppFlagMap): boolean {
  return visibilityMap[appId] !== false;
}

export function isAppEnabled(appId: string, enabledMap: AppFlagMap): boolean {
  return enabledMap[appId] !== false;
}
