import { useState, type ReactNode } from 'react';
import { AppHeaderContext, AppHeaderSetterContext, type AppHeaderConfig } from './appHeader';

export default function AppHeaderProvider({ children }: { children: ReactNode }) {
  const [header, setHeader] = useState<AppHeaderConfig | null>(null);
  return (
    <AppHeaderSetterContext.Provider value={setHeader}>
      <AppHeaderContext.Provider value={header}>{children}</AppHeaderContext.Provider>
    </AppHeaderSetterContext.Provider>
  );
}
