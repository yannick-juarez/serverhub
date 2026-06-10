import { settingsSection as bannersSettingsSection } from "./sections/banners";
import { settingsSection as workspacesSettingsSection } from "./sections/workspaces";
import { settingsSection as usersSettingsSection } from "./sections/users";
import { settingsSection as updatesSettingsSection } from "./sections/updates";
import { settingsSection as systemSettingsSection } from "./sections/system";
import { settingsSection as applicationsSettingsSection } from "./sections/applications";
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
    .filter((section): section is SettingsSectionDefinition => Boolean(section))
    .map((section) => ({
      ...section,
      group: section.group ?? "apps",
    }));

  const builtInSystemSections: SettingsSectionDefinition[] = [
    bannersSettingsSection,
    workspacesSettingsSection,
    usersSettingsSection,
    updatesSettingsSection,
    systemSettingsSection,
  ].map((section) => ({
    ...section,
    group: "system",
  }));

  const builtInAppsSections: SettingsSectionDefinition[] = [applicationsSettingsSection].map((section) => ({
    ...section,
    group: "apps",
  }));

  return [...builtInSystemSections, ...builtInAppsSections, ...contributed].sort((a, b) => {
    const orderA = a.order ?? 100;
    const orderB = b.order ?? 100;
    if (orderA !== orderB) return orderA - orderB;
    return a.key.localeCompare(b.key);
  });
}