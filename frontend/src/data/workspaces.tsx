export type WorkspaceBanner = {
    id: string;
    name: string;
    background: string;
    foreground: string;
    label: string;
};

export type Workspace = {
    id: string;
    label: string;
    bannerId: string | null;
};

export type WorkspaceSettings = {
    banners: WorkspaceBanner[];
    workspaces: Workspace[];
};

export const WORKSPACE_SETTINGS_STORAGE_KEY = "workspace-settings.v1";
export const WORKSPACE_SETTINGS_UPDATED_EVENT = "workspace-settings-updated";

export const BANNER_BACKGROUND_OPTIONS = [
    "bg-red-500",
    "bg-orange-500",
    "bg-amber-500",
    "bg-yellow-500",
    "bg-lime-500",
    "bg-green-500",
    "bg-teal-500",
    "bg-cyan-500",
    "bg-sky-500",
    "bg-blue-500",
    "bg-indigo-500",
    "bg-pink-500",
    "bg-zinc-700",
    "bg-black",
] as const;

export const BANNER_FOREGROUND_OPTIONS = ["text-white", "text-black"] as const;

export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
    banners: [
        {
            id: "production",
            name: "Production Alert",
            background: "bg-red-500",
            foreground: "text-white",
            label: "CONFIDENTIAL // DO NOT DISTRIBUTE // PRODUCTION DATA",
        },
        {
            id: "development",
            name: "Development Alert",
            background: "bg-yellow-500",
            foreground: "text-black",
            label: "INTERNAL USE ONLY // DEVELOPMENT WORKSPACE // SAMPLE DATA",
        },
        {
            id: "demo",
            name: "Demo Alert",
            background: "bg-green-500",
            foreground: "text-white",
            label: "DEMO // SAMPLE DATA",
        },
    ],
    workspaces: [
        { id: "demo", label: "Demo", bannerId: "demo" },
        { id: "development", label: "Development", bannerId: "development" },
        { id: "production", label: "Production", bannerId: "production" },
    ],
};

function asString(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

function normalizeId(value: unknown, fallback: string): string {
    const base = asString(value).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
    return base || fallback;
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
    const seen = new Set<string>();
    const result: T[] = [];

    for (const item of items) {
        if (!item.id || seen.has(item.id)) continue;
        seen.add(item.id);
        result.push(item);
    }

    return result;
}

function normalizeSettings(raw: Partial<WorkspaceSettings> | null | undefined): WorkspaceSettings {
    const sourceBanners = Array.isArray(raw?.banners) ? raw.banners : [];
    const normalizedBanners = uniqueById(
        sourceBanners.map((item, index) => {
            const candidate = item as Partial<WorkspaceBanner>;
            const background = BANNER_BACKGROUND_OPTIONS.includes(candidate.background as (typeof BANNER_BACKGROUND_OPTIONS)[number])
                ? (candidate.background as string)
                : "bg-zinc-700";
            const foreground = BANNER_FOREGROUND_OPTIONS.includes(candidate.foreground as (typeof BANNER_FOREGROUND_OPTIONS)[number])
                ? (candidate.foreground as string)
                : "text-white";

            return {
                id: normalizeId(candidate.id, `banner-${index + 1}`),
                name: asString(candidate.name) || `Banner ${index + 1}`,
                background,
                foreground,
                label: asString(candidate.label) || `Workspace banner ${index + 1}`,
            };
        }),
    );

    const finalBanners = normalizedBanners.length ? normalizedBanners : DEFAULT_WORKSPACE_SETTINGS.banners;
    const bannerIds = new Set(finalBanners.map((item) => item.id));

    const sourceWorkspaces = Array.isArray(raw?.workspaces) ? raw.workspaces : [];
    const normalizedWorkspaces = uniqueById(
        sourceWorkspaces.map((item, index) => {
            const candidate = item as Partial<Workspace>;
            const bannerId = asString(candidate.bannerId);
            return {
                id: normalizeId(candidate.id, `workspace-${index + 1}`),
                label: asString(candidate.label) || `Workspace ${index + 1}`,
                bannerId: bannerIds.has(bannerId) ? bannerId : null,
            };
        }),
    );

    const finalWorkspaces = normalizedWorkspaces.length ? normalizedWorkspaces : DEFAULT_WORKSPACE_SETTINGS.workspaces;

    return {
        banners: finalBanners,
        workspaces: finalWorkspaces,
    };
}

export function parseWorkspaceSettingsFromPreferences(preferences: Record<string, unknown> | null | undefined): WorkspaceSettings {
    return normalizeSettings({
        banners: preferences?.workspaceBanners as WorkspaceBanner[] | undefined,
        workspaces: preferences?.workspaces as Workspace[] | undefined,
    });
}

export function getStoredWorkspaceSettings(): WorkspaceSettings {
    const raw = localStorage.getItem(WORKSPACE_SETTINGS_STORAGE_KEY);
    if (!raw) {
        return normalizeSettings(DEFAULT_WORKSPACE_SETTINGS);
    }

    try {
        const parsed = JSON.parse(raw) as Partial<WorkspaceSettings>;
        return normalizeSettings(parsed);
    } catch {
        return normalizeSettings(DEFAULT_WORKSPACE_SETTINGS);
    }
}

export function saveWorkspaceSettings(settings: WorkspaceSettings): WorkspaceSettings {
    const next = normalizeSettings(settings);
    localStorage.setItem(WORKSPACE_SETTINGS_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(WORKSPACE_SETTINGS_UPDATED_EVENT, { detail: next }));
    return next;
}

export function toWorkspacePreferencePatch(settings: WorkspaceSettings): Record<string, unknown> {
    const normalized = normalizeSettings(settings);
    return {
        workspaceBanners: normalized.banners,
        workspaces: normalized.workspaces,
    };
}