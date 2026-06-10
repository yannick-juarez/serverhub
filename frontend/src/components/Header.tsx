// Header.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import HeaderProfile from './Header/HeaderProfile';
import HeaderWorkspaces from './Header/HeaderWorkspaces';
import { useLocation } from 'react-router-dom';
import { apps } from '../apps/index';
import { FaGlobe } from 'react-icons/fa';

const coreSettingsApp = {
  to: '/settings',
  title: 'SETTINGS',
  menus: [] as Array<{ label: string; items: Array<{ name: string; shortcut?: string; action?: () => void }> }>,
};

const coreApplicationsApp = {
  to: '/applications',
  title: 'APPLICATIONS',
  menus: [] as Array<{ label: string; items: Array<{ name: string; shortcut?: string; action?: () => void }> }>,
};

const HeaderActionMenu = ({
  label,
  items,
}: {
  label: string;
  items: Array<{ name: string; shortcut?: string; action?: () => void }>;
}) => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div ref={menuRef} className="relative flex flex-row justify-center items-center">
      <button
        type="button"
        className="uppercase text-xs text-white/80 hover:bg-white/10 px-3 py-1"
        onClick={() => setOpen((value) => !value)}
      >
        {label}
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-50 mt-1 w-auto origin-top-left rounded-lg border border-white/10 bg-black/20 text-white backdrop-blur-md focus:outline-none">
          {items.map(({ name, shortcut, action }, index) => (
            <div key={name} className="flex flex-col">
              {index > 0 ? <div className="mx-2 h-px bg-white/10" /> : null}
              <button
                type="button"
                className="group flex w-full items-center gap-1 px-3 py-1.5 text-xs hover:bg-white/10"
                onClick={() => {
                  setOpen(false);
                  action?.();
                }}
              >
                {name}
                <kbd className="ml-auto font-sans text-xs text-white/50">{shortcut}</kbd>
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};

const Header: React.FC<{ opaque?: boolean }> = ({ opaque = true }) => {
  const location = useLocation();

  const currentApp = useMemo(() => {
    return apps.find(app => {
      if (app.to === '/') {
        return location.pathname === '/';
      }
      return location.pathname.startsWith(app.to);
    }) ?? (location.pathname.startsWith('/settings')
      ? coreSettingsApp
      : location.pathname.startsWith('/applications') || location.pathname.startsWith('/apps')
        ? coreApplicationsApp
        : undefined);
  }, [location.pathname]);

  const title = currentApp?.title || 'AI NETWORK OPERATIONS';
  const actionMenus = useMemo(() => {
    const baseMenus = (currentApp?.menus || []).map((menu) => ({
      ...menu,
      items: [...menu.items],
    }));
    const viewMenuIndex = baseMenus.findIndex((menu) => menu.label === 'View');
    const fullscreenItem = {
      name: 'Toggle fullscreen',
      shortcut: 'F11',
      action: () => {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          document.documentElement.requestFullscreen();
        }
      },
    };

    if (viewMenuIndex === -1) {
      baseMenus.push({
        label: 'View',
        items: [fullscreenItem],
      });
      return baseMenus;
    }

    const viewMenu = baseMenus[viewMenuIndex];
    if (!viewMenu.items.some((item) => item.name === fullscreenItem.name)) {
      viewMenu.items = [...viewMenu.items, fullscreenItem];
    }

    return baseMenus;
  }, [currentApp]);

  return (
    <div className="w-full left-0 right-0 z-[999]">
      <div className={`backdrop-blur-${opaque ? 'lg' : 'sm'} bg-black/${opaque ? '20' : '0'} flex items-center justify-between px-4 ${opaque ? 'border-b' : ''} border-white/10 text-xs z-50 w-full`}>
        <div className="flex items-center space-x-4 z-50">
          <h1 className="text-xs font-bold text-white uppercase font-sans">{title}</h1>
          <div className="flex flex-row justify-center items-center z-50">
            {actionMenus?.map(({ label, items }, idx) => (
              <div className="flex flex-row justify-center items-center" key={idx}>
                <div className="h-4 w-px bg-white/20 mx-2" />
                <HeaderActionMenu label={label} items={items} />
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center space-x-2 z-50 py-1">
            <div className='flex items-center space-x-1 border-r pr-2 border-white/20'>
              {/* checkbox green and saved label */}
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-gray-300 text-xs font-semibold">Saved</span>
            </div>
            <div className='flex flex-row gap-1 items-center justify-center'>
              <div className='border border-sky-300/30 bg-sky-300/20 p-1 rounded-md'>
                <FaGlobe className="text-white/80 w-2.5 h-2.5" />
              </div>
              <div className='font-semibold text-gray-200 text-xs'>Untitled Sample File*</div>
            </div>
            {/* drop down icon */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
            </svg>
        </div>
        <div className="flex items-center space-x-2 z-50">
          <div className='border-r border-gray-500 h-4'></div>
          <div className="flex flex-row items-center space-x-1 px-2 py-1">
            <span className="bg-red-600 rounded-full h-2 w-2 mr-1"></span>
            <span className="text-white text-xs font-semibold">3 Notifications</span>
          </div>
          <div className='border-r border-gray-500 h-4'></div>
          <HeaderWorkspaces />
          <div className='border-r border-gray-500 h-4'></div>
          <HeaderProfile />
        </div>
      </div>
    </div>
  );
};

export default Header;
