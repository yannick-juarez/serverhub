import { useEffect, useMemo, useState } from 'react';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { HiOutlineSquaresPlus, HiOutlineSquares2X2 } from 'react-icons/hi2';
import { PiCheckSquareOffsetLight, PiBracketsSquareThin } from 'react-icons/pi';
import { FaArrowRight } from 'react-icons/fa';

import {
    getStoredWorkspaceSettings,
    WORKSPACE_SETTINGS_UPDATED_EVENT,
    type Workspace,
    type WorkspaceSettings,
} from '../../data/workspaces';
import toast from 'react-hot-toast';

const HeaderWorkspaces = () => {
    const [workspaceSettings, setWorkspaceSettings] = useState<WorkspaceSettings>(() => getStoredWorkspaceSettings());
    const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>(
        localStorage.getItem('selectedWorkspaceId') || getStoredWorkspaceSettings().workspaces[0]?.id || '',
    );

    useEffect(() => {
        const sync = () => {
            const next = getStoredWorkspaceSettings();
            setWorkspaceSettings(next);

            const currentSelected = localStorage.getItem('selectedWorkspaceId') || '';
            if (!next.workspaces.some((workspace) => workspace.id === currentSelected)) {
                const fallback = next.workspaces[0]?.id || '';
                setSelectedWorkspaceId(fallback);
                localStorage.setItem('selectedWorkspaceId', fallback);
                return;
            }

            setSelectedWorkspaceId(currentSelected);
        };

        window.addEventListener(WORKSPACE_SETTINGS_UPDATED_EVENT, sync as EventListener);
        window.addEventListener('storage', sync);
        return () => {
            window.removeEventListener(WORKSPACE_SETTINGS_UPDATED_EVENT, sync as EventListener);
            window.removeEventListener('storage', sync);
        };
    }, []);

    const workspaces: Workspace[] = workspaceSettings.workspaces;
    const selectedWorkspace = useMemo(
        () => workspaces.find((workspace) => workspace.id === selectedWorkspaceId) || workspaces[0],
        [selectedWorkspaceId, workspaces],
    );

    const onSelect = (id: string) => {
        setSelectedWorkspaceId(id);
        localStorage.setItem('selectedWorkspaceId', id);
        toast.loading('Switching workspace...', { duration: 1000 });
        window.location.reload();
    };

    return (
        <Menu>
            <MenuButton className="z-50 flex items-center px-3 py-1 font-sans text-xs font-bold text-white hover:bg-white/10">
                <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-white/80" />
                    <span className="text-xs">{selectedWorkspace?.label || 'Workspace'}</span>
                </span>
            </MenuButton>
            <MenuItems
                transition
                anchor="bottom end"
                className="z-[999] w-56 origin-top-right rounded-lg border border-white/10 bg-black/50 pb-2 pt-1 text-white backdrop-blur-md transition duration-100 ease-out [--anchor-gap:var(--spacing-1)] focus:outline-none data-[closed]:scale-95 data-[closed]:opacity-0"
            >
                <span className="mt-2 inline-block px-3 text-xs font-bold">Workspaces</span>

                <div className="mx-2 my-1 h-px bg-white/10" />

                {workspaces.map(({ id, label }, idx) => {
                    const isSelected = selectedWorkspaceId === id;
                    return (
                        <MenuItem key={id}>
                            <div>
                                {idx > 0 && <div className="mx-2 my-0.5 h-px bg-white/10" />}
                                <button
                                    onClick={() => onSelect(id)}
                                    className="group flex w-full items-center justify-between px-3 py-1 font-sans text-sm hover:bg-white/5 data-[focus]:bg-white/10"
                                >
                                    <span className="flex items-center">
                                        <span className="mr-2 h-2 w-2 rounded-full bg-white/80" />
                                        <span className="font-semibold">{label}</span>
                                    </span>
                                    <span className="group-data-[focus]:hidden">
                                        {isSelected ? (
                                            <PiCheckSquareOffsetLight className="mr-2 h-4 w-4 text-green-500" />
                                        ) : (
                                            <PiBracketsSquareThin className="mr-2 h-4 w-4 text-gray-400" />
                                        )}
                                    </span>
                                    <span className="hidden text-[10px] text-blue-400 group-data-[focus]:inline">
                                        Switch to <FaArrowRight className="inline-block h-2.5 w-2.5" />
                                    </span>
                                </button>
                            </div>
                        </MenuItem>
                    );
                })}

                <div className="my-1 h-px bg-white/5" />

                <MenuItem>
                    <button className="group flex w-full items-center px-3 py-1 font-sans text-sm data-[focus]:bg-white/5">
                        <HiOutlineSquaresPlus className="mr-2 h-4 w-4 font-thin text-gray-300" />
                        Create workspace
                    </button>
                </MenuItem>
                <MenuItem>
                    <button className="group flex w-full items-center px-3 py-1 font-sans text-sm data-[focus]:bg-white/5">
                        <HiOutlineSquares2X2 className="mr-2 h-4 w-4 font-thin text-gray-300" />
                        Browse workspaces
                    </button>
                </MenuItem>
            </MenuItems>
        </Menu>
    );
};

export default HeaderWorkspaces;