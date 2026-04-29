export type MenuConfig = {
    label: string;
    items: Array<{ name: string; shortcut?: string; action?: () => void; }>;
};