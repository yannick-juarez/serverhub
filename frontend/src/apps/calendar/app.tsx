import { CalendarDaysIcon } from '@heroicons/react/24/outline';
import type { AppManifest } from '../types';

export const app: AppManifest = {
  id: 'calendar',
  to: '/calendar',
  icon: <CalendarDaysIcon className="h-4 w-4" />,
  label: 'Calendar',
  title: 'CALENDAR',
  menus: [],
  showInFooter: false,
  showInSideDock: true,
  color: {
    border: 'border-red-500/70',
    background: 'bg-red-500/40',
    hover: { border: 'hover:border-red-400/30', background: 'hover:bg-red-400/30' },
    idle: { border: 'border-red-500/20', background: 'bg-red-500/10' },
  },
  requiresAuth: true,
  order: 55,
};
