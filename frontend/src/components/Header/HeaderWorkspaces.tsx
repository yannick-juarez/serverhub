import { useEffect, useMemo, useState } from 'react';
import { HiOutlineSquaresPlus, HiOutlineSquares2X2 } from 'react-icons/hi2';
import { PiCheckSquareOffsetLight, PiBracketsSquareThin } from 'react-icons/pi';

import {
    getStoredWorkspaceSettings,
    WORKSPACE_SETTINGS_UPDATED_EVENT,
    type Workspace,
    type WorkspaceSettings,
} from '../../data/workspaces';

const HeaderWorkspaces = () => {
    const [workspaceSettings, setWorkspaceSettings] = useState<WorkspaceSettings>(() => getStoredWorkspaceSettings());
    const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>(
        localStorage.getItem('selectedWorkspaceId') || getStoredWorkspaceSettings().workspaces[0]?.id || '',
    );
    const [open, setOpen] = useState(false);

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
        window.location.reload();
    };

    useEffect(() => {
        const handlePointerDown = (event: PointerEvent) => {
            const menu = document.getElementById('header-workspaces-menu');
            if (menu && !menu.contains(event.target as Node)) {
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
        <div id="header-workspaces-menu" className="relative">
            <button type="button" className="z-50 flex items-center px-3 py-1 font-sans text-xs font-bold text-white hover:bg-white/10" onClick={() => setOpen((value) => !value)}>
                <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-white/80" />
                    <span className="text-xs">{selectedWorkspace?.label || 'Workspace'}</span>
                </span>
            </button>
            {open ? (
                <div className="absolute right-0 top-full z-[999] mt-1 w-56 origin-top-right rounded-lg border border-white/10 bg-black/50 pb-2 pt-1 text-white backdrop-blur-md focus:outline-none">
                    <span className="mt-2 inline-block px-3 text-xs font-bold">Workspaces</span>

                    <div className="mx-2 my-1 h-px bg-white/10" />

                    {workspaces.map(({ id, label }, idx) => {
                        const isSelected = selectedWorkspaceId === id;
                        return (
                            <div key={id}>
                                {idx > 0 && <div className="mx-2 my-0.5 h-px bg-white/10" />}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setOpen(false);
                                        onSelect(id);
                                    }}
                                    className="group flex w-full items-center justify-between px-3 py-1 font-sans text-sm hover:bg-white/5"
                                >
                                    <span className="flex items-center">
                                        <span className="mr-2 h-2 w-2 rounded-full bg-white/80" />
                                        <span className="font-semibold">{label}</span>
                                    </span>
                                    {isSelected ? (
                                        <PiCheckSquareOffsetLight className="mr-2 h-4 w-4 text-green-500" />
                                    ) : (
                                        <PiBracketsSquareThin className="mr-2 h-4 w-4 text-gray-400" />
                                    )}
                                </button>
                            </div>
                        );
                    })}

                    <div className="my-1 h-px bg-white/5" />

                    <button type="button" className="group flex w-full items-center px-3 py-1 font-sans text-sm hover:bg-white/5">
                        <HiOutlineSquaresPlus className="mr-2 h-4 w-4 font-thin text-gray-300" />
                        Create workspace
                    </button>
                    <button type="button" className="group flex w-full items-center px-3 py-1 font-sans text-sm hover:bg-white/5">
                        <HiOutlineSquares2X2 className="mr-2 h-4 w-4 font-thin text-gray-300" />
                        Browse workspaces
                    </button>
                </div>
            ) : null}
        </div>
    );
};

export default HeaderWorkspaces;