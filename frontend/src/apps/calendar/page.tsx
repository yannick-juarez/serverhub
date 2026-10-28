import { useEffect, useState, useCallback, useRef } from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  PlusIcon,
  MinusIcon,
  XMarkIcon,
  CalendarDaysIcon,
  MapPinIcon,
  Bars3BottomLeftIcon,
  PencilIcon,
  TrashIcon,
  ClockIcon,
  LinkIcon,
  AdjustmentsHorizontalIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
  ListBulletIcon,
  MagnifyingGlassIcon,
  CheckIcon,
  DocumentDuplicateIcon,
} from "@heroicons/react/24/outline";
import { CheckCircleIcon as CheckCircleSolidIcon } from "@heroicons/react/24/solid";
import useDocumentTitle from "../../hooks/useDocumentTitle";
import {
  fetchCalendars,
  fetchEvents,
  createCalendar,
  updateCalendar,
  deleteCalendar,
  createEvent,
  updateEvent,
  deleteEvent,
  fetchTasks,
  createTask,
  updateTask,
  deleteTask,
  fetchMasks,
  createMask,
  updateMask,
  deleteMask,
  fetchGhostPlacements,
  geocodeLocation,
  type Calendar,
  type CalendarEvent,
  type Task,
  type TaskStatus,
  type Mask,
  type MaskSlot,
  type MaskDateRange,
  type GhostPlacement,
  type GeocodeResult,
} from "../../api/calendar";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

function toLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toLocalDatetimeStr(date: Date): string {
  const d = toLocalDateStr(date);
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${d}T${h}:${min}`;
}

function startOfDay(isoStr: string): string {
  return isoStr.slice(0, 10);
}

function getMonthGrid(year: number, month: number): Date[] {
  // month is 0-indexed
  const first = new Date(year, month, 1);
  // Monday-first: 0=Mon … 6=Sun
  const startDow = (first.getDay() + 6) % 7;
  const days: Date[] = [];
  // Fill leading days from previous month
  for (let i = startDow - 1; i >= 0; i--) {
    days.push(new Date(year, month, -i));
  }
  // Current month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(new Date(year, month, d));
  }
  // Fill trailing to complete the grid (6 rows × 7 cols = 42)
  while (days.length < 42) {
    days.push(new Date(year, month + 1, days.length - startDow - daysInMonth + 1));
  }
  return days;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function formatTime(isoStr: string): string {
  const d = new Date(isoStr);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatDateDisplay(isoStr: string): string {
  const d = new Date(isoStr);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function zonedDateTimeToIso(date: string, time: string, timeZone: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const targetWallTime = Date.UTC(year, month - 1, day, hour, minute);
  let instant = targetWallTime;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  for (let iteration = 0; iteration < 2; iteration += 1) {
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(instant))
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, Number(part.value)]),
    );
    const representedWallTime = Date.UTC(
      parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second,
    );
    instant += targetWallTime - representedWallTime;
  }
  return new Date(instant).toISOString();
}

function timeInTimeZone(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso)).replace(" h ", ":");
}

function expandRecurringEvents(events: CalendarEvent[], rangeStart: Date, rangeEnd: Date): CalendarEvent[] {
  const visibleStart = toLocalDateStr(rangeStart);
  const visibleEnd = toLocalDateStr(rangeEnd);

  return events.flatMap((event) => {
    if (event.recurrence_days.length === 0 || !event.recurrence_start || !event.recurrence_end) return [event];

    const startDate = event.recurrence_start > visibleStart ? event.recurrence_start : visibleStart;
    const endDate = event.recurrence_end < visibleEnd ? event.recurrence_end : visibleEnd;
    if (startDate > endDate) return [];

    const timeZone = event.recurrence_timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const durationMs = new Date(event.end_at).getTime() - new Date(event.start_at).getTime();
    const recurrenceTime = event.all_day ? "00:00" : timeInTimeZone(event.start_at, timeZone);
    const cursor = new Date(`${startDate}T00:00:00Z`);
    const occurrences: CalendarEvent[] = [];

    while (cursor.toISOString().slice(0, 10) <= endDate) {
      const date = cursor.toISOString().slice(0, 10);
      if (event.recurrence_days.includes(cursor.getUTCDay())) {
        const occurrenceStart = event.all_day
          ? `${date}T00:00:00.000Z`
          : zonedDateTimeToIso(date, recurrenceTime, timeZone);
        const occurrenceEnd = event.all_day
          ? `${date}T23:59:59.000Z`
          : new Date(new Date(occurrenceStart).getTime() + durationMs).toISOString();
        occurrences.push({
          ...event,
          start_at: occurrenceStart,
          end_at: occurrenceEnd,
          occurrence_id: `${event.event_id}-${date}`,
        });
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return occurrences;
  });
}

type CalendarView = "day" | "week" | "month";

const DAY_NAMES = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const MONTHS_SHORT = ["jan.", "fév.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const PX_PER_HOUR = 60;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function getWeekDays(anchor: Date): Date[] {
  const dow = (anchor.getDay() + 6) % 7;
  const mon = new Date(anchor);
  mon.setDate(anchor.getDate() - dow);
  mon.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    return d;
  });
}

function timeToY(isoStr: string): number {
  const d = new Date(isoStr);
  return (d.getHours() * 60 + d.getMinutes()) / 60 * PX_PER_HOUR;
}

function durationPx(startIso: string, endIso: string): number {
  const mins = Math.max(30, (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000);
  return mins / 60 * PX_PER_HOUR;
}

function assignTimeColumns<T extends { start: string; end: string }>(items: T[]): Array<T & { column: number; columnCount: number }> {
  const minimumDurationMs = 20 / PX_PER_HOUR * 60 * 60 * 1000;
  const visualEnd = (item: T) => Math.max(
    new Date(item.end).getTime(),
    new Date(item.start).getTime() + minimumDurationMs,
  );
  const sorted = [...items].sort((left, right) => {
    const startDelta = new Date(left.start).getTime() - new Date(right.start).getTime();
    return startDelta || visualEnd(left) - visualEnd(right);
  });
  const result: Array<T & { column: number; columnCount: number }> = [];
  let group: T[] = [];
  let groupEnd = Number.NEGATIVE_INFINITY;

  function flushGroup() {
    if (group.length === 0) return;
    const columnEnds: number[] = [];
    const placements = group.map((item) => {
      const start = new Date(item.start).getTime();
      const end = visualEnd(item);
      let column = columnEnds.findIndex((columnEnd) => columnEnd <= start);
      if (column === -1) column = columnEnds.length;
      columnEnds[column] = end;
      return { item, column };
    });
    const columnCount = columnEnds.length;
    result.push(...placements.map(({ item, column }) => ({ ...item, column, columnCount })));
    group = [];
    groupEnd = Number.NEGATIVE_INFINITY;
  }

  for (const item of sorted) {
    const start = new Date(item.start).getTime();
    const end = visualEnd(item);
    if (group.length > 0 && start >= groupEnd) flushGroup();
    group.push(item);
    groupEnd = Math.max(groupEnd, end);
  }
  flushGroup();
  return result;
}

function formatViewTitle(view: CalendarView, viewDate: Date): string {
  if (view === "day") {
    return `${DAY_NAMES[viewDate.getDay()]} ${viewDate.getDate()} ${MONTHS[viewDate.getMonth()]} ${viewDate.getFullYear()}`;
  }
  if (view === "week") {
    const days = getWeekDays(viewDate);
    const s = days[0];
    const e = days[6];
    if (s.getMonth() === e.getMonth()) {
      return `${s.getDate()} – ${e.getDate()} ${MONTHS[s.getMonth()]} ${s.getFullYear()}`;
    }
    if (s.getFullYear() === e.getFullYear()) {
      return `${s.getDate()} ${MONTHS_SHORT[s.getMonth()]} – ${e.getDate()} ${MONTHS_SHORT[e.getMonth()]} ${s.getFullYear()}`;
    }
    return `${s.getDate()} ${MONTHS_SHORT[s.getMonth()]} ${s.getFullYear()} – ${e.getDate()} ${MONTHS_SHORT[e.getMonth()]} ${e.getFullYear()}`;
  }
  return `${MONTHS[viewDate.getMonth()]} ${viewDate.getFullYear()}`;
}

// ─── Preset colors ────────────────────────────────────────────────────────────

const PRESET_COLORS = [
  "#3b82f6", "#22c55e", "#f97316", "#ef4444",
  "#a855f7", "#ec4899", "#14b8a6", "#eab308",
  "#6366f1", "#64748b",
];

function ColorOverridePicker({ value, defaultColor, onChange }: {
  value: string | null;
  defaultColor: string;
  onChange: (color: string | null) => void;
}) {
  return (
    <div>
      <span className="mb-1.5 block text-xs text-white/40">Couleur</span>
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Couleur">
        <button type="button" title="Couleur du calendrier" aria-label="Couleur du calendrier" aria-pressed={value === null}
          onClick={() => onChange(null)} style={{ backgroundColor: defaultColor }}
          className={`flex h-6 w-6 items-center justify-center rounded border ${value === null ? "border-white ring-1 ring-white/50" : "border-white/20"}`}>
          {value === null && <CheckIcon className="h-3.5 w-3.5 text-white drop-shadow" />}
        </button>
        <span className="h-4 w-px bg-white/10" />
        {PRESET_COLORS.map((color) => (
          <button key={color} type="button" title={color} aria-label={`Couleur ${color}`} aria-pressed={value === color}
            onClick={() => onChange(color)} style={{ backgroundColor: color }}
            className={`h-6 w-6 rounded border ${value === color ? "border-white ring-1 ring-white/50" : "border-white/20"}`} />
        ))}
      </div>
    </div>
  );
}

// ─── Modal backdrop ───────────────────────────────────────────────────────────

function Backdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {children}
    </div>
  );
}

// ─── Location autocomplete input ──────────────────────────────────────────────

type LocationInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSelect: (result: GeocodeResult) => void;
  placeholder?: string;
};

function LocationInput({ value, onChange, onSelect, placeholder = "Lieu (optionnel)" }: LocationInputProps) {
  const [recentResults, setRecentResults] = useState<GeocodeResult[]>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("calendar_recent_locations") ?? "[]") as unknown;
      if (!Array.isArray(stored)) return [];
      return stored.filter((item): item is GeocodeResult => {
        if (!item || typeof item !== "object") return false;
        const candidate = item as Partial<GeocodeResult>;
        return typeof candidate.display_name === "string" && typeof candidate.lat === "number" && typeof candidate.lon === "number";
      }).slice(0, 5);
    } catch {
      return [];
    }
  });
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const normalizedQuery = value.trim().toLocaleLowerCase("fr-FR");
  const matchingRecent = recentResults.filter((result) =>
    !normalizedQuery || result.display_name.toLocaleLowerCase("fr-FR").includes(normalizedQuery),
  );
  const recentNames = new Set(matchingRecent.map((result) => result.display_name));
  const suggestions = [
    ...matchingRecent,
    ...results.filter((result) => !recentNames.has(result.display_name)),
  ];

  function handleChange(v: string) {
    onChange(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!v.trim() || v.trim().length < 3) {
      setResults([]);
      const normalizedValue = v.trim().toLocaleLowerCase("fr-FR");
      setOpen(recentResults.some((result) => !normalizedValue || result.display_name.toLocaleLowerCase("fr-FR").includes(normalizedValue)));
      return;
    }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await geocodeLocation(v.trim());
        setResults(res);
        const normalizedValue = v.trim().toLocaleLowerCase("fr-FR");
        const hasRecentMatch = recentResults.some((result) =>
          result.display_name.toLocaleLowerCase("fr-FR").includes(normalizedValue),
        );
        setOpen(res.length > 0 || hasRecentMatch);
      } finally {
        setLoading(false);
      }
    }, 400);
  }

  function handleSelect(r: GeocodeResult) {
    const nextRecent = [r, ...recentResults.filter((result) => result.display_name !== r.display_name)].slice(0, 5);
    setRecentResults(nextRecent);
    localStorage.setItem("calendar_recent_locations", JSON.stringify(nextRecent));
    onChange(r.display_name);
    onSelect(r);
    setOpen(false);
    setResults([]);
  }

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={wrapRef} className="relative flex-1">
      <div className="flex items-center gap-2">
        <MapPinIcon className="h-4 w-4 text-white/40 shrink-0" />
        <input
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
          placeholder={placeholder}
          autoComplete="off"
        />
        {loading && <span className="text-[10px] text-white/30 shrink-0">…</span>}
      </div>
      {open && suggestions.length > 0 && (
        <div className="absolute left-7 right-0 top-full mt-1 z-50 bg-neutral-900 border border-white/10 rounded-lg shadow-xl overflow-hidden">
          {suggestions.map((r) => {
            const isRecent = recentResults.some((recent) => recent.display_name === r.display_name);
            return (
            <button
              key={`${r.display_name}-${r.lat}-${r.lon}`}
              type="button"
              onClick={() => handleSelect(r)}
              className="flex w-full items-center gap-2 border-b border-white/5 px-3 py-2 text-left text-xs text-white/70 transition-colors last:border-0 hover:bg-white/5 hover:text-white"
            >
              {isRecent && <ClockIcon className="h-3.5 w-3.5 shrink-0 text-white/30" />}
              <span className="min-w-0 flex-1">
                <span className="block truncate">{r.display_name}</span>
                <span className="text-[10px] text-white/30">{r.lat.toFixed(4)}, {r.lon.toFixed(4)}</span>
              </span>
            </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Calendar form modal ──────────────────────────────────────────────────────

type CalendarFormProps = {
  initial?: Calendar;
  onSave: (name: string, color: string, description: string) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
};

function CalendarFormModal({ initial, onSave, onDelete, onClose }: CalendarFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color ?? PRESET_COLORS[0]);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Un nom est requis."); return; }
    setSaving(true);
    try {
      await onSave(name.trim(), color, description.trim());
      onClose();
    } catch {
      setError("Erreur lors de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    setSaving(true);
    try {
      await onDelete();
      onClose();
    } catch {
      setError("Erreur lors de la suppression.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Backdrop onClose={onClose}>
      <div className="bg-black/30 backdrop-blur-sm border border-white/10 rounded-xl shadow-2xl w-full max-w-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold text-sm">
            {initial ? "Modifier le calendrier" : "Nouveau calendrier"}
          </h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-white/50 mb-1">Nom</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
              placeholder="Personnel, Travail…"
            />
          </div>

          <div>
            <label className="block text-xs text-white/50 mb-2">Couleur</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="h-6 w-6 rounded-full border-2 transition-all"
                  style={{
                    backgroundColor: c,
                    borderColor: color === c ? "white" : "transparent",
                  }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-white/50 mb-1">Description (optionnel)</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
              placeholder="Description…"
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex items-center justify-between pt-1">
            {onDelete ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                Supprimer
              </button>
            ) : <span />}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-3 py-1.5 text-xs rounded-lg bg-white hover:bg-white/90 text-neutral-900 font-medium transition-all disabled:opacity-50"
              >
                {saving ? "…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </Backdrop>
  );
}

// ─── Event form modal ─────────────────────────────────────────────────────────

type EventFormProps = {
  initial?: CalendarEvent;
  defaultDate?: Date;
  calendars: Calendar[];
  defaultCalendarId?: string;
  onSave: (data: {
    calendar_id: string;
    color: string | null;
    title: string;
    description: string;
    location: string;
    location_lat: number | null;
    location_lon: number | null;
    all_day: boolean;
    allows_overlap: boolean;
    start_at: string;
    end_at: string;
    recurrence_days: number[];
    recurrence_start: string | null;
    recurrence_end: string | null;
    recurrence_timezone: string | null;
  }) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
};

function EventFormModal({
  initial,
  defaultDate,
  calendars,
  defaultCalendarId,
  onSave,
  onDelete,
  onClose,
}: EventFormProps) {
  const base = defaultDate ?? new Date();
  const baseDate = toLocalDateStr(base);
  const defaultStart = toLocalDatetimeStr(new Date(base.getFullYear(), base.getMonth(), base.getDate(), 9, 0));
  const defaultEnd = toLocalDatetimeStr(new Date(base.getFullYear(), base.getMonth(), base.getDate(), 10, 0));

  const [title, setTitle] = useState(initial?.title ?? "");
  const [calendarId, setCalendarId] = useState(
    initial?.calendar_id ?? defaultCalendarId ?? calendars[0]?.calendar_id ?? ""
  );
  const [eventColor, setEventColor] = useState<string | null>(initial?.color ?? null);
  const [allDay, setAllDay] = useState(initial?.all_day ?? false);
  const [allowsOverlap, setAllowsOverlap] = useState(initial?.allows_overlap ?? false);
  const [startAt, setStartAt] = useState(
    initial ? (initial.all_day ? startOfDay(initial.start_at) : toLocalDatetimeStr(new Date(initial.start_at))) : (allDay ? baseDate : defaultStart)
  );
  const [endAt, setEndAt] = useState(
    initial ? (initial.all_day ? startOfDay(initial.end_at) : toLocalDatetimeStr(new Date(initial.end_at))) : (allDay ? baseDate : defaultEnd)
  );
  // Duration mode: when true, show a duration input that drives endAt
  const [durationMode, setDurationMode] = useState(false);
  const [durationMin, setDurationMin] = useState(() => {
    if (initial && !initial.all_day) {
      return Math.max(15, Math.round((new Date(initial.end_at).getTime() - new Date(initial.start_at).getTime()) / 60000));
    }
    return 60;
  });
  const [location, setLocation] = useState(initial?.location ?? "");
  const [locationLat, setLocationLat] = useState<number | null>(initial?.location_lat ?? null);
  const [locationLon, setLocationLon] = useState<number | null>(initial?.location_lon ?? null);
  const [description, setDescription] = useState(initial?.description ?? "");
  const defaultRecurrenceEnd = new Date(base);
  defaultRecurrenceEnd.setDate(defaultRecurrenceEnd.getDate() + 28);
  const [recurrenceEnabled, setRecurrenceEnabled] = useState((initial?.recurrence_days.length ?? 0) > 0);
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>(initial?.recurrence_days ?? []);
  const [recurrenceStart, setRecurrenceStart] = useState(initial?.recurrence_start ?? baseDate);
  const [recurrenceEnd, setRecurrenceEnd] = useState(initial?.recurrence_end ?? toLocalDateStr(defaultRecurrenceEnd));
  const recurrenceTimezone = initial?.recurrence_timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep endAt in sync when duration mode is active and startAt changes
  function computedEndAt(): string {
    if (allDay || !durationMode) return endAt;
    try {
      const s = new Date(startAt);
      if (isNaN(s.getTime())) return endAt;
      return toLocalDatetimeStr(new Date(s.getTime() + durationMin * 60000));
    } catch {
      return endAt;
    }
  }

  function handleStartChange(val: string) {
    setStartAt(val);
    if (!allDay && durationMode) {
      try {
        const s = new Date(val);
        if (!isNaN(s.getTime())) setEndAt(toLocalDatetimeStr(new Date(s.getTime() + durationMin * 60000)));
      } catch { /* ignore */ }
    }
  }

  function handleDurationChange(val: string) {
    const mins = Math.max(5, parseInt(val) || 15);
    setDurationMin(mins);
    try {
      const s = new Date(startAt);
      if (!isNaN(s.getTime())) setEndAt(toLocalDatetimeStr(new Date(s.getTime() + mins * 60000)));
    } catch { /* ignore */ }
  }

  function handleEndChange(val: string) {
    setEndAt(val);
    try {
      const s = new Date(startAt);
      const e = new Date(val);
      if (!isNaN(s.getTime()) && !isNaN(e.getTime()) && e > s) {
        setDurationMin(Math.round((e.getTime() - s.getTime()) / 60000));
      }
    } catch { /* ignore */ }
  }

  function toggleAllDay(checked: boolean) {
    setAllDay(checked);
    if (checked) {
      setStartAt(startAt.slice(0, 10));
      setEndAt(endAt.slice(0, 10));
    } else {
      setStartAt(`${startAt.slice(0, 10)}T09:00`);
      setEndAt(`${endAt.slice(0, 10)}T10:00`);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Un titre est requis."); return; }
    if (!calendarId) { setError("Sélectionnez un calendrier."); return; }
    if (recurrenceEnabled && recurrenceDays.length === 0) { setError("Sélectionnez au moins un jour de récurrence."); return; }
    if (recurrenceEnabled && recurrenceEnd < recurrenceStart) { setError("La fin de la récurrence doit suivre son début."); return; }
    setSaving(true);
    try {
      const effectiveEnd = durationMode && !allDay ? computedEndAt() : endAt;
      const start = allDay ? `${startAt.slice(0, 10)}T00:00:00.000Z` : new Date(startAt).toISOString();
      // For all-day: use same date as start, end at 23:59 local = store as local date sentinel
      const end = allDay ? `${startAt.slice(0, 10)}T23:59:59.000Z` : new Date(effectiveEnd).toISOString();
      await onSave({
        calendar_id: calendarId,
        color: eventColor,
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
        location_lat: locationLat,
        location_lon: locationLon,
        all_day: allDay,
        allows_overlap: allowsOverlap,
        start_at: start,
        end_at: end,
        recurrence_days: recurrenceEnabled ? recurrenceDays : [],
        recurrence_start: recurrenceEnabled ? recurrenceStart : null,
        recurrence_end: recurrenceEnabled ? recurrenceEnd : null,
        recurrence_timezone: recurrenceEnabled ? recurrenceTimezone : null,
      });
      onClose();
    } catch {
      setError("Erreur lors de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    setSaving(true);
    try {
      await onDelete();
      onClose();
    } catch {
      setError("Erreur lors de la suppression.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Backdrop onClose={onClose}>
      <div className="bg-black/30 backdrop-blur-sm border border-white/10 rounded-xl shadow-2xl w-full max-w-md p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold text-sm">
            {initial ? "Modifier l'événement" : "Nouvel événement"}
          </h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Title */}
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-sky-500/60"
            placeholder="Titre de l'événement"
          />

          {/* Calendar selector */}
          <div className="flex items-center gap-2">
            <CalendarDaysIcon className="h-4 w-4 text-white/40 shrink-0" />
            <select
              value={calendarId}
              onChange={(e) => setCalendarId(e.target.value)}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-white/30 appearance-none"
            >
              {calendars.map((cal) => (
                <option key={cal.calendar_id} value={cal.calendar_id} style={{ background: "#171717" }}>
                  {cal.name}
                </option>
              ))}
            </select>
          </div>

          <ColorOverridePicker
            value={eventColor}
            defaultColor={calendars.find((calendar) => calendar.calendar_id === calendarId)?.color ?? "#64748b"}
            onChange={setEventColor}
          />

          {/* All day toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <div
              className={`relative w-8 h-4 rounded-full transition-colors ${allDay ? "bg-white/80" : "bg-white/10"}`}
              onClick={() => toggleAllDay(!allDay)}
            >
              <div className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${allDay ? "translate-x-4" : "translate-x-0.5"}`} />
            </div>
            <span className="text-xs text-white/60">Journée entière</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={allowsOverlap} onChange={(event) => setAllowsOverlap(event.target.checked)}
              className="h-3.5 w-3.5 accent-white" />
            <span className="text-xs text-white/60">Créneau non bloquant</span>
          </label>

          {/* Date/time + duration toggle */}
          {!allDay && (
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-white/40">Horaires</span>
              <div className="flex items-center gap-1 border border-white/10 rounded overflow-hidden text-[10px]">
                <button type="button" onClick={() => setDurationMode(false)}
                  className={`px-2 py-0.5 transition-colors ${!durationMode ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60"}`}>
                  Date de fin
                </button>
                <button type="button" onClick={() => setDurationMode(true)}
                  className={`px-2 py-0.5 transition-colors ${durationMode ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60"}`}>
                  Durée
                </button>
              </div>
            </div>
          )}

          <div className={`grid gap-2 ${allDay ? "grid-cols-1" : "grid-cols-2"}`}>
            <div>
              <label className="block text-xs text-white/40 mb-1">Début</label>
              <input
                type={allDay ? "date" : "datetime-local"}
                value={startAt}
                onChange={(e) => handleStartChange(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-white/30 [color-scheme:dark]"
              />
            </div>
            {!allDay && durationMode ? (
              <div>
                <label className="block text-xs text-white/40 mb-1">Durée (min)</label>
                <input
                  type="number" min="5" step="5"
                  value={durationMin}
                  onChange={(e) => handleDurationChange(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none [color-scheme:dark]"
                />
                <p className="text-[10px] text-white/25 mt-0.5">→ fin {computedEndAt().slice(11, 16)}</p>
              </div>
            ) : (
              <div>
                <label className="block text-xs text-white/40 mb-1">Fin</label>
                <input
                  type={allDay ? "date" : "datetime-local"}
                  value={endAt}
                  onChange={(e) => handleEndChange(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-white/30 [color-scheme:dark]"
                />
              </div>
            )}
          </div>

          <div className="border-t border-white/10 pt-3 space-y-3">
            <label className="flex items-center gap-2 text-xs text-white/70 cursor-pointer">
              <input type="checkbox" checked={recurrenceEnabled} onChange={(event) => setRecurrenceEnabled(event.target.checked)}
                className="h-3.5 w-3.5 accent-white" />
              Répéter cet événement
            </label>
            {recurrenceEnabled && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="grid grid-cols-7 gap-1" role="group" aria-label="Jours de récurrence">
                    {RECURRENCE_DAYS.map(({ label, day }) => {
                      const selected = recurrenceDays.includes(day);
                      return (
                        <button key={day} type="button" aria-label={DAY_NAMES[day]} aria-pressed={selected}
                          onClick={() => setRecurrenceDays(selected ? recurrenceDays.filter((value) => value !== day) : [...recurrenceDays, day])}
                          className={`h-7 w-7 rounded border text-xs transition-colors ${selected ? "bg-white/20 border-white/60 text-white" : "bg-white/5 border-white/10 text-white/40 hover:text-white/70"}`}>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <button type="button" onClick={() => setRecurrenceDays([1, 2, 3, 4, 5])}
                    className="text-xs text-white/60 hover:text-white transition-colors">
                    Semaine
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-white/40 mb-1">Du</label>
                    <input type="date" required value={recurrenceStart} onChange={(event) => setRecurrenceStart(event.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none [color-scheme:dark]" />
                  </div>
                  <div>
                    <label className="block text-xs text-white/40 mb-1">Au</label>
                    <input type="date" required min={recurrenceStart} value={recurrenceEnd} onChange={(event) => setRecurrenceEnd(event.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none [color-scheme:dark]" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Location */}
          <div className="flex items-start gap-0">
            <LocationInput
              value={location}
              onChange={(v) => {
                setLocation(v);
                setLocationLat(null);
                setLocationLon(null);
              }}
              onSelect={(r) => {
                setLocationLat(r.lat);
                setLocationLon(r.lon);
              }}
            />
          </div>

          {/* Description */}
          <div className="flex items-start gap-2">
            <Bars3BottomLeftIcon className="h-4 w-4 text-white/40 mt-2 shrink-0" />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 resize-none"
              placeholder="Description (optionnel)"
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex items-center justify-between pt-1">
            {onDelete ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                Supprimer
              </button>
            ) : <span />}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-3 py-1.5 text-xs rounded-lg bg-white hover:bg-white/90 text-neutral-900 font-medium transition-all disabled:opacity-50"
              >
                {saving ? "…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </Backdrop>
  );
}

// ─── Mini map (static OSM tiles) ──────────────────────────────────────────────

function MiniMap({ lat, lon }: { lat: number; lon: number }) {
  const zoom = 15;
  // Convert lat/lon to tile coords
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);

  // We show a 3×3 grid of tiles centred on the target tile
  const tiles: { tx: number; ty: number; col: number; row: number }[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      tiles.push({ tx: x + dc, ty: y + dr, col: dc + 1, row: dr + 1 });
    }
  }

  // Pixel offset of the exact point within the center tile (tile is 256px)
  const tileSize = 256;
  const latFrac = (lat * Math.PI) / 180;
  const pixX = ((lon + 180) / 360) * n * tileSize - x * tileSize;
  const pixY = ((1 - Math.log(Math.tan(latFrac) + 1 / Math.cos(latFrac)) / Math.PI) / 2) * n * tileSize - y * tileSize;
  // In the 3×3 grid the center tile starts at (tileSize, tileSize)
  const pinX = tileSize + pixX;
  const pinY = tileSize + pixY;

  return (
    <div className="relative w-full h-full overflow-hidden bg-neutral-800">
      {/* 3×3 tile mosaic */}
      <div
        className="absolute"
        style={{
          width: tileSize * 3,
          height: tileSize * 3,
          left: "50%",
          top: "50%",
          transform: `translate(${-(pinX)}px, ${-(pinY)}px)`,
        }}
      >
        {tiles.map(({ tx, ty, col, row }) => (
          <img
            key={`${col}-${row}`}
            src={`https://tile.openstreetmap.org/${zoom}/${tx}/${ty}.png`}
            alt=""
            width={tileSize}
            height={tileSize}
            className="absolute"
            style={{ left: col * tileSize, top: row * tileSize }}
            draggable={false}
          />
        ))}
        {/* Pin marker */}
        <div
          className="absolute z-10 flex flex-col items-center"
          style={{ left: pinX, top: pinY, transform: "translate(-50%, -100%)" }}
        >
          <div className="w-4 h-4 rounded-full bg-red-500 border-2 border-white shadow-lg" />
          <div className="w-0.5 h-2 bg-red-500" />
        </div>
      </div>
      {/* OSM attribution */}
      <a
        href="https://www.openstreetmap.org"
        target="_blank"
        rel="noreferrer"
        className="absolute bottom-0 right-0 text-[9px] text-black/50 bg-white/70 px-1"
        onClick={(e) => e.stopPropagation()}
      >
        © OpenStreetMap
      </a>
    </div>
  );
}

// ─── Event detail popover ─────────────────────────────────────────────────────

type EventDetailProps = {
  event: CalendarEvent;
  calendar: Calendar | undefined;
  anchorRef: React.RefObject<HTMLElement | null>;
  onEdit: () => void;
  onDelete: () => Promise<void>;
  onClose: () => void;
};

function EventDetail({ event, calendar, anchorRef, onEdit, onDelete, onClose }: EventDetailProps) {
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    const anchor = anchorRef.current;
    const pop = popRef.current;
    if (!anchor || !pop) return;
    const rect = anchor.getBoundingClientRect();
    const popW = 280;
    const popH = pop.offsetHeight || 200;
    let left = rect.right + 8;
    let top = rect.top;
    if (left + popW > window.innerWidth - 8) left = rect.left - popW - 8;
    if (top + popH > window.innerHeight - 8) top = window.innerHeight - popH - 8;
    if (top < 8) top = 8;
    setPos({ top, left });
  }, [anchorRef]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (popRef.current && !popRef.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [anchorRef, onClose]);

  const dateStr = event.all_day
    ? formatDateDisplay(event.start_at)
    : `${formatDateDisplay(event.start_at)} · ${formatTime(event.start_at)} – ${formatTime(event.end_at)}`;

  return (
    <div
      ref={popRef}
      className="fixed z-50 w-[280px] bg-neutral-900 border border-white/10 rounded-xl shadow-2xl p-4"
      style={{ top: pos.top, left: pos.left }}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: event.color ?? calendar?.color ?? "#64748b" }}
          />
          <span className="text-white font-medium text-sm truncate">{event.title}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onEdit} className="text-white/40 hover:text-white transition-colors p-0.5">
            <PencilIcon className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => { void onDelete(); }} className="text-white/40 hover:text-red-400 transition-colors p-0.5">
            <TrashIcon className="h-3.5 w-3.5" />
          </button>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors p-0.5">
            <XMarkIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="space-y-1.5 text-xs text-white/60">
        <div className="flex items-center gap-1.5">
          <CalendarDaysIcon className="h-3.5 w-3.5 shrink-0" />
          <span>{dateStr}</span>
        </div>
        {calendar && (
          <div className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: calendar.color }}
            />
            <span>{calendar.name}</span>
          </div>
        )}
        {event.location && (
          <div className="flex items-center gap-1.5">
            <MapPinIcon className="h-3.5 w-3.5 shrink-0" />
            <span>{event.location}</span>
          </div>
        )}
        {event.location_lat != null && event.location_lon != null && (
          <div className="mt-2 rounded-lg overflow-hidden border border-white/10 relative h-32">
            <MiniMap lat={event.location_lat} lon={event.location_lon} />
          </div>
        )}
        {event.description && (
          <div className="flex items-start gap-1.5 mt-2">
            <Bars3BottomLeftIcon className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span className="whitespace-pre-wrap">{event.description}</span>
          </div>
        )}
        {event.allows_overlap && (
          <div className="flex items-center gap-1.5 text-white/45">
            <span className="h-2 w-2 rounded-full border border-dashed border-white/60" />
            <span>Non bloquant</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Time grid view (Jour / Semaine) ─────────────────────────────────────────

type TimeGridProps = {
  days: Date[];
  visibleEvents: CalendarEvent[];
  calendarMap: Record<string, Calendar>;
  today: Date;
  onClickSlot: (date: Date) => void;
  onClickEvent: (ev: CalendarEvent, anchor: HTMLElement) => void;
  onEditEvent: (event: CalendarEvent) => void;
};


// ─── Time grid view extended with ghosts & deadlines ─────────────────────────

type TimeGridWithGhostsProps = TimeGridProps & {
  ghosts: GhostPlacement[];
  tasks: Task[];
  completedTasks: Task[];
  onClickTask: (task: Task) => void;
  allEvents: CalendarEvent[];
};

function TimeGridViewWithGhosts({ days, visibleEvents, calendarMap, today, onClickSlot, onClickEvent, onEditEvent, ghosts, tasks, completedTasks, onClickTask, allEvents }: TimeGridWithGhostsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const totalH = 24 * PX_PER_HOUR;

  useEffect(() => {
    if (scrollRef.current) {
      const now = new Date();
      const y = (now.getHours() * 60 + now.getMinutes()) / 60 * PX_PER_HOUR;
      scrollRef.current.scrollTop = Math.max(0, y - 200);
    }
  }, []);

  function eventsForDay(day: Date): CalendarEvent[] {
    const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
    const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);
    const dayDateStr = `${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`;
    return visibleEvents.filter((ev) => {
      if (ev.all_day) {
        // Compare by date string to avoid timezone shift
        return ev.start_at.slice(0, 10) <= dayDateStr && ev.end_at.slice(0, 10) >= dayDateStr;
      }
      const s = new Date(ev.start_at);
      const e = new Date(ev.end_at);
      return s <= dayEnd && e >= dayStart;
    });
  }

  function ghostsForDay(day: Date): (GhostPlacement & { task: Task })[] {
    const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
    const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);
    return ghosts.flatMap((g) => {
      const s = new Date(g.suggested_start);
      const e = new Date(g.suggested_end);
      if (s > dayEnd || e < dayStart) return [];
      const task = tasks.find((t) => t.task_id === g.task_id);
      if (!task) return [];
      return [{ ...g, task }];
    });
  }

  function completedTasksForDay(day: Date): Task[] {
    const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
    const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);
    return completedTasks.filter((task) => {
      if (!task.started_at || !task.completed_at) return false;
      return new Date(task.started_at) <= dayEnd && new Date(task.completed_at) >= dayStart;
    });
  }

  function deadlinesForDay(day: Date): { task: Task; deadlineISO: string }[] {
    return tasks.flatMap((t) => {
      // Resolve effective deadline
      let deadlineISO: string | null = null;
      if (t.deadline_event_id) {
        const ev = allEvents.find(e => e.event_id === t.deadline_event_id);
        if (ev) deadlineISO = ev.start_at;
      } else if (t.deadline) {
        deadlineISO = t.deadline;
      }
      if (!deadlineISO) return [];
      const d = new Date(deadlineISO);
      if (d.getFullYear() === day.getFullYear() && d.getMonth() === day.getMonth() && d.getDate() === day.getDate()) {
        return [{ task: t, deadlineISO }];
      }
      return [];
    });
  }

  const nowStr = new Date().toDateString();
  const nowY = timeToY(new Date().toISOString());

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Day column headers */}
      <div className="flex border-b border-white/5 shrink-0">
        <div className="w-14 shrink-0" />
        {days.map((day, i) => (
          <div key={i} className="flex-1 flex flex-col items-center py-2 border-l border-white/5">
            <span className="text-[10px] text-white/30 uppercase tracking-wide">
              {WEEKDAYS[(day.getDay() + 6) % 7]}
            </span>
            <span className={`text-sm font-semibold mt-0.5 h-7 w-7 flex items-center justify-center rounded-full ${
              isSameDay(day, today) ? "bg-white text-neutral-900" : "text-white/70"
            }`}>
              {day.getDate()}
            </span>
          </div>
        ))}
      </div>

      {/* All-day events band */}
      {days.some((d) => eventsForDay(d).some((e) => e.all_day)) && (
        <div className="flex border-b border-white/5 shrink-0">
          <div className="w-14 shrink-0 flex items-center justify-end pr-2">
            <span className="text-[10px] text-white/20">tout-j.</span>
          </div>
          {days.map((day, i) => {
            const allDayEvs = eventsForDay(day).filter((e) => e.all_day);
            return (
              <div key={i} className="flex-1 border-l border-white/5 px-0.5 py-0.5 flex flex-col gap-0.5 min-h-[24px]">
                {allDayEvs.map((ev) => {
                  const cal = calendarMap[ev.calendar_id];
                  const color = ev.color ?? cal?.color ?? "#64748b";
                  return (
                    <button key={ev.occurrence_id ?? ev.event_id}
                      onClick={(e) => { e.stopPropagation(); onClickEvent(ev, e.currentTarget as HTMLElement); }}
                      onDoubleClick={(event) => { event.stopPropagation(); onEditEvent(ev); }}
                      className="w-full text-left px-1 rounded text-[10px] leading-5 truncate font-medium"
                      style={{ backgroundColor: color + "33", color, borderLeft: `2px ${ev.allows_overlap ? "dashed" : "solid"} ${color}` }}>
                      {ev.title}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Scrollable time grid */}
      <div ref={scrollRef} className="flex flex-1 overflow-y-auto overflow-x-hidden">
        {/* Hour gutter */}
        <div className="w-14 shrink-0 relative" style={{ height: totalH }}>
          {HOURS.map((h) => (
            <div key={h} className="absolute left-0 right-0 flex items-start justify-end pr-2"
              style={{ top: h * PX_PER_HOUR, height: PX_PER_HOUR }}>
              {h > 0 && <span className="text-[10px] text-white/20 -translate-y-2">{String(h).padStart(2, "0")}:00</span>}
            </div>
          ))}
        </div>

        {/* Day columns */}
        {days.map((day, colIdx) => {
          const dayEvs = eventsForDay(day).filter((e) => !e.all_day);
          const dayGhosts = ghostsForDay(day);
          const dayCompletedTasks = completedTasksForDay(day);
          const dayDeadlines = deadlinesForDay(day);
          const isNowDay = day.toDateString() === nowStr;
          const timedItems = assignTimeColumns([
            ...dayEvs.map((event) => ({ kind: "event" as const, start: event.start_at, end: event.end_at, event })),
            ...dayGhosts.map((ghost) => ({ kind: "ghost" as const, start: ghost.suggested_start, end: ghost.suggested_end, ghost })),
            ...dayCompletedTasks.map((task) => ({ kind: "completed" as const, start: task.started_at!, end: task.completed_at!, task })),
          ]);

          return (
            <div key={colIdx} className="flex-1 border-l border-white/5 relative cursor-pointer"
              style={{ height: totalH }}
              onClick={(e) => { if (e.target === e.currentTarget) onClickSlot(day); }}
            >
              {/* Hour lines */}
              {HOURS.map((h) => (
                <div key={h} className="absolute left-0 right-0 border-t border-white/5" style={{ top: h * PX_PER_HOUR }} />
              ))}

              {/* Current time indicator */}
              {isNowDay && (
                <div className="absolute left-0 right-0 z-20 flex items-center pointer-events-none" style={{ top: nowY }}>
                  <div className="h-2 w-2 rounded-full bg-white -ml-1 shrink-0" />
                  <div className="flex-1 h-px bg-white" />
                </div>
              )}

              {/* Deadline lines */}
              {dayDeadlines.map(({ task: t, deadlineISO }) => {
                const dl = new Date(deadlineISO);
                const y = (dl.getHours() * 60 + dl.getMinutes()) / 60 * PX_PER_HOUR;
                return (
                  <div key={t.task_id} className="absolute left-0 right-0 z-30 flex items-center pointer-events-none" style={{ top: y }}>
                    <div className="flex-1 h-0.5 bg-red-500/70 relative">
                      <span className="absolute left-1 -top-3.5 text-[9px] text-red-400 whitespace-nowrap bg-black/60 px-1 rounded">
                        ⏰ {t.title}
                      </span>
                    </div>
                  </div>
                );
              })}

              {timedItems.map((item) => {
                const top = timeToY(item.start);
                const height = durationPx(item.start, item.end);
                const horizontalStyle = {
                  left: `calc(${item.column * 100 / item.columnCount}% + 2px)`,
                  width: `calc(${100 / item.columnCount}% - 4px)`,
                };

                if (item.kind === "completed") {
                  const task = item.task;
                  const color = task.color ?? (task.calendar_id ? calendarMap[task.calendar_id]?.color : null) ?? "#64748b";
                  return (
                    <button key={`completed-${task.task_id}`} type="button"
                      onClick={(event) => { event.stopPropagation(); onClickTask(task); }}
                      onDoubleClick={(event) => { event.stopPropagation(); onClickTask(task); }}
                      className="absolute z-[15] overflow-hidden rounded border px-1.5 py-0.5 text-left text-[11px] hover:opacity-90"
                      style={{ ...horizontalStyle, top, height: Math.max(height, 20), color, borderColor: color, backgroundColor: color + "33" }}
                      title={`Terminée · ${formatTime(item.start)}–${formatTime(item.end)}`}>
                      <span className="flex items-center gap-1 font-medium leading-tight">
                        <CheckCircleSolidIcon className="h-3 w-3 shrink-0 text-green-400" />
                        <span className="truncate">{task.title}</span>
                      </span>
                      {height > 30 && <span className="block text-[10px] leading-tight opacity-70">{formatTime(item.start)} – {formatTime(item.end)}</span>}
                    </button>
                  );
                }

                if (item.kind === "ghost") {
                  const ghost = item.ghost;
                  const inProgress = ghost.task.status === "in_progress";
                  const color = ghost.task.color ?? (ghost.task.calendar_id ? calendarMap[ghost.task.calendar_id]?.color : null) ?? "#94a3b8";
                  return (
                    <button key={`${ghost.task_id}-${ghost.suggested_start}`} type="button"
                      onDoubleClick={(event) => { event.stopPropagation(); onClickTask(ghost.task); }}
                      className={`absolute z-5 overflow-hidden rounded border px-1.5 py-0.5 text-left text-[11px] ${inProgress ? "" : "border-dashed"}`}
                      style={{ ...horizontalStyle, top, height: Math.max(height, 20), backgroundColor: color + (inProgress ? "33" : "14"), color, borderColor: color + "80" }}
                      title={`${inProgress ? "En cours" : "Suggestion"}: ${ghost.task.title}`}>
                      <span className="flex items-center gap-1 truncate font-medium leading-tight opacity-70">
                        {inProgress && <ArrowPathIcon className="h-3 w-3 shrink-0" />}
                        <span className="truncate">{inProgress ? ghost.task.title : `~${ghost.task.title}`}</span>
                      </span>
                      {height > 30 && <span className="block text-[10px] leading-tight opacity-50">{formatTime(item.start)} – {formatTime(item.end)}</span>}
                    </button>
                  );
                }

                const event = item.event;
                const calendar = calendarMap[event.calendar_id];
                const color = event.color ?? calendar?.color ?? "#64748b";
                return (
                  <button key={event.occurrence_id ?? event.event_id}
                    onClick={(clickEvent) => { clickEvent.stopPropagation(); onClickEvent(event, clickEvent.currentTarget as HTMLElement); }}
                    onDoubleClick={(clickEvent) => { clickEvent.stopPropagation(); onEditEvent(event); }}
                    className="absolute z-10 overflow-hidden rounded px-1.5 py-0.5 text-left text-[11px] transition-opacity hover:opacity-90"
                    style={{ ...horizontalStyle, top, height: Math.max(height, 20), backgroundColor: color + "44", color, borderLeft: `3px ${event.allows_overlap ? "dashed" : "solid"} ${color}` }}>
                    <span className="block truncate font-medium leading-tight">{event.title}</span>
                    {height > 30 && <span className="block text-[10px] leading-tight opacity-70">{formatTime(item.start)} – {formatTime(item.end)}</span>}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── LinkedDateInput ──────────────────────────────────────────────────────────
// Smart date/event input: type an event title → suggest matching events,
// type a date/number → suggest a hard date. On select, calls onSelect with
// a resolved ISO string and an optional linked event id.

type LinkedDateSuggestion =
  | { kind: "event"; event: CalendarEvent }
  | { kind: "date"; iso: string; label: string };

type LinkedDateInputProps = {
  label: string;
  value: string;           // display string shown in the input
  linkedEventId: string | null;
  events: CalendarEvent[];
  onChange: (display: string) => void;
  onSelect: (iso: string, eventId: string | null) => void;
  onClear: () => void;
};

function LinkedDateInput({ label, value, linkedEventId, events, onChange, onSelect, onClear }: LinkedDateInputProps) {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<LinkedDateSuggestion[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function compute(q: string) {
    if (!q.trim()) { setSuggestions([]); setOpen(false); return; }
    const results: LinkedDateSuggestion[] = [];
    // Date suggestions: if input looks like a date fragment
    const dateMatch = q.match(/(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2,4}))?/);
    if (dateMatch) {
      const [, d, m, y] = dateMatch;
      const year = y ? (y.length === 2 ? 2000 + parseInt(y) : parseInt(y)) : new Date().getFullYear();
      const candidate = new Date(year, parseInt(m) - 1, parseInt(d), 0, 0, 0);
      if (!isNaN(candidate.getTime())) {
        results.push({ kind: "date", iso: candidate.toISOString(), label: candidate.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) });
      }
    }
    // Event suggestions: fuzzy match on title
    const lower = q.toLowerCase();
    events
      .filter((ev) => ev.title.toLowerCase().includes(lower))
      .sort((a, b) => a.start_at.localeCompare(b.start_at))
      .slice(0, 6)
      .forEach((ev) => results.push({ kind: "event", event: ev }));
    setSuggestions(results);
    setOpen(results.length > 0);
  }

  function handleChange(v: string) {
    onChange(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => compute(v), 200);
  }

  function pick(s: LinkedDateSuggestion) {
    if (s.kind === "event") {
      onChange(`📅 ${s.event.title}`);
      onSelect(s.event.start_at, s.event.event_id);
    } else {
      onChange(s.label);
      onSelect(s.iso, null);
    }
    setOpen(false);
    setSuggestions([]);
  }

  const linkedEvent = linkedEventId ? events.find((e) => e.event_id === linkedEventId) : null;

  return (
    <div ref={wrapRef} className="relative">
      <label className="block text-xs text-white/40 mb-1">{label}</label>
      <div className="flex items-center gap-1">
        <input
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder="Nom d'un event ou date (ex: 31/08)"
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-white/30 [color-scheme:dark]"
          autoComplete="off"
        />
        {(value || linkedEventId) && (
          <button type="button" onClick={() => { onClear(); onChange(""); setSuggestions([]); setOpen(false); }}
            className="text-white/30 hover:text-white/70 transition-colors shrink-0">
            <XMarkIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {linkedEvent && (
        <p className="text-[10px] text-purple-300/70 mt-0.5">
          → {linkedEvent.title} · {new Date(linkedEvent.start_at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}
        </p>
      )}
      {open && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-neutral-900 border border-white/10 rounded-lg shadow-xl overflow-hidden">
          {suggestions.map((s, i) => (
            <button key={i} type="button" onClick={() => pick(s)}
              className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 border-b border-white/5 last:border-0 transition-colors">
              {s.kind === "event" ? (
                <span className="flex items-center gap-2">
                  <span className="text-purple-300">📅</span>
                  <span className="text-white/80 truncate flex-1">{s.event.title}</span>
                  <span className="text-white/30 shrink-0 text-[10px]">
                    {new Date(s.event.start_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                  </span>
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <span className="text-blue-300">📆</span>
                  <span className="text-white/80">{s.label}</span>
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Task form modal ──────────────────────────────────────────────────────────

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "À faire",
  in_progress: "En cours",
  done: "Terminé",
  failed: "Échoué",
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  todo: "text-white/50",
  in_progress: "text-blue-400",
  done: "text-green-400",
  failed: "text-red-400",
};

const RECURRENCE_DAYS = [
  { label: "L", day: 1 },
  { label: "M", day: 2 },
  { label: "M", day: 3 },
  { label: "J", day: 4 },
  { label: "V", day: 5 },
  { label: "S", day: 6 },
  { label: "D", day: 0 },
];

type MaskPickerProps = {
  masks: Mask[];
  value: string;
  onChange: (maskId: string) => void;
};

function MaskPicker({ masks, value, onChange }: MaskPickerProps) {
  const selectedMask = masks.find((mask) => mask.mask_id === value);
  const selectedLabel = selectedMask?.name ?? "";
  const [query, setQuery] = useState(selectedLabel);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const normalizedQuery = query.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const filteredMasks = masks.filter((mask) =>
    mask.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(normalizedQuery),
  );
  const showNoneOption = !normalizedQuery || "aucun libre".includes(normalizedQuery);
  const options: (Mask | null)[] = [...(showNoneOption ? [null] : []), ...filteredMasks];

  useEffect(() => {
    setQuery(selectedLabel);
  }, [selectedLabel]);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery(selectedLabel);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [selectedLabel]);

  function selectMask(mask: Mask | null) {
    onChange(mask?.mask_id ?? "");
    setQuery(mask?.name ?? "");
    setOpen(false);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) => Math.max(0, Math.min(options.length - 1, current + direction)));
    } else if (event.key === "Enter" && open && options[activeIndex] !== undefined) {
      event.preventDefault();
      selectMask(options[activeIndex]);
    } else if (event.key === "Escape") {
      setOpen(false);
      setQuery(selectedLabel);
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
        <input
          role="combobox"
          aria-expanded={open}
          aria-controls="task-mask-options"
          aria-autocomplete="list"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
            setOpen(true);
          }}
          onFocus={(event) => {
            event.currentTarget.select();
            setActiveIndex(0);
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          placeholder="Rechercher un mask…"
          className="w-full bg-white/5 border border-white/10 rounded-lg py-1.5 pl-8 pr-3 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
        />
      </div>
      {open && (
        <div id="task-mask-options" role="listbox"
          className="absolute left-0 right-0 top-full mt-1 z-50 max-h-48 overflow-y-auto rounded-lg border border-white/10 bg-neutral-900 p-1 shadow-xl">
          {options.length === 0 ? (
            <div className="px-2 py-2 text-xs text-white/30">Aucun mask trouvé</div>
          ) : options.map((mask, index) => {
            const optionValue = mask?.mask_id ?? "";
            const selected = optionValue === value;
            return (
              <button key={optionValue || "none"} type="button" role="option" aria-selected={selected}
                onMouseEnter={() => setActiveIndex(index)} onClick={() => selectMask(mask)}
                className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs ${index === activeIndex ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"}`}>
                <span>{mask?.name ?? "Aucun (libre)"}</span>
                {selected && <CheckIcon className="h-3.5 w-3.5 shrink-0 text-white" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

type TaskFormProps = {
  initial?: Task;
  tasks: Task[];
  masks: Mask[];
  calendars: Calendar[];
  events: CalendarEvent[];
  onSave: (data: Omit<Task, "task_id" | "created_at" | "updated_at">) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
};

function TaskOptionSection({ label, open, onToggle, children }: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const title = label.replace(/^(un|une|des)\s+/, "");
  const displayTitle = title.charAt(0).toUpperCase() + title.slice(1);
  return (
    <div className={`rounded-lg border transition-colors ${open ? "border-white/10 bg-white/[0.02]" : "border-white/5"}`}>
      <button type="button" onClick={onToggle} aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs text-white/60 hover:text-white">
        <span>{open ? displayTitle : `Ajouter ${label.toLowerCase()}`}</span>
        {open ? <ChevronDownIcon className="h-3.5 w-3.5 rotate-180" /> : <PlusIcon className="h-3.5 w-3.5" />}
      </button>
      {open && <div className="border-t border-white/5 px-3 py-3">{children}</div>}
    </div>
  );
}

function TaskFormModal({ initial, tasks, masks, calendars, events, onSave, onDelete, onClose }: TaskFormProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [locationLat, setLocationLat] = useState<number | null>(initial?.location_lat ?? null);
  const [locationLon, setLocationLon] = useState<number | null>(initial?.location_lon ?? null);
  const [status, setStatus] = useState<TaskStatus>(initial?.status ?? "todo");
  const [calendarId, setCalendarId] = useState<string | null>(initial?.calendar_id ?? calendars[0]?.calendar_id ?? null);
  const [taskColor, setTaskColor] = useState<string | null>(initial?.color ?? null);
  const [durationMinutes, setDurationMinutes] = useState(String(initial?.duration_minutes ?? 30));
  const [priority, setPriority] = useState(String(initial?.priority ?? 0));
  const [allowsOverlap, setAllowsOverlap] = useState(initial?.allows_overlap ?? false);
  const [numericEnabled, setNumericEnabled] = useState(initial?.target_count != null);
  const [targetCount, setTargetCount] = useState(initial?.target_count ?? 1);
  const [currentCount, setCurrentCount] = useState(initial?.current_count ?? 0);
  const [maskId, setMaskId] = useState(initial?.mask_id ?? "");
  const defaultRecurrenceEnd = new Date();
  defaultRecurrenceEnd.setDate(defaultRecurrenceEnd.getDate() + 28);
  const [recurrenceEnabled, setRecurrenceEnabled] = useState((initial?.recurrence_days?.length ?? 0) > 0);
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>(initial?.recurrence_days ?? []);
  const [recurrenceTime, setRecurrenceTime] = useState(initial?.recurrence_time ?? "17:00");
  const [recurrenceStart, setRecurrenceStart] = useState(initial?.recurrence_start ?? toLocalDateStr(new Date()));
  const [recurrenceEnd, setRecurrenceEnd] = useState(initial?.recurrence_end ?? toLocalDateStr(defaultRecurrenceEnd));
  const recurrenceTimezone = initial?.recurrence_timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";

  // Deadline: display value + resolved ISO + optional linked event id
  const [deadlineDisplay, setDeadlineDisplay] = useState<string>(() => {
    if (initial?.deadline_event_id) {
      const ev = events.find(e => e.event_id === initial.deadline_event_id);
      return ev ? `📅 ${ev.title}` : "";
    }
    if (initial?.deadline) return new Date(initial.deadline).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    return "";
  });
  const [deadlineIso, setDeadlineIso] = useState<string | null>(initial?.deadline ?? null);
  const [deadlineEventId, setDeadlineEventId] = useState<string | null>(initial?.deadline_event_id ?? null);

  // Requirements (event-linked OR task-linked)
  const [dependencies, setDependencies] = useState<string[]>(initial?.dependencies ?? []);
  const [dependencyEventIds, setDependencyEventIds] = useState<string[]>(initial?.dependency_event_ids ?? []);
  // For adding a new requirement via LinkedDateInput (used as event picker only here)
  const [reqDisplay, setReqDisplay] = useState("");
  const [reqEventId, setReqEventId] = useState<string | null>(null);
  const [showMask, setShowMask] = useState(Boolean(initial?.mask_id));
  const [showRecurrence, setShowRecurrence] = useState((initial?.recurrence_days?.length ?? 0) > 0);
  const [showDeadline, setShowDeadline] = useState(Boolean(initial?.deadline || initial?.deadline_event_id));
  const [showRequirements, setShowRequirements] = useState(
    (initial?.dependencies.length ?? 0) > 0 || (initial?.dependency_event_ids.length ?? 0) > 0,
  );
  const [showLocation, setShowLocation] = useState(Boolean(initial?.location || initial?.location_lat != null || initial?.location_lon != null));
  const [showNotes, setShowNotes] = useState(Boolean(initial?.notes));
  const [showNumericGoal, setShowNumericGoal] = useState(initial?.target_count != null);
  const [showNonBlocking, setShowNonBlocking] = useState(initial?.allows_overlap ?? false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addRequirement() {
    if (!reqEventId) return;
    if (!dependencyEventIds.includes(reqEventId)) {
      setDependencyEventIds([...dependencyEventIds, reqEventId]);
    }
    setReqDisplay("");
    setReqEventId(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Un titre est requis."); return; }
    if (recurrenceEnabled && recurrenceDays.length === 0) { setError("Sélectionnez au moins un jour de récurrence."); return; }
    if (recurrenceEnabled && recurrenceEnd < recurrenceStart) { setError("La fin de la récurrence doit suivre son début."); return; }
    if (numericEnabled && targetCount < 1) { setError("L'objectif numérique doit être supérieur à zéro."); return; }
    setSaving(true);
    try {
      await onSave({
        calendar_id: calendarId,
        color: taskColor,
        title: title.trim(),
        notes: notes.trim() || null,
        location: location.trim() || null,
        location_lat: locationLat,
        location_lon: locationLon,
        type: "dynamic",
        status,
        started_at: initial?.started_at ?? null,
        completed_at: initial?.completed_at ?? null,
        start_at: null,
        end_at: null,
        all_day: false,
        allows_overlap: allowsOverlap,
        duration_minutes: parseInt(durationMinutes) || 30,
        deadline: deadlineEventId ? null : deadlineIso,
        deadline_event_id: deadlineEventId,
        mask_id: maskId || null,
        dependencies,
        dependency_event_ids: dependencyEventIds,
        priority: parseInt(priority) || 0,
        target_count: numericEnabled ? Math.max(1, Math.floor(targetCount)) : null,
        current_count: numericEnabled ? Math.max(0, Math.min(Math.floor(currentCount), Math.floor(targetCount))) : null,
        recurrence_days: recurrenceEnabled ? recurrenceDays : [],
        recurrence_time: recurrenceEnabled ? recurrenceTime : null,
        recurrence_start: recurrenceEnabled ? recurrenceStart : null,
        recurrence_end: recurrenceEnabled ? recurrenceEnd : null,
        recurrence_timezone: recurrenceEnabled ? recurrenceTimezone : null,
      });
      onClose();
    } catch {
      setError("Erreur lors de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  }

  const otherTasks = tasks.filter((t) => t.task_id !== initial?.task_id);
  const parsedDurationMinutes = parseInt(durationMinutes) || 0;
  const estimatedTotalMinutes = parsedDurationMinutes * targetCount;
  const estimatedRemainingMinutes = parsedDurationMinutes * Math.max(0, targetCount - currentCount);

  return (
    <Backdrop onClose={onClose}>
      <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-xl shadow-2xl w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold text-sm">
            {initial ? "Modifier la tâche" : "Nouvelle tâche"}
          </h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Title */}
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-sky-500/60"
            placeholder="Titre de la tâche" />

          {/* Status + Calendar */}
          <div className={`grid gap-2 ${initial ? "grid-cols-2" : "grid-cols-1"}`}>
            {initial && <div className="flex items-center gap-2">
              <label className="text-xs text-white/40 shrink-0">Statut</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none appearance-none">
                {(["todo", "in_progress", "done", "failed"] as TaskStatus[]).map((s) => (
                  <option key={s} value={s} style={{ background: "#171717" }}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>}
            {calendars.length > 0 && (
              <div className="flex items-center gap-2">
                <label className="text-xs text-white/40 shrink-0">Agenda</label>
                <select value={calendarId ?? ""} onChange={(e) => setCalendarId(e.target.value || null)}
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none appearance-none">
                  <option value="" style={{ background: "#171717" }}>— aucun —</option>
                  {calendars.map((c) => (
                    <option key={c.calendar_id} value={c.calendar_id} style={{ background: "#171717" }}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <ColorOverridePicker
            value={taskColor}
            defaultColor={calendars.find((calendar) => calendar.calendar_id === calendarId)?.color ?? "#64748b"}
            onChange={setTaskColor}
          />

          {/* Duration + Priority */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-white/40 mb-1">{numericEnabled ? "Durée unitaire (min)" : "Durée (min)"}</label>
              <input type="number" min="5" step="5" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none" />
              {numericEnabled && (
                <p className="mt-1 text-[10px] leading-tight text-white/40">
                  Attention, durée unitaire. Total estimé : {estimatedTotalMinutes} min · Restant : {estimatedRemainingMinutes} min
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Priorité (0-10)</label>
              <input type="number" min="0" max="10" value={priority} onChange={(e) => setPriority(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none" />
            </div>
          </div>

          <TaskOptionSection label="un objectif numérique" open={showNumericGoal} onToggle={() => {
            setShowNumericGoal((open) => !open);
            if (!showNumericGoal) setNumericEnabled(true);
          }}>
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-xs text-white/70 cursor-pointer">
                <input type="checkbox" checked={numericEnabled} onChange={(event) => setNumericEnabled(event.target.checked)} className="h-3.5 w-3.5 accent-white" />
                Activer l'objectif numérique
              </label>
              {numericEnabled && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-white/40 mb-1">Progression</label>
                      <div className="flex items-center rounded-lg border border-white/10 bg-white/5">
                        <button type="button" aria-label="Diminuer" onClick={() => setCurrentCount((count) => Math.max(0, count - 1))}
                          className="p-1.5 text-white/40 hover:text-white"><MinusIcon className="h-3.5 w-3.5" /></button>
                        <input type="number" min="0" max={targetCount} value={currentCount}
                          onChange={(event) => setCurrentCount(Math.max(0, Math.min(Number(event.target.value), targetCount)))}
                          className="min-w-0 flex-1 bg-transparent text-center text-xs text-white focus:outline-none" />
                        <button type="button" aria-label="Augmenter" onClick={() => setCurrentCount((count) => Math.min(targetCount, count + 1))}
                          className="p-1.5 text-white/40 hover:text-white"><PlusIcon className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-white/40 mb-1">Objectif</label>
                      <input type="number" min="1" value={targetCount} onChange={(event) => {
                        const target = Math.max(1, Number(event.target.value));
                        setTargetCount(target);
                        setCurrentCount((count) => Math.min(count, target));
                      }} className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white focus:outline-none" />
                    </div>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full bg-white transition-[width]" style={{ width: `${Math.min(100, currentCount / targetCount * 100)}%` }} />
                  </div>
                </>
              )}
            </div>
          </TaskOptionSection>

          <TaskOptionSection label="un créneau non bloquant" open={showNonBlocking} onToggle={() => {
            setShowNonBlocking((open) => !open);
            if (!showNonBlocking) setAllowsOverlap(true);
          }}>
            <label className="flex items-center gap-2 text-xs text-white/70 cursor-pointer">
              <input type="checkbox" checked={allowsOverlap} onChange={(event) => setAllowsOverlap(event.target.checked)}
                className="h-3.5 w-3.5 accent-white" />
              Autoriser le chevauchement
            </label>
          </TaskOptionSection>

          <TaskOptionSection label="un masque" open={showMask} onToggle={() => setShowMask((open) => !open)}>
            <MaskPicker masks={masks} value={maskId} onChange={setMaskId} />
          </TaskOptionSection>

          <TaskOptionSection label="une récurrence" open={showRecurrence} onToggle={() => {
            setShowRecurrence((open) => !open);
            if (!showRecurrence) setRecurrenceEnabled(true);
          }}>
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-xs text-white/70 cursor-pointer">
                <input type="checkbox" checked={recurrenceEnabled} onChange={(e) => setRecurrenceEnabled(e.target.checked)}
                  className="h-3.5 w-3.5 accent-white" />
                Activer la récurrence
              </label>
              {recurrenceEnabled && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="grid grid-cols-7 gap-1" role="group" aria-label="Jours de récurrence">
                    {RECURRENCE_DAYS.map(({ label, day }) => {
                      const selected = recurrenceDays.includes(day);
                      return (
                        <button key={day} type="button" aria-label={DAY_NAMES[day]} aria-pressed={selected}
                          onClick={() => setRecurrenceDays(selected ? recurrenceDays.filter((value) => value !== day) : [...recurrenceDays, day])}
                          className={`h-7 w-7 rounded border text-xs transition-colors ${selected ? "bg-white/20 border-white/60 text-white" : "bg-white/5 border-white/10 text-white/40 hover:text-white/70"}`}>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <button type="button" onClick={() => {
                    setRecurrenceDays([1, 2, 3, 4, 5]);
                    const weekMask = masks.find((mask) => mask.mask_id === "native-week" || mask.name === "Semaine");
                    if (weekMask) { setMaskId(weekMask.mask_id); setShowMask(true); }
                  }} className="text-xs text-white/60 hover:text-white transition-colors">
                    Semaine
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs text-white/40 mb-1">Heure</label>
                    <input type="time" required value={recurrenceTime} onChange={(e) => setRecurrenceTime(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs text-white/40 mb-1">Du</label>
                    <input type="date" required value={recurrenceStart} onChange={(e) => setRecurrenceStart(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs text-white/40 mb-1">Au</label>
                    <input type="date" required min={recurrenceStart} value={recurrenceEnd} onChange={(e) => setRecurrenceEnd(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none" />
                  </div>
                </div>
              </div>
              )}
            </div>
          </TaskOptionSection>

          <TaskOptionSection label="un prérequis" open={showRequirements} onToggle={() => setShowRequirements((open) => !open)}>
            <label className="block text-xs text-white/40 mb-1">Prérequis (optionnel)</label>
            {/* Add via linked input */}
            <div className="flex gap-1 mb-2">
              <div className="flex-1 relative">
                <LinkedDateInput
                  label=""
                  value={reqDisplay}
                  linkedEventId={reqEventId}
                  events={events}
                  onChange={setReqDisplay}
                  onSelect={(_iso, evId) => { setReqEventId(evId); }}
                  onClear={() => { setReqDisplay(""); setReqEventId(null); }}
                />
              </div>
              <button type="button" onClick={addRequirement} disabled={!reqEventId}
                className="self-end mb-0.5 px-2 py-1.5 text-xs rounded-lg bg-white/10 hover:bg-white/20 text-white/60 hover:text-white disabled:opacity-30 transition-all shrink-0">
                <PlusIcon className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Linked event requirements */}
            {dependencyEventIds.length > 0 && (
              <div className="flex flex-col gap-1 mb-1">
                {dependencyEventIds.map((eid) => {
                  const ev = events.find(e => e.event_id === eid);
                  return (
                    <div key={eid} className="flex items-center gap-2 px-2 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20 text-xs">
                      <span className="text-purple-300">📅</span>
                      <span className="flex-1 text-white/70 truncate">{ev?.title ?? eid}</span>
                      <span className="text-white/30 shrink-0">{ev ? new Date(ev.start_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) : ""}</span>
                      <button type="button" onClick={() => setDependencyEventIds(dependencyEventIds.filter(id => id !== eid))}
                        className="text-white/30 hover:text-red-400 transition-colors shrink-0">
                        <XMarkIcon className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Task requirements */}
            {otherTasks.length > 0 && (
              <div className="flex flex-col gap-1 max-h-28 overflow-y-auto border border-white/5 rounded-lg p-2">
                {otherTasks.map((t) => {
                  const checked = dependencies.includes(t.task_id);
                  return (
                    <label key={t.task_id} className="flex items-center gap-2 cursor-pointer py-0.5">
                      <input type="checkbox" checked={checked}
                        onChange={() => setDependencies(checked ? dependencies.filter((d) => d !== t.task_id) : [...dependencies, t.task_id])}
                        className="accent-white" />
                      <span className="text-xs text-white/60 truncate flex-1">{t.title}</span>
                      <span className={`text-[10px] shrink-0 ${STATUS_COLORS[t.status]}`}>{STATUS_LABELS[t.status]}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </TaskOptionSection>

          <TaskOptionSection label="une échéance" open={showDeadline} onToggle={() => setShowDeadline((open) => !open)}>
            <LinkedDateInput
              label="Échéance"
              value={deadlineDisplay}
              linkedEventId={deadlineEventId}
              events={events}
              onChange={setDeadlineDisplay}
              onSelect={(iso, evId) => { setDeadlineIso(iso); setDeadlineEventId(evId); }}
              onClear={() => { setDeadlineIso(null); setDeadlineEventId(null); }}
            />
          </TaskOptionSection>

          <TaskOptionSection label="un lieu" open={showLocation} onToggle={() => setShowLocation((open) => !open)}>
            <LocationInput value={location}
              onChange={(v) => { setLocation(v); setLocationLat(null); setLocationLon(null); }}
              onSelect={(r) => { setLocationLat(r.lat); setLocationLon(r.lon); }} />
          </TaskOptionSection>

          <TaskOptionSection label="des notes" open={showNotes} onToggle={() => setShowNotes((open) => !open)}>
          <div className="flex items-start gap-2">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 resize-none"
              placeholder="Notes (optionnel)" />
          </div>
          </TaskOptionSection>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex items-center justify-between pt-1">
            {onDelete ? (
              <button type="button" onClick={() => { void onDelete?.().then(onClose); }} disabled={saving}
                className="text-xs text-red-400 hover:text-red-300 transition-colors">Supprimer</button>
            ) : <span />}
            <div className="flex gap-2">
              <button type="button" onClick={onClose}
                className="px-3 py-1.5 text-xs rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all">Annuler</button>
              <button type="submit" disabled={saving}
                className="px-3 py-1.5 text-xs rounded-lg bg-white hover:bg-white/90 text-neutral-900 font-medium transition-all disabled:opacity-50">
                {saving ? "…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </Backdrop>
  );
}

// ─── Mask form modal ──────────────────────────────────────────────────────────

// Day display order: Mon=1…Sat=6, Sun=0 — Sunday shown last
const DAY_SHORT_ORDERED: { label: string; value: number }[] = [
  { label: "Lun", value: 1 },
  { label: "Mar", value: 2 },
  { label: "Mer", value: 3 },
  { label: "Jeu", value: 4 },
  { label: "Ven", value: 5 },
  { label: "Sam", value: 6 },
  { label: "Dim", value: 0 },
];
function MaskFormModal({ initial, onSave, onDelete, onClose, allMasks }: {
  initial?: Mask;
  onSave: (payload: Omit<Mask, "mask_id" | "created_at" | "updated_at">) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
  allMasks: Mask[];
}) {
  const readOnly = initial?.type === "native";
  const [name, setName] = useState(initial?.name ?? "");
  const [slots, setSlots] = useState<MaskSlot[]>(initial?.slots ?? []);
  const [dateRanges, setDateRanges] = useState<MaskDateRange[]>(initial?.date_ranges ?? []);
  const [ops, setOps] = useState<{ op: "add" | "subtract"; mask_id: string }[]>(initial?.operations ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addSlot() {
    setSlots([...slots, { day: 1, start: "09:00", end: "18:00" }]);
  }

  function removeSlot(i: number) {
    setSlots(slots.filter((_, idx) => idx !== i));
  }

  function updateSlot(i: number, field: keyof MaskSlot, value: string | number) {
    setSlots(slots.map((s, idx) => idx === i ? { ...s, [field]: value } : s));
  }

  function addDateRange() {
    const start = toLocalDateStr(new Date());
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 7);
    setDateRanges([...dateRanges, { start_date: start, end_date: toLocalDateStr(endDate), start: "00:00", end: "23:59" }]);
  }

  function updateDateRange(i: number, field: keyof MaskDateRange, value: string) {
    setDateRanges(dateRanges.map((range, index) => index === i ? { ...range, [field]: value } : range));
  }

  function addOp() {
    const firstOtherMask = allMasks[0];
    if (!firstOtherMask) return;
    setOps([...ops, { op: "subtract", mask_id: firstOtherMask.mask_id }]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (readOnly) { onClose(); return; }
    if (!name.trim()) { setError("Un nom est requis."); return; }
    if (dateRanges.some((range) => range.end_date < range.start_date || range.end <= range.start)) {
      setError("Chaque plage stricte doit avoir une fin postérieure à son début.");
      return;
    }
    setSaving(true);
    try {
      await onSave({ name: name.trim(), type: "custom", slots, date_ranges: dateRanges, operations: ops });
      onClose();
    } catch {
      setError("Erreur lors de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Backdrop onClose={onClose}>
      <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-xl shadow-2xl w-full max-w-md p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold text-sm">
            {readOnly ? "Détail du mask" : initial ? "Modifier le mask" : "Nouveau mask"}
          </h2>
          <button onClick={onClose} className="text-white/40 hover:text-white"><XMarkIcon className="h-4 w-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input autoFocus={!readOnly} value={name} onChange={(e) => setName(e.target.value)} disabled={readOnly}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 disabled:opacity-60"
            placeholder="Nom du mask (ex: Travail, Ouverture magasin…)" />

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-white/40">Créneaux horaires</span>
              {!readOnly && <button type="button" onClick={addSlot} className="text-xs text-white/60 hover:text-white flex items-center gap-1">
                <PlusIcon className="h-3 w-3" /> Ajouter
              </button>}
            </div>
            {slots.map((slot, i) => (
              <div key={i} className="flex items-center gap-1.5 mb-1.5">
                <select value={slot.day} disabled={readOnly} onChange={(e) => updateSlot(i, "day", parseInt(e.target.value))}
                  className="bg-white/5 border border-white/10 rounded px-1.5 py-1 text-xs text-white focus:outline-none appearance-none">
                  {DAY_SHORT_ORDERED.map((d) => <option key={d.value} value={d.value} style={{ background: "#171717" }}>{d.label}</option>)}
                </select>
                <input type="time" value={slot.start} disabled={readOnly} onChange={(e) => updateSlot(i, "start", e.target.value)}
                  className="bg-white/5 border border-white/10 rounded px-1.5 py-1 text-xs text-white focus:outline-none [color-scheme:dark]" />
                <span className="text-white/30 text-xs">→</span>
                <input type="time" value={slot.end} disabled={readOnly} onChange={(e) => updateSlot(i, "end", e.target.value)}
                  className="bg-white/5 border border-white/10 rounded px-1.5 py-1 text-xs text-white focus:outline-none [color-scheme:dark]" />
                {!readOnly && <button type="button" onClick={() => removeSlot(i)} className="text-white/30 hover:text-red-400 p-0.5">
                  <XMarkIcon className="h-3.5 w-3.5" />
                </button>}
              </div>
            ))}
          </div>

          <div className="border-t border-white/10 pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-white/40">Plages strictes</span>
              {!readOnly && <button type="button" onClick={addDateRange} className="text-xs text-white/60 hover:text-white flex items-center gap-1">
                <PlusIcon className="h-3 w-3" /> Ajouter
              </button>}
            </div>
            {dateRanges.length === 0 && <p className="text-xs text-white/20 italic">Aucune plage datée</p>}
            {dateRanges.map((range, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-1.5 mb-2 rounded-lg border border-white/5 p-2">
                <input type="date" value={range.start_date} disabled={readOnly} onChange={(e) => updateDateRange(i, "start_date", e.target.value)}
                  className="bg-white/5 border border-white/10 rounded px-1.5 py-1 text-xs text-white focus:outline-none [color-scheme:dark]" />
                <input type="date" min={range.start_date} value={range.end_date} disabled={readOnly} onChange={(e) => updateDateRange(i, "end_date", e.target.value)}
                  className="bg-white/5 border border-white/10 rounded px-1.5 py-1 text-xs text-white focus:outline-none [color-scheme:dark]" />
                {!readOnly && <button type="button" onClick={() => setDateRanges(dateRanges.filter((_, index) => index !== i))} className="text-white/30 hover:text-red-400 p-0.5 row-span-2">
                  <XMarkIcon className="h-3.5 w-3.5" />
                </button>}
                <input type="time" value={range.start} disabled={readOnly} onChange={(e) => updateDateRange(i, "start", e.target.value)}
                  className="bg-white/5 border border-white/10 rounded px-1.5 py-1 text-xs text-white focus:outline-none [color-scheme:dark]" />
                <input type="time" value={range.end} disabled={readOnly} onChange={(e) => updateDateRange(i, "end", e.target.value)}
                  className="bg-white/5 border border-white/10 rounded px-1.5 py-1 text-xs text-white focus:outline-none [color-scheme:dark]" />
              </div>
            ))}
          </div>

          {allMasks.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-white/40">Opérations sur d'autres masks</span>
                {!readOnly && <button type="button" onClick={addOp} className="text-xs text-white/60 hover:text-white flex items-center gap-1">
                  <PlusIcon className="h-3 w-3" /> Ajouter
                </button>}
              </div>
              {ops.map((op, i) => (
                <div key={i} className="flex items-center gap-1.5 mb-1.5">
                  <select value={op.op} disabled={readOnly} onChange={(e) => setOps(ops.map((o, idx) => idx === i ? { ...o, op: e.target.value as "add" | "subtract" } : o))}
                    className="bg-white/5 border border-white/10 rounded px-1.5 py-1 text-xs text-white focus:outline-none appearance-none">
                    <option value="add" style={{ background: "#171717" }}>+ Ajouter</option>
                    <option value="subtract" style={{ background: "#171717" }}>− Soustraire</option>
                  </select>
                  <select value={op.mask_id} disabled={readOnly} onChange={(e) => setOps(ops.map((o, idx) => idx === i ? { ...o, mask_id: e.target.value } : o))}
                    className="flex-1 bg-white/5 border border-white/10 rounded px-1.5 py-1 text-xs text-white focus:outline-none appearance-none">
                    {allMasks.map((m) => <option key={m.mask_id} value={m.mask_id} style={{ background: "#171717" }}>{m.name}</option>)}
                  </select>
                  {!readOnly && <button type="button" onClick={() => setOps(ops.filter((_, idx) => idx !== i))} className="text-white/30 hover:text-red-400 p-0.5">
                    <XMarkIcon className="h-3.5 w-3.5" />
                  </button>}
                </div>
              ))}
            </div>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex items-center justify-between gap-2 pt-1">
            {onDelete && !readOnly ? (
              <button type="button" onClick={() => { void onDelete().then(onClose); }}
                className="text-xs text-red-400 hover:text-red-300 transition-colors">Supprimer</button>
            ) : <span />}
            <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all">Annuler</button>
            {!readOnly && <button type="submit" disabled={saving} className="px-3 py-1.5 text-xs rounded-lg bg-white hover:bg-white/90 text-neutral-900 font-medium disabled:opacity-50">
              {saving ? "…" : initial ? "Enregistrer" : "Créer"}
            </button>}
            </div>
          </div>
        </form>
      </div>
    </Backdrop>
  );
}

// ─── Task pool panel ──────────────────────────────────────────────────────────

type SidePanel = "calendars" | "tasks" | "masks";

type TaskPoolPanelProps = {
  tasks: Task[];
  masks: Mask[];
  calendars: Calendar[];
  onNewTask: () => void;
  onEditTask: (t: Task) => void;
  onQuickStatus: (t: Task, s: TaskStatus) => void;
  onDeleteTask: (t: Task) => Promise<void>;
  onConvertTask: (t: Task) => Promise<void>;
  onDuplicateTask: (task: Task) => Promise<void>;
  onIncrementTask: (task: Task) => Promise<void>;
};

function TaskPoolPanel({ tasks, masks, calendars, onNewTask, onEditTask, onQuickStatus, onDeleteTask, onConvertTask, onDuplicateTask, onIncrementTask }: TaskPoolPanelProps) {
  const [contextMenu, setContextMenu] = useState<{ task: Task; x: number; y: number } | null>(null);
  const [incrementingTaskId, setIncrementingTaskId] = useState<string | null>(null);
  const doneTasks = new Set(tasks.filter((t) => t.status === "done").map((t) => t.task_id));

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("mousedown", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [contextMenu]);

  function isUnlocked(t: Task): boolean {
    return t.type !== "dynamic" || t.dependencies.every((d) => doneTasks.has(d));
  }

  async function incrementTask(task: Task) {
    if (incrementingTaskId) return;
    setIncrementingTaskId(task.task_id);
    try {
      await onIncrementTask(task);
    } finally {
      setIncrementingTaskId(null);
    }
  }

  const byStatus: Record<TaskStatus, Task[]> = { todo: [], in_progress: [], done: [], failed: [] };
  for (const t of tasks) byStatus[t.status].push(t);
  byStatus.todo.sort((left, right) => {
    const availabilityDelta = Number(isUnlocked(right)) - Number(isUnlocked(left));
    if (availabilityDelta !== 0) return availabilityDelta;
    if (right.priority !== left.priority) return right.priority - left.priority;
    if (left.deadline && right.deadline) return left.deadline.localeCompare(right.deadline);
    if (left.deadline) return -1;
    if (right.deadline) return 1;
    return left.created_at.localeCompare(right.created_at);
  });
  byStatus.in_progress.sort((left, right) => (left.started_at ?? left.updated_at).localeCompare(right.started_at ?? right.updated_at));
  byStatus.done.sort((left, right) => (right.completed_at ?? right.updated_at).localeCompare(left.completed_at ?? left.updated_at));

  const sections: { key: TaskStatus; label: string; icon: React.ReactNode }[] = [
    { key: "in_progress", label: "En cours", icon: <ArrowPathIcon className="h-3.5 w-3.5" /> },
    { key: "todo", label: "À faire", icon: <ListBulletIcon className="h-3.5 w-3.5" /> },
    { key: "failed", label: "Échoué", icon: <ExclamationCircleIcon className="h-3.5 w-3.5" /> },
    { key: "done", label: "Terminé", icon: <CheckCircleIcon className="h-3.5 w-3.5" /> },
  ];

  return (
    <>
    <div className="flex flex-col gap-3 overflow-y-auto flex-1">
      <button
        onClick={onNewTask}
        className="flex items-center justify-center gap-1.5 w-full py-2 text-xs rounded-lg border border-dashed border-white/10 text-white/40 hover:text-white hover:border-white/20 transition-all"
      >
        <PlusIcon className="h-3.5 w-3.5" />
        Nouvelle tâche
      </button>

      {sections.map(({ key, label, icon }) => {
        const sectionTasks = byStatus[key];
        if (sectionTasks.length === 0 && key !== "todo") return null;
        return (
          <div key={key}>
            <div className={`flex items-center gap-1.5 text-[10px] uppercase tracking-widest mb-1.5 ${STATUS_COLORS[key]} font-semibold`}>
              {icon}
              {label}
              <span className="opacity-50 font-normal">({sectionTasks.length})</span>
            </div>
            <div className="flex flex-col gap-1">
              {sectionTasks.length === 0 && (
                <span className="text-xs text-white/15 italic px-1">Aucune tâche</span>
              )}
              {sectionTasks.map((t) => {
                const unlocked = isUnlocked(t);
                const mask = t.mask_id ? masks.find((m) => m.mask_id === t.mask_id) : null;
                const color = t.color ?? (t.calendar_id ? calendars.find((calendar) => calendar.calendar_id === t.calendar_id)?.color : null) ?? "#64748b";
                return (
                  <div
                    key={t.task_id}
                    className={`group rounded-lg px-2 py-1.5 border transition-all cursor-pointer ${
                      unlocked
                        ? "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                        : "border-white/5 bg-black/20 opacity-50"
                    }`}
                    onClick={() => onEditTask(t)}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      setContextMenu({
                        task: t,
                        x: Math.min(event.clientX, window.innerWidth - 190),
                        y: Math.min(event.clientY, window.innerHeight - 170),
                      });
                    }}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (t.target_count != null) {
                            void incrementTask(t);
                            return;
                          }
                          const next: TaskStatus = t.status === "done" ? "todo" : t.status === "todo" ? "in_progress" : t.status === "in_progress" ? "done" : "todo";
                          onQuickStatus(t, next);
                        }}
                        className="shrink-0"
                      >
                        {t.status === "done"
                          ? <CheckCircleSolidIcon className="h-3.5 w-3.5 text-green-400" />
                          : t.status === "in_progress"
                          ? <ArrowPathIcon className="h-3.5 w-3.5 text-blue-400" />
                          : t.status === "failed"
                          ? <ExclamationCircleIcon className="h-3.5 w-3.5 text-red-400" />
                          : <div className="h-3.5 w-3.5 rounded-full border border-white/20" />}
                      </button>
                      <span className={`text-xs truncate flex-1 ${t.status === "done" ? "line-through text-white/30" : "text-white/70"}`}>
                        {t.title}
                      </span>
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                      <span className={`text-[9px] shrink-0 rounded px-1 py-0.5 ${t.type === "fixed" ? "bg-red-500/20 text-red-400" : "bg-blue-500/20 text-blue-400"}`}>
                        {t.type === "fixed" ? "fixe" : "dyn."}
                      </span>
                    </div>
                    {t.type === "dynamic" && (
                      <div className="flex items-center gap-2 mt-0.5 pl-5 flex-wrap">
                        {t.target_count != null && t.current_count != null && (
                          <div className="flex w-full items-center gap-1.5">
                            <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                              <div className="h-full rounded-full" style={{ width: `${Math.min(100, t.current_count / t.target_count * 100)}%`, backgroundColor: color }} />
                            </div>
                            <span className="text-[10px] tabular-nums text-white/40">{t.current_count}/{t.target_count}</span>
                            {t.current_count < t.target_count && (
                              <button type="button" title="Incrémenter" aria-label={`Incrémenter ${t.title}`}
                                disabled={incrementingTaskId === t.task_id}
                                onClick={(event) => { event.stopPropagation(); void incrementTask(t); }}
                                className="flex h-4 w-4 items-center justify-center rounded text-white/40 hover:bg-white/10 hover:text-white disabled:opacity-30">
                                <PlusIcon className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        )}
                        {t.duration_minutes && (
                          <span className="text-[10px] text-white/30 flex items-center gap-0.5">
                            <ClockIcon className="h-2.5 w-2.5" />
                            {t.target_count != null && t.current_count != null
                              ? `${t.duration_minutes} min/unité · ${t.duration_minutes * Math.max(0, t.target_count - t.current_count)} min restantes`
                              : `${t.duration_minutes} min`}
                          </span>
                        )}
                        {t.allows_overlap && (
                          <span className="text-[10px] text-white/35">non bloquant</span>
                        )}
                        {t.deadline && (
                          <span className="text-[10px] text-orange-400/70 flex items-center gap-0.5">
                            ⏰ {new Date(t.deadline).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                          </span>
                        )}
                        {mask && (
                          <span className="text-[10px] text-purple-400/70 flex items-center gap-0.5">
                            <AdjustmentsHorizontalIcon className="h-2.5 w-2.5" />{mask.name}
                          </span>
                        )}
                        {t.dependencies.length > 0 && !unlocked && (
                          <span className="text-[10px] text-yellow-400/70 flex items-center gap-0.5">
                            <LinkIcon className="h-2.5 w-2.5" />bloqué ({t.dependencies.length})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
    {contextMenu && (
      <div className="fixed z-[70] min-w-44 rounded-lg border border-white/10 bg-neutral-900 p-1 shadow-xl"
        style={{ left: contextMenu.x, top: contextMenu.y }} onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" onClick={() => { onEditTask(contextMenu.task); setContextMenu(null); }}
          className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-xs text-white/70 hover:bg-white/10 hover:text-white">
          <PencilIcon className="h-3.5 w-3.5" /> Modifier
        </button>
        <button type="button" onClick={() => { void onDuplicateTask(contextMenu.task); setContextMenu(null); }}
          className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-xs text-white/70 hover:bg-white/10 hover:text-white">
          <DocumentDuplicateIcon className="h-3.5 w-3.5" /> Dupliquer
        </button>
        <button type="button" onClick={() => { void onConvertTask(contextMenu.task); setContextMenu(null); }}
          className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-xs text-white/70 hover:bg-white/10 hover:text-white">
          <CalendarDaysIcon className="h-3.5 w-3.5" /> Convertir en événement
        </button>
        <div className="my-1 h-px bg-white/10" />
        <button type="button" onClick={() => {
          const task = contextMenu.task;
          setContextMenu(null);
          if (window.confirm(`Supprimer la tâche « ${task.title} » ?`)) void onDeleteTask(task);
        }} className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-xs text-red-300 hover:bg-red-500/15">
          <TrashIcon className="h-3.5 w-3.5" /> Supprimer
        </button>
      </div>
    )}
    </>
  );
}

// ─── Masks panel ──────────────────────────────────────────────────────────────

function MasksPanelContent({ masks, onNewMask, onOpenMask }: {
  masks: Mask[];
  onNewMask: () => void;
  onOpenMask: (mask: Mask) => void;
}) {
  const groups = [
    { label: "Primitifs", masks: masks.filter((mask) => mask.type === "native") },
    { label: "Personnalisés", masks: masks.filter((mask) => mask.type === "custom") },
  ];

  return (
    <div className="flex flex-col gap-3 overflow-y-auto flex-1">
      <button
        onClick={onNewMask}
        className="flex items-center justify-center gap-1.5 w-full py-2 text-xs rounded-lg border border-dashed border-white/10 text-white/40 hover:text-white hover:border-white/20 transition-all"
      >
        <PlusIcon className="h-3.5 w-3.5" />
        Nouveau mask
      </button>
      {groups.map((group) => (
        <section key={group.label}>
          <h3 className="mb-1.5 text-[10px] font-semibold uppercase text-white/30">{group.label}</h3>
          <div className="flex flex-col gap-1">
            {group.masks.length === 0 && <span className="px-1 text-xs italic text-white/15">Aucun mask</span>}
            {group.masks.map((mask) => (
              <button key={mask.mask_id} onClick={() => onOpenMask(mask)}
                className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-2 text-left hover:bg-white/[0.06] transition-colors">
                <AdjustmentsHorizontalIcon className="h-3.5 w-3.5 shrink-0 text-white/40" />
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-white/70">{mask.name}</span>
                <span className="rounded bg-white/10 px-1 py-0.5 text-[9px] text-white/40">
                  {mask.type === "native" ? "natif" : "user"}
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  useDocumentTitle("Calendar");

  const today = new Date();
  const [view, setView] = useState<CalendarView>(() => {
    const saved = localStorage.getItem("calendar_view");
    return (saved === "day" || saved === "week" || saved === "month") ? saved : "month";
  });
  const [viewDate, setViewDate] = useState(new Date(today));

  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [masks, setMasks] = useState<Mask[]>([]);
  const [ghosts, setGhosts] = useState<GhostPlacement[]>([]);
  const [hiddenCalendars, setHiddenCalendars] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(true);
  const [sidePanel, setSidePanel] = useState<SidePanel>("calendars");

  // Modals
  const [showCalendarForm, setShowCalendarForm] = useState(false);
  const [editingCalendar, setEditingCalendar] = useState<Calendar | null>(null);
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [newEventDate, setNewEventDate] = useState<Date | null>(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showMaskForm, setShowMaskForm] = useState(false);
  const [editingMask, setEditingMask] = useState<Mask | null>(null);

  // Event detail popover
  const [detailEvent, setDetailEvent] = useState<CalendarEvent | null>(null);
  const detailAnchorRef = useRef<HTMLElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cals, evs, tks, mks, ghs] = await Promise.all([
        fetchCalendars(), fetchEvents(), fetchTasks(), fetchMasks(), fetchGhostPlacements(),
      ]);
      setCalendars(cals);
      setEvents(evs);
      setTasks(tks);
      setMasks(mks);
      setGhosts(ghs);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // ── Navigation ──────────────────────────────────────────────────────────────

  function prev() {
    setViewDate((d) => {
      const n = new Date(d);
      if (view === "day") n.setDate(d.getDate() - 1);
      else if (view === "week") n.setDate(d.getDate() - 7);
      else { n.setDate(1); n.setMonth(d.getMonth() - 1); }
      return n;
    });
  }
  function next() {
    setViewDate((d) => {
      const n = new Date(d);
      if (view === "day") n.setDate(d.getDate() + 1);
      else if (view === "week") n.setDate(d.getDate() + 7);
      else { n.setDate(1); n.setMonth(d.getMonth() + 1); }
      return n;
    });
  }
  function goToday() { setViewDate(new Date(today)); }

  // ── Calendars sidebar ───────────────────────────────────────────────────────

  function toggleCalendarVisibility(calId: string) {
    setHiddenCalendars((prev) => {
      const next = new Set(prev);
      if (next.has(calId)) next.delete(calId);
      else next.add(calId);
      return next;
    });
  }

  async function handleSaveCalendar(name: string, color: string, description: string) {
    if (editingCalendar) {
      const updated = await updateCalendar(editingCalendar.calendar_id, { name, color, description: description || null });
      setCalendars((prev) => prev.map((c) => c.calendar_id === updated.calendar_id ? updated : c));
    } else {
      const created = await createCalendar({ name, color, description });
      setCalendars((prev) => [...prev, created]);
    }
    setEditingCalendar(null);
  }

  async function handleDeleteCalendar() {
    if (!editingCalendar) return;
    await deleteCalendar(editingCalendar.calendar_id);
    setCalendars((prev) => prev.filter((c) => c.calendar_id !== editingCalendar.calendar_id));
    setEvents((prev) => prev.filter((e) => e.calendar_id !== editingCalendar.calendar_id));
    setEditingCalendar(null);
  }

  // ── Events ──────────────────────────────────────────────────────────────────

  async function handleSaveEvent(data: Parameters<typeof createEvent>[0]) {
    if (editingEvent) {
      const updated = await updateEvent(editingEvent.event_id, data);
      setEvents((prev) => prev.map((e) => e.event_id === updated.event_id ? updated : e));
    } else {
      const created = await createEvent(data);
      setEvents((prev) => [...prev, created]);
    }
    setEditingEvent(null);
    setNewEventDate(null);
  }

  async function handleDeleteEvent(eventId: string) {
    await deleteEvent(eventId);
    setEvents((prev) => prev.filter((e) => e.event_id !== eventId));
    setDetailEvent(null);
  }

  function openNewEvent(day: Date) {
    if (calendars.length === 0) { setEditingCalendar(null); setShowCalendarForm(true); return; }
    setNewEventDate(day);
    setEditingEvent(null);
    setShowEventForm(true);
    setDetailEvent(null);
  }

  function openEditEvent(ev: CalendarEvent) {
    setEditingEvent(ev);
    setDetailEvent(null);
    setShowEventForm(true);
  }

  function handleClickEvent(ev: CalendarEvent, anchor: HTMLElement) {
    detailAnchorRef.current = anchor;
    setDetailEvent(ev);
  }

  // ── Tasks ────────────────────────────────────────────────────────────────────

  async function handleSaveTask(data: Omit<Task, "task_id" | "created_at" | "updated_at">) {
    if (editingTask) {
      const updated = await updateTask(editingTask.task_id, data);
      setTasks((prev) => prev.map((t) => t.task_id === updated.task_id ? updated : t));
    } else {
      const created = await createTask(data);
      setTasks((prev) => [...prev, created]);
    }
    // Recompute ghosts after task change
    const newGhosts = await fetchGhostPlacements();
    setGhosts(newGhosts);
    setEditingTask(null);
  }

  async function deleteTaskRecord(task: Task) {
    await deleteTask(task.task_id);
    setTasks((prev) => prev.filter((item) => item.task_id !== task.task_id));
    const newGhosts = await fetchGhostPlacements();
    setGhosts(newGhosts);
  }

  async function handleDeleteTask() {
    if (!editingTask) return;
    await deleteTaskRecord(editingTask);
    setEditingTask(null);
  }

  async function handleConvertTask(task: Task) {
    const calendarId = task.calendar_id ?? calendars[0]?.calendar_id;
    if (!calendarId) {
      setEditingCalendar(null);
      setShowCalendarForm(true);
      return;
    }

    const firstGhost = ghosts
      .filter((ghost) => ghost.task_id === task.task_id)
      .sort((left, right) => left.suggested_start.localeCompare(right.suggested_start))[0];
    const fallbackStart = new Date();
    fallbackStart.setSeconds(0, 0);
    fallbackStart.setMinutes(Math.ceil(fallbackStart.getMinutes() / 30) * 30);
    const startAt = task.start_at ?? firstGhost?.suggested_start ?? fallbackStart.toISOString();
    const endAt = task.end_at ?? firstGhost?.suggested_end
      ?? new Date(new Date(startAt).getTime() + (task.duration_minutes ?? 30) * 60_000).toISOString();

    const created = await createEvent({
      calendar_id: calendarId,
      color: task.color,
      title: task.title,
      description: task.notes ?? "",
      location: task.location ?? "",
      location_lat: task.location_lat,
      location_lon: task.location_lon,
      all_day: task.all_day,
      allows_overlap: task.allows_overlap,
      start_at: startAt,
      end_at: endAt,
      recurrence_days: task.recurrence_days,
      recurrence_start: task.recurrence_start,
      recurrence_end: task.recurrence_end,
      recurrence_timezone: task.recurrence_timezone,
    });
    await deleteTask(task.task_id);
    setEvents((prev) => [...prev, created]);
    setTasks((prev) => prev.filter((item) => item.task_id !== task.task_id));
    setGhosts(await fetchGhostPlacements());
    setEditingTask(null);
    setShowTaskForm(false);
  }

  async function handleDuplicateTask(task: Task) {
    const duplicated = await createTask({
      calendar_id: task.calendar_id,
      color: task.color,
      title: `${task.title} (copie)`,
      notes: task.notes,
      location: task.location,
      location_lat: task.location_lat,
      location_lon: task.location_lon,
      type: "dynamic",
      status: "todo",
      started_at: null,
      completed_at: null,
      start_at: null,
      end_at: null,
      all_day: false,
      allows_overlap: task.allows_overlap,
      duration_minutes: task.duration_minutes,
      deadline: task.deadline,
      deadline_event_id: task.deadline_event_id,
      mask_id: task.mask_id,
      dependencies: [...task.dependencies],
      dependency_event_ids: [...task.dependency_event_ids],
      priority: task.priority,
      target_count: task.target_count,
      current_count: task.target_count == null ? null : 0,
      recurrence_days: [...task.recurrence_days],
      recurrence_time: task.recurrence_time,
      recurrence_start: task.recurrence_start,
      recurrence_end: task.recurrence_end,
      recurrence_timezone: task.recurrence_timezone,
    });
    setTasks((prev) => [...prev, duplicated]);
    setGhosts(await fetchGhostPlacements());
  }

  async function handleQuickStatus(task: Task, newStatus: TaskStatus) {
    const updated = await updateTask(task.task_id, { status: newStatus });
    setTasks((prev) => prev.map((t) => t.task_id === updated.task_id ? updated : t));
    const newGhosts = await fetchGhostPlacements();
    setGhosts(newGhosts);
  }

  async function handleIncrementTask(task: Task) {
    if (task.target_count == null || task.current_count == null || task.current_count >= task.target_count) return;
    const updated = await updateTask(task.task_id, { current_count: task.current_count + 1 });
    setTasks((prev) => prev.map((item) => item.task_id === updated.task_id ? updated : item));
    setGhosts(await fetchGhostPlacements());
  }

  // ── Masks ────────────────────────────────────────────────────────────────────

  async function handleSaveMask(payload: Omit<Mask, "mask_id" | "created_at" | "updated_at">) {
    if (editingMask) {
      const updated = await updateMask(editingMask.mask_id, payload);
      setMasks((prev) => prev.map((mask) => mask.mask_id === updated.mask_id ? updated : mask));
    } else {
      const created = await createMask(payload);
      setMasks((prev) => [...prev, created]);
    }
    setEditingMask(null);
  }

  async function handleDeleteMask(maskId: string) {
    await deleteMask(maskId);
    setMasks((prev) => prev.filter((m) => m.mask_id !== maskId));
    setEditingMask(null);
  }

  // ── Derived ─────────────────────────────────────────────────────────────────

  const calendarMap = Object.fromEntries(calendars.map((c) => [c.calendar_id, c]));

  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();
  const grid = getMonthGrid(viewYear, viewMonth);
  const weekDays = getWeekDays(viewDate);
  const displayStart = view === "month" ? grid[0] : view === "week" ? weekDays[0] : viewDate;
  const displayEnd = view === "month" ? grid[grid.length - 1] : view === "week" ? weekDays[weekDays.length - 1] : viewDate;
  const visibleEvents = expandRecurringEvents(events, displayStart, displayEnd)
    .filter((event) => !hiddenCalendars.has(event.calendar_id));
  const completedTasks = tasks.filter((task) =>
    task.status === "done"
    && task.started_at
    && task.completed_at
    && (!task.calendar_id || !hiddenCalendars.has(task.calendar_id)),
  );

  function eventsOnDay(day: Date): CalendarEvent[] {
    const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
    const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);
    const dayDateStr = `${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`;
    return visibleEvents.filter((ev) => {
      if (ev.all_day) {
        return ev.start_at.slice(0, 10) <= dayDateStr && ev.end_at.slice(0, 10) >= dayDateStr;
      }
      const s = new Date(ev.start_at);
      const e = new Date(ev.end_at);
      return s <= dayEnd && e >= dayStart;
    });
  }

  function ghostsOnDay(day: Date): (GhostPlacement & { task: Task })[] {
    const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
    const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);
    return ghosts.flatMap((g) => {
      const s = new Date(g.suggested_start);
      const e = new Date(g.suggested_end);
      if (s > dayEnd || e < dayStart) return [];
      const task = tasks.find((t) => t.task_id === g.task_id);
      if (!task) return [];
      return [{ ...g, task }];
    });
  }

  function completedTasksOnDay(day: Date): Task[] {
    const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
    const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);
    return completedTasks.filter((task) =>
      new Date(task.started_at!) <= dayEnd && new Date(task.completed_at!) >= dayStart,
    );
  }

  function deadlinesOnDay(day: Date): Task[] {
    return tasks.filter((t) => {
      if (!t.deadline) return false;
      const d = new Date(t.deadline);
      return isSameDay(d, day);
    });
  }

  const unlockedPendingCount = tasks.filter((t) => {
    if (t.status !== "todo") return false;
    const doneTasks = new Set(tasks.filter((x) => x.status === "done").map((x) => x.task_id));
    return t.type !== "dynamic" || t.dependencies.every((d) => doneTasks.has(d));
  }).length;

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-white/30 text-sm">
        Chargement…
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden h-full">
      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <aside className="w-1/4 min-w-[220px] max-w-[320px] shrink-0 flex flex-col border-r border-white/5 bg-black/20 py-4 px-3 gap-3">
        {/* Panel tabs */}
        <div className="flex gap-1 border border-white/10 rounded-lg overflow-hidden text-[10px]">
          <button onClick={() => setSidePanel("calendars")}
            className={`flex-1 py-1.5 transition-colors ${sidePanel === "calendars" ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60"}`}>
            Agendas
          </button>
          <button onClick={() => setSidePanel("tasks")}
            className={`flex-1 py-1.5 transition-colors relative ${sidePanel === "tasks" ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60"}`}>
            Tâches
            {unlockedPendingCount > 0 && (
              <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-blue-400" />
            )}
          </button>
          <button onClick={() => setSidePanel("masks")}
            className={`flex-1 py-1.5 transition-colors ${sidePanel === "masks" ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60"}`}>
            Masks
          </button>
        </div>

        {/* Calendars panel */}
        {sidePanel === "calendars" && (
          <>
            <div className="text-xs text-white/40 uppercase tracking-widest font-semibold px-1">
              Mes calendriers
            </div>
            <div className="flex flex-col gap-1">
              {calendars.map((cal) => {
                const hidden = hiddenCalendars.has(cal.calendar_id);
                return (
                  <div key={cal.calendar_id} className="flex items-center gap-2 group">
                    <button onClick={() => toggleCalendarVisibility(cal.calendar_id)}
                      className="flex items-center gap-2 flex-1 min-w-0 py-1 px-1 rounded-md hover:bg-white/5 transition-colors">
                      <span className="h-2.5 w-2.5 rounded-sm shrink-0 transition-opacity"
                        style={{ backgroundColor: cal.color, opacity: hidden ? 0.2 : 1 }} />
                      <span className={`text-xs truncate transition-colors ${hidden ? "text-white/20" : "text-white/70"}`}>
                        {cal.name}
                      </span>
                    </button>
                    <button onClick={() => { setEditingCalendar(cal); setShowCalendarForm(true); }}
                      className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-white/70 transition-all p-0.5">
                      <PencilIcon className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
            <button onClick={() => { setEditingCalendar(null); setShowCalendarForm(true); }}
              className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white transition-colors px-1 mt-auto">
              <PlusIcon className="h-3.5 w-3.5" />
              Ajouter un calendrier
            </button>
          </>
        )}

        {/* Tasks panel */}
        {sidePanel === "tasks" && (
          <TaskPoolPanel
            tasks={tasks}
            masks={masks}
            calendars={calendars}
            onNewTask={() => { setEditingTask(null); setShowTaskForm(true); }}
            onEditTask={(t) => { setEditingTask(t); setShowTaskForm(true); }}
            onQuickStatus={handleQuickStatus}
            onDeleteTask={deleteTaskRecord}
            onConvertTask={handleConvertTask}
            onDuplicateTask={handleDuplicateTask}
            onIncrementTask={handleIncrementTask}
          />
        )}

        {/* Masks panel */}
        {sidePanel === "masks" && (
          <MasksPanelContent
            masks={masks}
            onNewMask={() => { setEditingMask(null); setShowMaskForm(true); }}
            onOpenMask={(mask) => { setEditingMask(mask); setShowMaskForm(true); }}
          />
        )}
      </aside>

      {/* ── Main area ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header bar */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-white/5 shrink-0">
          <button onClick={goToday}
            className="px-3 py-1 text-xs rounded-lg border border-white/10 text-white/60 hover:text-white hover:border-white/20 transition-all">
            Aujourd'hui
          </button>
          <div className="flex items-center gap-1">
            <button onClick={prev} className="p-1 rounded hover:bg-white/5 text-white/50 hover:text-white transition-all">
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <button onClick={next} className="p-1 rounded hover:bg-white/5 text-white/50 hover:text-white transition-all">
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
          <h1 className="text-sm font-semibold text-white min-w-0 truncate">
            {formatViewTitle(view, viewDate)}
          </h1>
          <div className="flex-1" />

          {/* Ghost legend */}
          {ghosts.length > 0 && (
            <div className="flex items-center gap-1.5 text-[10px] text-white/30">
              <div className="h-2 w-2 rounded-sm bg-blue-400/30 border border-blue-400/50" />
              {ghosts.length} placement{ghosts.length > 1 ? "s" : ""} suggéré{ghosts.length > 1 ? "s" : ""}
            </div>
          )}

          {/* View switcher */}
          <div className="flex items-center border border-white/10 rounded-lg overflow-hidden text-xs shrink-0">
            {(["day", "week", "month"] as CalendarView[]).map((v) => (
              <button key={v} onClick={() => { setView(v); localStorage.setItem("calendar_view", v); }}
                className={`px-3 py-1.5 transition-colors border-r border-white/10 last:border-r-0 ${
                  view === v ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70 hover:bg-white/5"
                }`}>
                {v === "day" ? "Jour" : v === "week" ? "Semaine" : "Mois"}
              </button>
            ))}
          </div>

          {/* Main CTA */}
          {calendars.length === 0 ? (
            <button onClick={() => { setEditingCalendar(null); setShowCalendarForm(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-white hover:bg-white/90 text-neutral-900 font-medium transition-all shrink-0">
              <PlusIcon className="h-3.5 w-3.5" />
              Créer un calendrier
            </button>
          ) : (
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => { setEditingTask(null); setShowTaskForm(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white font-medium transition-all">
                <PlusIcon className="h-3.5 w-3.5" />
                Nouvelle tâche
              </button>
              <button onClick={() => openNewEvent(new Date())}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-white hover:bg-white/90 text-neutral-900 font-medium transition-all">
                <PlusIcon className="h-3.5 w-3.5" />
                Nouvel événement
              </button>
            </div>
          )}
        </div>

        {/* Month view */}
        {view === "month" && (
          <>
            <div className="grid grid-cols-7 border-b border-white/5 shrink-0">
              {WEEKDAYS.map((d) => (
                <div key={d} className="py-2 text-center text-xs text-white/30 font-medium uppercase tracking-wide">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 grid-rows-6 flex-1 overflow-hidden">
              {grid.map((day, i) => {
                const isCurrentMonth = day.getMonth() === viewMonth;
                const isToday = isSameDay(day, today);
                const dayEvents = eventsOnDay(day);
                const dayGhosts = ghostsOnDay(day);
                const dayCompletedTasks = completedTasksOnDay(day);
                const deadlines = deadlinesOnDay(day);
                const dayItems = [
                  ...dayEvents.map((event) => ({
                    kind: "event" as const,
                    start: event.all_day ? Number.NEGATIVE_INFINITY : new Date(event.start_at).getTime(),
                    event,
                  })),
                  ...dayGhosts.map((ghost) => ({
                    kind: "ghost" as const,
                    start: new Date(ghost.suggested_start).getTime(),
                    ghost,
                  })),
                  ...dayCompletedTasks.map((task) => ({
                    kind: "completed" as const,
                    start: new Date(task.started_at!).getTime(),
                    task,
                  })),
                ].sort((left, right) => left.start - right.start);
                return (
                  <div key={i}
                    className={`border-b border-r border-white/5 p-1 flex flex-col min-h-0 cursor-pointer group transition-colors ${
                      isCurrentMonth ? "bg-transparent hover:bg-white/[0.02]" : "bg-black/10"
                    }`}
                    onClick={() => openNewEvent(day)}
                  >
                    <div className="flex items-center justify-center w-full mb-1">
                      <span
                        onClick={(e) => { e.stopPropagation(); setViewDate(new Date(day)); setView("day"); }}
                        className={`text-xs font-medium h-5 w-5 flex items-center justify-center rounded-full cursor-pointer transition-colors ${
                          isToday ? "bg-white text-neutral-900"
                            : isCurrentMonth ? "text-white/70 hover:text-white hover:bg-white/10"
                            : "text-white/20"
                        }`}
                      >
                        {day.getDate()}
                      </span>
                    </div>
                    {/* Deadline markers */}
                    {deadlines.map((t) => (
                      <div key={t.task_id} className="w-full h-0.5 bg-red-500/70 rounded mb-0.5 relative group/deadline" title={`Deadline: ${t.title}`}>
                        <span className="absolute left-0 bottom-1 text-[8px] text-red-400/80 whitespace-nowrap hidden group-hover/deadline:block bg-black/80 px-1 rounded z-10">
                          ⏰ {t.title}
                        </span>
                      </div>
                    ))}
                    <div className="flex flex-col gap-0.5 overflow-hidden flex-1">
                      {dayItems.slice(0, 3).map((item) => {
                        if (item.kind === "event") {
                          const event = item.event;
                          const calendar = calendarMap[event.calendar_id];
                          const color = event.color ?? calendar?.color ?? "#64748b";
                          return (
                            <button key={event.occurrence_id ?? event.event_id}
                              onClick={(clickEvent) => { clickEvent.stopPropagation(); detailAnchorRef.current = clickEvent.currentTarget as HTMLElement; setDetailEvent(event); }}
                              onDoubleClick={(clickEvent) => { clickEvent.stopPropagation(); openEditEvent(event); }}
                              className="w-full text-left px-1 py-0.5 rounded text-[10px] leading-tight truncate font-medium transition-opacity hover:opacity-80"
                              style={{ backgroundColor: color + "33", color, borderLeft: `2px ${event.allows_overlap ? "dashed" : "solid"} ${color}` }}>
                              {event.all_day ? "" : `${formatTime(event.start_at)} `}{event.title}
                            </button>
                          );
                        }

                        if (item.kind === "completed") {
                          const task = item.task;
                          const color = task.color ?? (task.calendar_id ? calendarMap[task.calendar_id]?.color : null) ?? "#64748b";
                          return (
                            <button key={`completed-${task.task_id}`} type="button"
                              onClick={(clickEvent) => { clickEvent.stopPropagation(); setEditingTask(task); setShowTaskForm(true); }}
                              onDoubleClick={(clickEvent) => { clickEvent.stopPropagation(); setEditingTask(task); setShowTaskForm(true); }}
                              className="flex w-full items-center gap-1 rounded border px-1 py-0.5 text-left text-[10px] font-medium leading-tight"
                              style={{ color, borderColor: color + "66", backgroundColor: color + "26" }}
                              title={`Terminée · ${formatTime(task.started_at!)}–${formatTime(task.completed_at!)}`}>
                              <CheckCircleSolidIcon className="h-3 w-3 shrink-0 text-green-400" />
                              <span className="shrink-0">{formatTime(task.started_at!)}</span>
                              <span className="truncate">{task.title}</span>
                            </button>
                          );
                        }

                        const ghost = item.ghost;
                        const inProgress = ghost.task.status === "in_progress";
                        const color = ghost.task.color ?? (ghost.task.calendar_id ? calendarMap[ghost.task.calendar_id]?.color : null) ?? "#94a3b8";
                        return (
                          <button key={`${ghost.task_id}-${ghost.suggested_start}`} type="button"
                            onDoubleClick={(clickEvent) => { clickEvent.stopPropagation(); setEditingTask(ghost.task); setShowTaskForm(true); }}
                            className={`flex w-full items-center gap-1 rounded border px-1 py-0.5 text-[10px] leading-tight ${inProgress ? "" : "border-dashed"}`}
                            style={{ color, borderColor: color + "66", backgroundColor: color + (inProgress ? "26" : "0d") }}
                            title={`${inProgress ? "En cours" : "Suggestion"}: ${ghost.task.title} (${formatTime(ghost.suggested_start)}–${formatTime(ghost.suggested_end)})`}>
                            {inProgress && <ArrowPathIcon className="h-3 w-3 shrink-0" />}
                            <span className="truncate">{inProgress ? "" : "~"}{formatTime(ghost.suggested_start)} {ghost.task.title}</span>
                          </button>
                        );
                      })}
                      {dayItems.length > 3 && (
                        <span className="text-[10px] text-white/30 pl-1">
                          +{dayItems.length - 3} autre{dayItems.length - 3 > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Week / Day view — extended to show ghosts & deadlines */}
        {(view === "week" || view === "day") && (
          <TimeGridViewWithGhosts
            days={view === "week" ? weekDays : [viewDate]}
            visibleEvents={visibleEvents}
            calendarMap={calendarMap}
            today={today}
            onClickSlot={openNewEvent}
            onClickEvent={handleClickEvent}
            onEditEvent={openEditEvent}
            ghosts={ghosts}
            tasks={tasks}
            completedTasks={completedTasks}
            onClickTask={(task) => { setEditingTask(task); setShowTaskForm(true); }}
            allEvents={events}
          />
        )}
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────── */}

      {showCalendarForm && (
        <CalendarFormModal
          initial={editingCalendar ?? undefined}
          onSave={handleSaveCalendar}
          onDelete={editingCalendar ? handleDeleteCalendar : undefined}
          onClose={() => { setShowCalendarForm(false); setEditingCalendar(null); }}
        />
      )}

      {showEventForm && (
        <EventFormModal
          initial={editingEvent ?? undefined}
          defaultDate={newEventDate ?? undefined}
          calendars={calendars}
          defaultCalendarId={calendars[0]?.calendar_id}
          onSave={handleSaveEvent}
          onDelete={editingEvent ? () => handleDeleteEvent(editingEvent.event_id) : undefined}
          onClose={() => { setShowEventForm(false); setEditingEvent(null); setNewEventDate(null); }}
        />
      )}

      {showTaskForm && (
        <TaskFormModal
          initial={editingTask ?? undefined}
          tasks={tasks}
          masks={masks}
          calendars={calendars}
          events={events}
          onSave={handleSaveTask}
          onDelete={editingTask ? handleDeleteTask : undefined}
          onClose={() => { setShowTaskForm(false); setEditingTask(null); }}
        />
      )}

      {showMaskForm && (
        <MaskFormModal
          initial={editingMask ?? undefined}
          onSave={handleSaveMask}
          onDelete={editingMask?.type === "custom" ? () => handleDeleteMask(editingMask.mask_id) : undefined}
          onClose={() => { setShowMaskForm(false); setEditingMask(null); }}
          allMasks={masks.filter((mask) => mask.mask_id !== editingMask?.mask_id)}
        />
      )}

      {detailEvent && (
        <EventDetail
          event={detailEvent}
          calendar={calendarMap[detailEvent.calendar_id]}
          anchorRef={detailAnchorRef}
          onEdit={() => openEditEvent(detailEvent)}
          onDelete={() => handleDeleteEvent(detailEvent.event_id)}
          onClose={() => setDetailEvent(null)}
        />
      )}
    </div>
  );
}
