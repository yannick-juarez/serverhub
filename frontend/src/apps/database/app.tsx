import { FaDatabase } from 'react-icons/fa';
import type { AppManifest } from '../types';

export const app: AppManifest = {
  id: 'database',
  to: '/database',
  routes: ['/database', '/database/:sourceId'],
  icon: <FaDatabase className="h-4 w-4" />,
  label: 'Database',
  title: 'DATABASE',
  menus: [
    {
      label: 'Database',
      items: [{ name: 'Add Database', shortcut: 'Ctrl+N', action: () => {} }],
    },
  ],
  showInFooter: false,
  showInSideDock: true,
  color: {
    border: 'border-yellow-500/70',
    background: 'bg-yellow-500/40',
    hover: { border: 'hover:border-yellow-400/30', background: 'hover:bg-yellow-400/30' },
    idle: { border: 'border-yellow-500/20', background: 'bg-yellow-500/10' },
  },
  requiresAuth: true,
  order: 30,
};
