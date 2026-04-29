import { FaFolder } from 'react-icons/fa';
import type { AppManifest } from '../types';

export const app: AppManifest = {
  id: 'folders',
  to: '/folders',
  routes: ['/folders', '/files'],
  icon: <FaFolder className="h-4 w-4" />,
  label: 'Files',
  title: 'FILES',
  menus: [
    {
      label: 'File',
      items: [
        { name: 'New Folder', shortcut: 'Ctrl+Shift+N', action: () => {} },
        { name: 'Upload File', shortcut: 'Ctrl+U', action: () => {} },
      ],
    },
  ],
  showInFooter: true,
  showInSideDock: true,
  color: {
    border: 'border-blue-500/70',
    background: 'bg-blue-500/40',
    hover: { border: 'hover:border-blue-400/30', background: 'hover:bg-blue-400/30' },
    idle: { border: 'border-blue-500/20', background: 'bg-blue-500/10' },
  },
  requiresAuth: true,
  order: 10,
};
