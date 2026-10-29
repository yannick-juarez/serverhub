import { createContext, useContext, useLayoutEffect, type Dispatch, type SetStateAction } from 'react';
import type { MenuConfig } from '../../menus/MenuConfig';

export interface AppHeaderConfig {
  menus: MenuConfig[];
  status?: { tone: 'idle' | 'pending' | 'success' | 'error'; text: string };
  selection?: {
    label: string;
    value: string | null;
    placeholder: string;
    disabled: boolean;
    options: Array<{ value: string; label: string; detail: string }>;
    onChange: (value: string) => void;
  };
}

export const AppHeaderContext = createContext<AppHeaderConfig | null>(null);
export const AppHeaderSetterContext = createContext<Dispatch<SetStateAction<AppHeaderConfig | null>> | null>(null);

export function useAppHeader(config: AppHeaderConfig): void {
  const setHeader = useContext(AppHeaderSetterContext);
  useLayoutEffect(() => {
    if (!setHeader) throw new Error('useAppHeader requires AppHeaderProvider.');
    setHeader(config);
    return () => setHeader(null);
  }, [config, setHeader]);
}
