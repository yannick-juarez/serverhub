// Header.tsx
import { useContext, useEffect, useMemo } from 'react';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import HeaderProfile from './Header/HeaderProfile';
import HeaderWorkspaces from './Header/HeaderWorkspaces';
import { useLocation } from 'react-router-dom';
import { apps } from '../apps/index';
import { HiOutlineArchiveBox, HiOutlineCheck, HiOutlineChevronDown, HiOutlineExclamationCircle } from 'react-icons/hi2';
import { AppHeaderContext } from './Header/appHeader';
import type { MenuConfig } from '../menus/MenuConfig';

const coreSettingsApp = {
  to: '/settings',
  title: 'SETTINGS',
  menus: [] as MenuConfig[],
};

const coreApplicationsApp = {
  to: '/applications',
  title: 'APPLICATIONS',
  menus: [] as MenuConfig[],
};

const HeaderActionMenu = ({
  label,
  items,
}: {
  label: string;
  items: MenuConfig['items'];
}) => {
  return (
    <Menu as="div" className="relative flex flex-row justify-center items-center">
      <MenuButton
        type="button"
        className="uppercase text-xs text-white/80 hover:bg-white/10 px-3 py-1"
      >
        {label}
      </MenuButton>
        <MenuItems modal={false} className="absolute left-0 top-full z-50 mt-1 min-w-56 rounded-lg border border-white/10 bg-zinc-950/95 p-1 text-white shadow-xl backdrop-blur-md focus:outline-none">
          {items.map(({ name, shortcut, action, disabled }) => (
            <MenuItem key={name} disabled={disabled}>
              <button
                type="button"
                disabled={disabled}
                className="group flex w-full items-center gap-6 whitespace-nowrap rounded px-3 py-2 text-left text-xs data-[focus]:bg-white/10 disabled:cursor-not-allowed disabled:text-white/30"
                onClick={action}
              >
                {name}
                <kbd className="ml-auto font-sans text-xs text-white/50">{shortcut}</kbd>
              </button>
            </MenuItem>
          ))}
        </MenuItems>
    </Menu>
  );
};

const Header: React.FC<{ opaque?: boolean }> = ({ opaque = true }) => {
  const location = useLocation();
  const appHeader = useContext(AppHeaderContext);

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
    const baseMenus = (appHeader?.menus ?? currentApp?.menus ?? []).map((menu) => ({
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
  }, [currentApp, appHeader]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.altKey || event.key.toLowerCase() !== 'n') return;
      const modified = event.ctrlKey || event.metaKey;
      if (!modified) {
        if (event.shiftKey || event.composedPath().some((target) => target instanceof HTMLElement
          && (target.isContentEditable || target.matches('input, textarea, select, [role="textbox"], [role="combobox"], [role="menu"], [role="menuitem"]')))) return;
      }
      const shortcut = modified ? (event.shiftKey ? 'Ctrl+Shift+N' : 'Ctrl+N') : 'N';
      const item = actionMenus.flatMap((menu) => menu.items).find((item) => item.shortcut === shortcut);
      if (!item) return;
      if (!modified && item.disabled) return;
      event.preventDefault();
      if (!event.repeat && !item.disabled) item.action?.();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [actionMenus]);

  return (
    <div className="w-full left-0 right-0 z-40">
      <div className={`backdrop-blur-${opaque ? 'lg' : 'sm'} bg-black/${opaque ? '20' : '0'} flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 ${appHeader ? 'lg:grid lg:grid-cols-[minmax(max-content,1fr)_minmax(0,auto)_minmax(max-content,1fr)]' : ''} ${opaque ? 'border-b' : ''} border-white/10 text-xs z-50 w-full`}>
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
        {appHeader && <div className="flex min-w-0 max-w-full items-center justify-center gap-3 justify-self-center py-1">
          <div role="status" aria-live="polite" aria-atomic="true"
            className={appHeader.status.text ? `flex min-w-0 items-center gap-1.5 border-r border-white/20 pr-3 ${appHeader.status.tone === 'error' ? 'text-red-300' : appHeader.status.tone === 'success' ? 'text-emerald-300' : 'text-slate-400'}` : 'sr-only'}>
            {appHeader.status.tone === 'success' && <HiOutlineCheck aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />}
            {appHeader.status.tone === 'error' && <HiOutlineExclamationCircle aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />}
            {appHeader.status.tone === 'pending' && <span aria-hidden="true" className="h-3 w-3 shrink-0 animate-spin rounded-full border border-current border-r-transparent" />}
            <span title={appHeader.status.text} className="max-w-40 truncate text-xs">{appHeader.status.text}</span>
          </div>
          <Menu as="div" className="relative min-w-0">
            <MenuButton disabled={appHeader.selection.disabled}
              aria-label={`${appHeader.selection.label}: ${appHeader.selection.options.find((option) => option.value === appHeader.selection.value)?.label ?? appHeader.selection.placeholder}`}
              className="flex max-w-60 items-center gap-2 rounded px-2 py-1 text-gray-200 hover:bg-white/10 disabled:opacity-50">
              <HiOutlineArchiveBox aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-300" />
              <span className="truncate font-semibold">{appHeader.selection.options.find((option) => option.value === appHeader.selection.value)?.label ?? appHeader.selection.placeholder}</span>
              <HiOutlineChevronDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            </MenuButton>
            <MenuItems modal={false} className="absolute right-0 top-full z-50 mt-1 max-h-80 w-72 max-w-[90vw] overflow-auto rounded-lg border border-white/10 bg-zinc-950/95 p-1 text-white shadow-xl backdrop-blur-md focus:outline-none">
              {appHeader.selection.options.length ? appHeader.selection.options.map((option) => (
                <MenuItem key={option.value}>
                  <button type="button" aria-current={option.value === appHeader.selection.value ? 'true' : undefined}
                    onClick={() => appHeader.selection.onChange(option.value)}
                    className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs data-[focus]:bg-white/10">
                    <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{option.label}</span><span className="mt-1 block text-slate-400">{option.detail}</span></span>
                    {option.value === appHeader.selection.value && <HiOutlineCheck aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-300" />}
                  </button>
                </MenuItem>
              )) : <p className="px-3 py-2 text-xs text-slate-400">No contexts yet. Use File → New context.</p>}
            </MenuItems>
          </Menu>
        </div>}
        <div className="flex items-center justify-self-end space-x-2 z-50">
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
