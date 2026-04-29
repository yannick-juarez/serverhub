import { FaServer } from 'react-icons/fa';
import type { AppManifest } from '../types';

export const app: AppManifest = {
  id: 'monitoring',
  to: '/monitoring',
  icon: <FaServer className="h-4 w-4" />,
  label: 'Monitoring',
  title: 'MONITORING',
  menus: [],
  showInFooter: false,
  showInSideDock: true,
  color: {
    border: 'border-green-500/70',
    background: 'bg-green-500/40',
    hover: { border: 'hover:border-green-400/30', background: 'hover:bg-green-400/30' },
    idle: { border: 'border-green-500/20', background: 'bg-green-500/10' },
  },
  requiresAuth: true,
  order: 20,
};
