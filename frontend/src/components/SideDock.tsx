import { useEffect, useMemo, useState, type DragEvent } from 'react';
import Cookies from 'js-cookie';
import { Link } from 'react-router-dom';
import { apps, type AppDefinition } from '../apps/index';
import { CgMenuGridO } from "react-icons/cg";
import { FaCog } from 'react-icons/fa';
import { getMe, getPreferences, patchPreferences, type PreferencesResponse } from '../api/settings';

import Polarstar from './Polarstar';

import { Scrollbar } from 'smooth-scrollbar-react';
import { FaMagnifyingGlass } from 'react-icons/fa6';

const accentWhite = {
    background: 'bg-white/10',
    text: 'text-white'
}

const accentColor = accentWhite;

const SIDE_DOCK_NAV_ORDER_PREF_KEY = 'sideDockNavOrderByUser';

type NavOrderByUser = Record<string, string[]>;

function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function readNavOrderByUser(preferences: PreferencesResponse | null): NavOrderByUser {
    const raw = preferences?.[SIDE_DOCK_NAV_ORDER_PREF_KEY];

    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return {};
    }

    return Object.fromEntries(
        Object.entries(raw).filter(([, value]) => isStringArray(value)),
    ) as NavOrderByUser;
}

function orderNavItems(items: AppDefinition[], preferredOrder?: string[] | null): AppDefinition[] {
    if (!preferredOrder || preferredOrder.length === 0) {
        return items;
    }

    const itemsById = new Map(items.map((item) => [item.id, item]));
    const orderedItems: AppDefinition[] = [];

    preferredOrder.forEach((id) => {
        const item = itemsById.get(id);

        if (item) {
            orderedItems.push(item);
            itemsById.delete(id);
        }
    });

    items.forEach((item) => {
        if (itemsById.has(item.id)) {
            orderedItems.push(item);
        }
    });

    return orderedItems;
}

function moveItem(items: AppDefinition[], sourceId: string, targetId: string): AppDefinition[] {
    const sourceIndex = items.findIndex((item) => item.id === sourceId);
    const targetIndex = items.findIndex((item) => item.id === targetId);

    if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
        return items;
    }

    const nextItems = [...items];
    const [movedItem] = nextItems.splice(sourceIndex, 1);
    nextItems.splice(targetIndex, 0, movedItem);

    return nextItems;
}

const coreSettingsApp: AppDefinition = {
    id: 'core-settings',
    to: '/settings',
    icon: <FaCog className="h-4 w-4" />,
    label: 'Settings',
    title: 'SETTINGS',
    menus: [],
    color: {
        border: 'border-gray-500/70',
        background: 'bg-gray-500/40',
        hover: { border: 'hover:border-gray-400/30', background: 'hover:bg-gray-400/30' },
        idle: { border: 'border-gray-500/20', background: 'bg-gray-500/10' },
    },
    showInFooter: true,
    showInSideDock: true,
    isBottomItem: true,
    requiresAuth: true,
    order: 10000,
    page: (() => null) as unknown as AppDefinition['page'],
};

const coreApplicationsApp: AppDefinition = {
    id: 'core-applications',
    to: '/applications',
    icon: <CgMenuGridO className="h-4 w-4" />,
    label: 'Applications',
    title: 'APPLICATIONS',
    menus: [],
    color: {
        border: 'border-teal-500/70',
        background: 'bg-teal-500/40',
        hover: { border: 'hover:border-teal-400/30', background: 'hover:bg-teal-400/30' },
        idle: { border: 'border-teal-500/20', background: 'bg-teal-500/10' },
    },
    showInFooter: true,
    showInSideDock: true,
    isBottomItem: true,
    requiresAuth: true,
    order: 9999,
    page: (() => null) as unknown as AppDefinition['page'],
};

type AppLinkProps = {
    app: AppDefinition;
    isOpen: boolean;
};

