import { HiOutlineArchiveBox } from 'react-icons/hi2';
import type { AppManifest } from '../types';

export const app: AppManifest = {
  id: 'inventary',
  to: '/inventary',
  icon: <HiOutlineArchiveBox className="h-4 w-4" />,
  label: 'Inventary',
  title: 'INVENTARY',
  menus: [],
  showInFooter: false,
  showInSideDock: true,
  requiresAuth: true,
  order: 46,
  color: {
    border: 'border-emerald-500/70',
    background: 'bg-emerald-500/40',
    hover: { border: 'hover:border-emerald-400/30', background: 'hover:bg-emerald-400/30' },
    idle: { border: 'border-emerald-500/20', background: 'bg-emerald-500/10' },
  },
};
