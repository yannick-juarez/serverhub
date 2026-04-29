import { HiOutlineCircleStack } from 'react-icons/hi2';
import type { AppManifest } from '../types';

export const app: AppManifest = {
  id: 'sources',
  to: '/sources',
  icon: <HiOutlineCircleStack className="h-4 w-4" />,
  label: 'Sources',
  title: 'SOURCES',
  menus: [],
  isInternal: true,
  showInFooter: false,
  showInSideDock: false,
  color: {
    border: 'border-orange-500/70',
    background: 'bg-orange-500/40',
    hover: { border: 'hover:border-orange-400/30', background: 'hover:bg-orange-400/30' },
    idle: { border: 'border-orange-500/20', background: 'bg-orange-500/10' },
  },
  requiresAuth: true,
  order: 35,
};
