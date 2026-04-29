// Header.tsx
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import HeaderProfile from './Header/HeaderProfile';
import HeaderWorkspaces from './Header/HeaderWorkspaces';
import React from 'react';
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

const Header: React.FC<{ opaque?: boolean }> = ({ opaque = true }) => {
  const location = useLocation();
  
  const currentApp = apps.find(app => {
    if (app.to === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(app.to);
  }) ?? (location.pathname.startsWith('/settings')
    ? coreSettingsApp
    : location.pathname.startsWith('/applications') || location.pathname.startsWith('/apps')
      ? coreApplicationsApp
      : undefined);

  const title = currentApp?.title || 'AI NETWORK OPERATIONS';
  const actionMenus = currentApp?.menus || [];

  const setFullscreenMenu = () => {
    let viewMenu = actionMenus.find(menu => menu.label === 'View');

    if (!viewMenu) {
      viewMenu = {
        label: 'View',
        items: []
      }
      actionMenus.push(viewMenu);
    }
    
    const toggleFullscreen = viewMenu.items.find(item => item.name === 'Toggle fullscreen');
    if (!toggleFullscreen) {
      viewMenu.items.push({ 
        name: 'Toggle fullscreen', 
        shortcut: 'F11', 
        action: () => { 
          if (document.fullscreenElement) {
            document.exitFullscreen();
          } else {
            document.documentElement.requestFullscreen();
          }
        }
      });
    }
  }

  setFullscreenMenu();

  return (
    <div className="w-full left-0 right-0 z-[999]">
      <div className={`backdrop-blur-${opaque ? 'lg' : 'sm'} bg-black/${opaque ? '20' : '0'} flex items-center justify-between px-4 ${opaque ? 'border-b' : ''} border-white/10 text-xs z-50 w-full`}>
        <div className="flex items-center space-x-4 z-50">
          <h1 className="text-xs font-bold text-white uppercase font-sans">{title}</h1>
          <div className="flex flex-row justify-center items-center z-50">
            {actionMenus?.map(({ label, items }, idx) => (
              <div className='flex flex-row justify-center items-center' key={idx}>
                <div className="h-4 w-px bg-white/20 mx-2" />
                <Menu key={idx}>
                  <MenuButton className="uppercase text-xs text-white/80 hover:bg-white/10 px-3 py-1">
                    {label}
                  </MenuButton>
                  <MenuItems
                    transition
                    anchor="bottom start"
                    className={`w-auto origin-top-left border border-white/10 rounded-lg bg-black/20 backdrop-blur-md text-white transition duration-100 ease-out [--anchor-gap:var(--spacing-1)] focus:outline-none data-[closed]:scale-95 data-[closed]:opacity-0 z-50`}
                  >
                    {items.map(({ name, shortcut, action }, i) => (
                      <MenuItem key={i}>
                        <div className='flex flex-col'>
                          { i > 0 && <div className="h-px bg-white/10 mx-2" /> }
                          <button
                            className="group flex w-full text-xs items-center gap-1 py-1.5 px-3 data-[focus]:bg-white/5 hover:bg-white/10"
                            onClick={action}
                          >
                            {name}
                            <kbd className="ml-auto font-sans text-xs text-white/50 group-data-[focus]:inline">
                              {shortcut}
                            </kbd>
                          </button>
                        </div>
                      </MenuItem>
                    ))}
                  </MenuItems>
                </Menu>
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
