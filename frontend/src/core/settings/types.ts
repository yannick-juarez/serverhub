import type { ComponentType } from "react";
import type { IconType } from "react-icons";
import type { AppColor } from "../../apps/types";

export type SettingsSectionGroup = "system" | "apps";

export type SettingsSectionDefinition = {
  key: string;
  label: string;
  description: string;
  component: ComponentType;
  icon?: IconType;
  color?: AppColor;
  order?: number;
  group?: SettingsSectionGroup;
};
