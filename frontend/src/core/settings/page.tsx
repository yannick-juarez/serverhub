import { useEffect, useMemo, useState } from "react";
import { HiOutlineCog6Tooth } from "react-icons/hi2";
import { useNavigate, useParams } from "react-router-dom";
import { getSettingsSections } from "./registry";
import type { SettingsSectionDefinition, SettingsSectionGroup } from "./types";

const GROUP_LABELS: Record<SettingsSectionGroup, string> = {
  system: "System",
  apps: "Apps",
};

function groupSectionsByType(items: SettingsSectionDefinition[]) {
  const grouped: Record<SettingsSectionGroup, SettingsSectionDefinition[]> = {
    system: [],
    apps: [],
  };

  for (const item of items) {
    const group = item.group ?? "system";
    grouped[group].push(item);
  }

  return grouped;
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { section } = useParams<{ section?: string }>();
  const sections = useMemo(() => getSettingsSections(), []);
  const [search, setSearch] = useState("");

  const activeSection = useMemo(() => {
    if (!section) return sections[0] ?? null;
    return sections.find((item) => item.key === section) ?? null;
  }, [section, sections]);

  const filteredSections = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return sections;
    return sections.filter((item) => {
      const haystack = `${item.label} ${item.description} ${item.key}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [search, sections]);

  const groupedFilteredSections = useMemo(
    () => groupSectionsByType(filteredSections),
    [filteredSections],
  );
  const groupedAllSections = useMemo(() => groupSectionsByType(sections), [sections]);

  useEffect(() => {
    if (!sections.length) return;
    if (!activeSection) {
      navigate(`/settings/${sections[0].key}`, { replace: true });
    }
  }, [activeSection, navigate, sections]);

  if (!sections.length) {
    return (
      <div className="h-full w-full bg-black p-6 text-sm text-slate-300">
        No settings sections are available.
      </div>
    );
  }

  const ActiveSectionComponent = activeSection?.component;

  return (
    <div className="h-full w-full bg-black text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 -top-28 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute right-0 top-12 h-80 w-80 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 h-80 w-80 rounded-full bg-lime-500/10 blur-3xl" />
        <div className="absolute left-1/2 top-1/4 transform h-80 w-80 rounded-full bg-purple-500/5 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.06),_transparent_25%)]" />
      </div>
      
      <div className="flex h-full flex-col overflow-hidden">
        <div className="flex min-h-0 w-full flex-1 flex-col">
          <div className="sticky top-0 z-20 border-b border-white/15 bg-black/5 px-2 py-4 backdrop-blur-sm lg:px-3">
            <p className="text-xs uppercase tracking-wide text-slate-400">Settings</p>
            <h1 className="text-2xl font-semibold">Platform Settings</h1>
          </div>

          <div className="min-h-0 flex-1 overflow-auto bg-black/5 z-50">
            <div className="grid min-h-full grid-cols-1 gap-1 lg:grid-cols-[300px_minmax(0,1fr)]">
              <aside className="h-full self-stretch border-r border-white/15 p-2">
                <div className="mb-1 px-2 py-1.5">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Categories</p>
                </div>
                <div className="mb-2 px-2">
                  <input
                    className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-slate-100 outline-none placeholder:text-slate-500"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search categories"
                  />
                </div>
                <nav className="space-y-3 overflow-y-auto pb-1">
                  {(["system", "apps"] as SettingsSectionGroup[]).map((group) => {
                    const list = groupedFilteredSections[group];
                    const hasAnyInGroup = groupedAllSections[group].length > 0;

                    return (
                      <div key={group}>
                        <p className="mb-1 px-2 text-[11px] uppercase tracking-wide text-slate-500">{GROUP_LABELS[group]}</p>
                        <div className="flex gap-1 overflow-x-auto px-1 lg:flex-col lg:overflow-visible">
                          {list.map((item) => {
                            const isActive = activeSection?.key === item.key;
                            const ItemIcon = item.icon ?? HiOutlineCog6Tooth;
                            const itemColor = item.color;
                            return (
                              <button
                                key={item.key}
                                className={`min-w-[165px] rounded-md border px-2 py-1.5 text-left transition lg:min-w-0 ${
                                  isActive
                                    ? "border-white/10 bg-white/5 text-white"
                                    : "border-transparent text-slate-300 hover:bg-white/5 hover:text-white"
                                }`}
                                onClick={() => navigate(`/settings/${item.key}`)}
                                aria-current={isActive ? "page" : undefined}
                              >
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
                                      isActive
                                        ? itemColor
                                          ? `${itemColor.background} text-white`
                                          : "bg-white/15 text-white"
                                        : itemColor
                                          ? `${itemColor.idle.background} text-white/90`
                                          : "bg-white/5 text-slate-300"
                                    }`}
                                  >
                                    <ItemIcon className="h-3.5 w-3.5" />
                                  </span>
                                  <p className="text-sm font-medium leading-tight">{item.label}</p>
                                </div>
                              </button>
                            );
                          })}
                          {!list.length && group === "apps" ? (
                            <div className="rounded-md border border-white/10 bg-white/5 px-2 py-2 text-xs text-slate-400">
                              {hasAnyInGroup
                                ? search.trim()
                                  ? "No app settings match your search."
                                  : "No app settings available."
                                : "No app settings available."}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}

                  {!filteredSections.length ? (
                    <div className="rounded-md border border-white/10 bg-white/5 px-2 py-2 text-xs text-slate-400">
                      No matching categories.
                    </div>
                  ) : null}
                </nav>
              </aside>

              <section className="min-h-full p-5 bg-black/30">
                {ActiveSectionComponent ? <ActiveSectionComponent /> : null}
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