const AppLink = ({ app, isOpen }: AppLinkProps) => {
    
    const isSelected = window.location.pathname === app.to;
    
    return (
        <Link
            to={app.to}
            title={!isOpen ? app.label : ''}
            draggable={false}
        >
            <div
                className={`flex items-center h-9 transition-all group relative cursor-pointer border rounded-lg ${accentColor.text} ${
                    isOpen ? 'px-4' : 'px-2'
                } ${
                    isSelected 
                        ? ` ${app.color.border} ${app.color.background} ${accentColor.text}`
                        : ` text-gray-200 ${app.color.idle.background} ${app.color.idle.border} ${app.color.hover.background} ${app.color.hover.border}`
                }`}
            >
                <span className="flex-shrink-0">{app.icon}</span>
                <span
                    className={`ml-2 text-sm font-medium whitespace-nowrap transition-opacity duration-300 ${
                        isOpen ? 'opacity-100' : 'opacity-0 w-0'
                    }`}
                >
                    {app.label}
                </span>
                
                {/* Tooltip for collapsed state */}
                {!isOpen && (
                    <div className="absolute left-full ml-2 px-3 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                        {app.label}
                    </div>
                )}
            </div>
        </Link>
    );
};

const SideDock = ({ className = '' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [preferences, setPreferences] = useState<PreferencesResponse | null>(null);
    const [currentUsername, setCurrentUsername] = useState('');
    const [navOrderIds, setNavOrderIds] = useState<string[] | null>(null);
    const [draggedAppId, setDraggedAppId] = useState<string | null>(null);
    const [dragOverAppId, setDragOverAppId] = useState<string | null>(null);

    const baseNavItems = useMemo(
        () => apps.filter((app) => app.showInSideDock && !app.isBottomItem && !app.isInternal),
        [],
    );

    const navItems = useMemo(
        () => orderNavItems(baseNavItems, navOrderIds),
        [baseNavItems, navOrderIds],
    );

    const bottomItems = [coreApplicationsApp, coreSettingsApp];

    useEffect(() => {
        let isCancelled = false;

        const loadSideDockPreferences = async () => {
            const cookieUsername = Cookies.get('user')?.trim().toLowerCase() ?? '';

            try {
                const preferencesResult = await getPreferences();
                let resolvedUsername = cookieUsername;

                if (!resolvedUsername) {
                    const me = await getMe();
                    resolvedUsername = me.username.trim().toLowerCase();
                }

                if (isCancelled) {
                    return;
                }

                const orderByUser = readNavOrderByUser(preferencesResult);
                setPreferences(preferencesResult);
                setCurrentUsername(resolvedUsername);
                setNavOrderIds(orderByUser[resolvedUsername] ?? null);
            } catch {
                if (isCancelled) {
                    return;
                }

                setCurrentUsername(cookieUsername);
                setNavOrderIds(null);
            }
        };

        void loadSideDockPreferences();

        return () => {
            isCancelled = true;
        };
    }, []);

    const persistNavOrder = async (nextOrderIds: string[]) => {
        if (!currentUsername) {
            return;
        }

        const nextOrderByUser = {
            ...readNavOrderByUser(preferences),
            [currentUsername]: nextOrderIds,
        };

        setPreferences((previous) => ({
            ...(previous ?? {}),
            [SIDE_DOCK_NAV_ORDER_PREF_KEY]: nextOrderByUser,
        }));

        try {
            const updatedPreferences = await patchPreferences({
                [SIDE_DOCK_NAV_ORDER_PREF_KEY]: nextOrderByUser,
            });

            setPreferences(updatedPreferences);
        } catch (error) {
            console.error('Unable to persist side dock order', error);
        }
    };

    const handleDragStart = (appId: string) => {
        setDraggedAppId(appId);
        setDragOverAppId(appId);
    };

    const handleDragOver = (event: DragEvent<HTMLDivElement>, appId: string) => {
        event.preventDefault();

        if (draggedAppId && draggedAppId !== appId) {
            setDragOverAppId(appId);
        }
    };

    const handleDragEnd = () => {
        setDraggedAppId(null);
        setDragOverAppId(null);
    };

    const handleDrop = (event: DragEvent<HTMLDivElement>, targetAppId: string) => {
        event.preventDefault();

        if (!draggedAppId || draggedAppId === targetAppId) {
            handleDragEnd();
            return;
        }

        const nextItems = moveItem(navItems, draggedAppId, targetAppId);
        const nextOrderIds = nextItems.map((item) => item.id);

        setNavOrderIds(nextOrderIds);
        handleDragEnd();
        void persistNavOrder(nextOrderIds);
    };

    return (
        <div
            className={`bg-black/30 backdrop-blur-lg border-r border-white/10 transition-all duration-300 ease-in-out z-50 flex flex-col select-none ${
                isOpen ? 'w-48' : 'w-12 overflow-x-hidden'
            } px-1.5 ${className}`}
        >
            {/* Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center justify-start ${ isOpen ? 'pl-5' : 'pl-2.5' } transition-all py-1.5 ${isOpen ? '' : 'rounded-lg'} border-b border-white/10 hover:bg-white/5 text-white hover:${accentColor.text}`}
            >
                <div className='flex flex-row items-center gap-2'>
                    <Polarstar size={16} color="white" thickness={1} aria-label="Polarstar Logo" className="z-50" />
                    <span className={`text-base font-bold flex flex-row items-center ${ isOpen ? 'opacity-100' : 'opacity-0 w-0' } transition-all whitespace-nowrap`}>Server Hub</span>
                </div>
            </button>

            {/* Separator */}
            <div className='border-t border-white/10 my-2'></div>

            <div className='flex flex-col gap-1'>
                <Link
                    to="/applications"
                    className={`flex items-center h-9 transition-all group relative text-white text-lg rounded-lg border border-white/10 hover:bg-white/10 cursor-pointer ${
                        isOpen ? 'px-4' : 'px-1'
                    }`}>
                    <span className="ml-[1px]"><CgMenuGridO className='text-white text-lg w-6 h-6' /></span>
                    <span
                        className={`ml-2 text-sm font-medium whitespace-nowrap transition-opacity duration-300 ${
                            isOpen ? 'opacity-100' : 'opacity-0 w-0'
                        }`}
                    >Apps <span className='text-gray-500 text-xs mx-2'>Ctrl+Space</span></span>

                    {/* Tooltip for collapsed state */}
                    {!isOpen && (
                        <div className="absolute left-full ml-2 px-3 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                            Apps
                        </div>
                    )}
                </Link>
                <div
                    className={`flex items-center h-9 transition-all group relative text-white text-lg rounded-lg border border-white/10 hover:bg-white/10 cursor-pointer ${
                        isOpen ? 'px-4' : 'px-1'
                    }`} >
                    <span className="ml-[5px]"><FaMagnifyingGlass className='text-white text-lg w-4 h-4' /></span>
                    <span
                        className={`ml-2 text-sm font-medium whitespace-nowrap transition-opacity duration-300 ${
                            isOpen ? 'opacity-100' : 'opacity-0 w-0'
                        }`}
                    >Search <span className='text-gray-500 text-xs mx-2'>Ctrl+Space</span></span>

                    {/* Tooltip for collapsed state */}
                    {!isOpen && (
                        <div className="absolute left-full ml-2 px-3 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                            Search
                        </div>
                    )}
                </div>
            </div>

            {/* Separator */}
            <div className='border-t border-white/10 my-2'></div>

            {/* Navigation Items */}
            <Scrollbar
                className={`max-h-[100vh-100px] tracks-hidden ${isOpen ? 'w-full' : 'w-[34px]'}`}
                alwaysShowTracks={false}
                continuousScrolling={false}
            >
                <nav className={`flex-1 overflow-x-hidden transition-all ${isOpen ? 'w-full' : 'w-[34px]'}`}>
                    {navItems.map((app) => (
                        <div
                            className={`mb-0.5 rounded-xl transition-all ${
                                draggedAppId === app.id ? 'opacity-40' : 'opacity-100'
                            } ${
                                dragOverAppId === app.id && draggedAppId !== app.id
                                    ? 'bg-white/10 ring-1 ring-white/20'
                                    : ''
                            }`}
                            key={app.id}
                            draggable
                            onDragEnd={handleDragEnd}
                            onDragOver={(event) => handleDragOver(event, app.id)}
                            onDragStart={() => handleDragStart(app.id)}
                            onDrop={(event) => handleDrop(event, app.id)}
                        >
                            <AppLink
                                app={app}
                                isOpen={isOpen}
                            />
                        </div>
                    ))}
                </nav>
            </Scrollbar>

            {/* Bottom Items */}
            <div className='py-1 border-t border-gray-600/50' style={{
                boxShadow: 'inset 0 10px 10px -10px rgba(0, 0, 0, 0.8)'
            }}>
                { bottomItems.map((app) => (
                    <AppLink
                        key={app.id}
                        app={app}
                        isOpen={isOpen}
                    />
                ))}
            </div>
        </div>
    );
};

export default SideDock;