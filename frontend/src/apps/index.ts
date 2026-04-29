import { lazy, type ComponentType } from 'react';
import type { AppDefinition, AppManifest } from './types';

type AppManifestModule = {
  app: AppManifest;
};

const appManifestModules = import.meta.glob<AppManifestModule>('./*/app.tsx', { eager: true });
const appPageModules = import.meta.glob('./*/page.tsx');

export const apps: AppDefinition[] = Object.values(appManifestModules)
  .map((module) => {
    const manifest = module.app;
    const pagePath = `./${manifest.id}/page.tsx`;
    const pageImporter = appPageModules[pagePath];

    if (!pageImporter) {
      throw new Error(`Missing page module for app '${manifest.id}' at ${pagePath}`);
    }

    const page = lazy(pageImporter as () => Promise<{ default: ComponentType }>);

    return {
      ...manifest,
      page,
    };
  })
  .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER));

export type { AppDefinition } from './types';
