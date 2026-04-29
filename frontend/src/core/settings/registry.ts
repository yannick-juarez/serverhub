import { settingsSection as bannersSettingsSection } from "./sections/banners";
import { settingsSection as workspacesSettingsSection } from "./sections/workspaces";
import { settingsSection as usersSettingsSection } from "./sections/users";
import { settingsSection as updatesSettingsSection } from "./sections/updates";
import type { SettingsSectionDefinition } from "./types";

type SettingsModule = {
  settingsSection?: SettingsSectionDefinition;
};

const appSettingsModules = import.meta.glob<SettingsModule>("../../apps/*/settings.tsx", {
  eager: true,
});

export function getSettingsSections(): SettingsSectionDefinition[] {
  const contributed = Object.values(appSettingsModules)
    .map((module) => module.settingsSection)
    .filter((section): section is SettingsSectionDefinition => Boolean(section));

  return [bannersSettingsSection, workspacesSettingsSection, usersSettingsSection, updatesSettingsSection, ...contributed].sort((a, b) => {
    const orderA = a.order ?? 100;
    const orderB = b.order ?? 100;
    if (orderA !== orderB) return orderA - orderB;
    return a.key.localeCompare(b.key);
  });
}