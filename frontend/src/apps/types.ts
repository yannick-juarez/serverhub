import { ComponentType, ReactNode } from 'react';
import { MenuConfig } from '../menus/MenuConfig';

export type AppColor = {
  border: string;
  background: string;
  hover: { border: string; background: string };
  idle: { border: string; background: string };
};

export interface AppManifest {
  id: string;
  to: string;
  routes?: string[];
  icon: ReactNode;
  label: string;
  title: string;
  menus?: MenuConfig[];
  color: AppColor;
  isInternal?: boolean;
  showInFooter?: boolean;
  showInSideDock?: boolean;
  isBottomItem?: boolean;
  requiresAuth?: boolean;
  order?: number;
}

export interface AppDefinition extends AppManifest {
  page: ComponentType;
}
