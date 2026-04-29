import { BiMessageDetail } from 'react-icons/bi';
import type { AppManifest } from '../types';

export const app: AppManifest = {
  id: 'messages',
  to: '/messages',
  icon: <BiMessageDetail className="h-4 w-4" />,
  label: 'Messages',
  title: 'MESSAGES',
  menus: [],
  showInFooter: false,
  showInSideDock: true,
  color: {
    border: 'border-sky-500/70',
    background: 'bg-sky-500/40',
    hover: { border: 'hover:border-sky-400/30', background: 'hover:bg-sky-400/30' },
    idle: { border: 'border-sky-500/20', background: 'bg-sky-500/10' },
  },
  requiresAuth: true,
  order: 15,
};
