import { useEffect, useState, useCallback, useRef } from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
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
  deleteMask,
  fetchGhostPlacements,
  type Calendar,
  type CalendarEvent,
  type Task,
  type TaskStatus,
  type Mask,
  type MaskSlot,
  type GhostPlacement,
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
    title: string;
    description: string;
    location: string;
    all_day: boolean;
    start_at: string;
    end_at: string;
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
  const [allDay, setAllDay] = useState(initial?.all_day ?? false);
  const [startAt, setStartAt] = useState(
    initial ? (initial.all_day ? startOfDay(initial.start_at) : initial.start_at.slice(0, 16)) : (allDay ? baseDate : defaultStart)
  );
  const [endAt, setEndAt] = useState(
    initial ? (initial.all_day ? startOfDay(initial.end_at) : initial.end_at.slice(0, 16)) : (allDay ? baseDate : defaultEnd)
  );
  const [location, setLocation] = useState(initial?.location ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setSaving(true);
    try {
      const start = allDay ? `${startAt.slice(0, 10)}T00:00:00.000Z` : new Date(startAt).toISOString();
      const end = allDay ? `${endAt.slice(0, 10)}T23:59:59.999Z` : new Date(endAt).toISOString();
      await onSave({ calendar_id: calendarId, title: title.trim(), description: description.trim(), location: location.trim(), all_day: allDay, start_at: start, end_at: end });
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
      <div className="bg-black/30 backdrop-blur-sm border border-white/10 rounded-xl shadow-2xl w-full max-w-md p-5">
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

          {/* Date/time */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-white/40 mb-1">Début</label>
              <input
                type={allDay ? "date" : "datetime-local"}
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-white/30 [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Fin</label>
              <input
                type={allDay ? "date" : "datetime-local"}
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-white/30 [color-scheme:dark]"
              />
            </div>
          </div>

          {/* Location */}
          <div className="flex items-center gap-2">
            <MapPinIcon className="h-4 w-4 text-white/40 shrink-0" />
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
              placeholder="Lieu (optionnel)"
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
            style={{ backgroundColor: calendar?.color ?? "#64748b" }}
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
        {event.description && (
          <div className="flex items-start gap-1.5 mt-2">
            <Bars3BottomLeftIcon className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span className="whitespace-pre-wrap">{event.description}</span>
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
};


// ─── Time grid view extended with ghosts & deadlines ─────────────────────────

type TimeGridWithGhostsProps = TimeGridProps & {
  ghosts: GhostPlacement[];
  tasks: Task[];
};

function TimeGridViewWithGhosts({ days, visibleEvents, calendarMap, today, onClickSlot, onClickEvent, ghosts, tasks }: TimeGridWithGhostsProps) {
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
    return visibleEvents.filter((ev) => {
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

  function deadlinesForDay(day: Date): Task[] {
    return tasks.filter((t) => {
      if (!t.deadline) return false;
      const d = new Date(t.deadline);
      return d.getFullYear() === day.getFullYear() && d.getMonth() === day.getMonth() && d.getDate() === day.getDate();
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
                  return (
                    <button key={ev.event_id}
                      onClick={(e) => { e.stopPropagation(); onClickEvent(ev, e.currentTarget as HTMLElement); }}
                      className="w-full text-left px-1 rounded text-[10px] leading-5 truncate font-medium"
                      style={{ backgroundColor: (cal?.color ?? "#64748b") + "33", color: cal?.color ?? "#94a3b8", borderLeft: `2px solid ${cal?.color ?? "#64748b"}` }}>
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
          const dayDeadlines = deadlinesForDay(day);
          const isNowDay = day.toDateString() === nowStr;

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
              {dayDeadlines.map((t) => {
                const dl = new Date(t.deadline!);
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

              {/* Ghost placements (dashed, semi-transparent) */}
              {dayGhosts.map((g) => {
                const top = timeToY(g.suggested_start);
                const height = durationPx(g.suggested_start, g.suggested_end);
                return (
                  <div key={g.task_id}
                    className="absolute left-0.5 right-0.5 rounded px-1.5 py-0.5 text-[11px] text-left overflow-hidden z-5 border border-dashed border-blue-400/50"
                    style={{ top, height: Math.max(height, 20), backgroundColor: "rgba(59,130,246,0.08)", color: "rgba(147,197,253,0.7)" }}
                    title={`Suggestion: ${g.task.title}`}
                  >
                    <span className="font-medium leading-tight block truncate opacity-70">~{g.task.title}</span>
                    {height > 30 && (
                      <span className="opacity-50 text-[10px] leading-tight block">
                        {formatTime(g.suggested_start)} – {formatTime(g.suggested_end)}
                      </span>
                    )}
                  </div>
                );
              })}

              {/* Timed events */}
              {dayEvs.map((ev) => {
                const cal = calendarMap[ev.calendar_id];
                const top = timeToY(ev.start_at);
                const height = durationPx(ev.start_at, ev.end_at);
                return (
                  <button key={ev.event_id}
                    onClick={(e) => { e.stopPropagation(); onClickEvent(ev, e.currentTarget as HTMLElement); }}
                    className="absolute left-0.5 right-0.5 rounded px-1.5 py-0.5 text-[11px] text-left overflow-hidden z-10 hover:opacity-90 transition-opacity"
                    style={{
                      top,
                      height: Math.max(height, 20),
                      backgroundColor: (cal?.color ?? "#64748b") + "44",
                      color: cal?.color ?? "#94a3b8",
                      borderLeft: `3px solid ${cal?.color ?? "#64748b"}`,
                    }}
                  >
                    <span className="font-medium leading-tight block truncate">{ev.title}</span>
                    {height > 30 && (
                      <span className="opacity-70 text-[10px] leading-tight block">
                        {formatTime(ev.start_at)} – {formatTime(ev.end_at)}
                      </span>
                    )}
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

type TaskFormProps = {
  initial?: Task;
  tasks: Task[];
  masks: Mask[];
  calendars: Calendar[];
  onSave: (data: Omit<Task, "task_id" | "created_at" | "updated_at">) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
};

function TaskFormModal({ initial, tasks, masks, calendars, onSave, onDelete, onClose }: TaskFormProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [type, setType] = useState<"fixed" | "dynamic">(initial?.type ?? "fixed");
  const [status, setStatus] = useState<TaskStatus>(initial?.status ?? "todo");
  const [calendarId, setCalendarId] = useState(initial?.calendar_id ?? calendars[0]?.calendar_id ?? null);
  // fixed
  const [startAt, setStartAt] = useState(initial?.start_at ? initial.start_at.slice(0, 16) : toLocalDatetimeStr(new Date()));
  const [endAt, setEndAt] = useState(initial?.end_at ? initial.end_at.slice(0, 16) : toLocalDatetimeStr(new Date(Date.now() + 3600000)));
  const [allDay, setAllDay] = useState(initial?.all_day ?? false);
  // dynamic
  const [durationMinutes, setDurationMinutes] = useState(String(initial?.duration_minutes ?? 30));
  const [deadline, setDeadline] = useState(initial?.deadline ? initial.deadline.slice(0, 16) : "");
  const [maskId, setMaskId] = useState(initial?.mask_id ?? "");
  const [dependencies, setDependencies] = useState<string[]>(initial?.dependencies ?? []);
  const [priority, setPriority] = useState(String(initial?.priority ?? 0));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Un titre est requis."); return; }
    setSaving(true);
    try {
      await onSave({
        calendar_id: calendarId,
        title: title.trim(),
        notes: notes.trim() || null,
        location: location.trim() || null,
        type,
        status,
        start_at: type === "fixed" && !allDay ? new Date(startAt).toISOString() : type === "fixed" && allDay ? `${startAt.slice(0, 10)}T00:00:00.000Z` : null,
        end_at: type === "fixed" && !allDay ? new Date(endAt).toISOString() : type === "fixed" && allDay ? `${endAt.slice(0, 10)}T23:59:59.999Z` : null,
        all_day: type === "fixed" ? allDay : false,
        duration_minutes: type === "dynamic" ? (parseInt(durationMinutes) || 30) : null,
        deadline: type === "dynamic" && deadline ? new Date(deadline).toISOString() : null,
        mask_id: type === "dynamic" && maskId ? maskId : null,
        dependencies: type === "dynamic" ? dependencies : [],
        priority: parseInt(priority) || 0,
      });
      onClose();
    } catch {
      setError("Erreur lors de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  }

  const otherTasks = tasks.filter((t) => t.task_id !== initial?.task_id);

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
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-sky-500/60"
            placeholder="Titre de la tâche"
          />

          {/* Type toggle */}
          <div className="flex items-center gap-1 border border-white/10 rounded-lg overflow-hidden text-xs">
            {(["fixed", "dynamic"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`flex-1 py-2 transition-colors ${type === t ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"}`}
              >
                {t === "fixed" ? "🔒 Fixe (RDV)" : "⚡ Dynamique (ASAP)"}
              </button>
            ))}
          </div>

          {/* Status */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-white/40 w-14 shrink-0">Statut</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none appearance-none"
            >
              {(["todo", "in_progress", "done", "failed"] as TaskStatus[]).map((s) => (
                <option key={s} value={s} style={{ background: "#171717" }}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>

          {/* Calendar */}
          {calendars.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-white/40 w-14 shrink-0">Agenda</label>
              <select
                value={calendarId ?? ""}
                onChange={(e) => setCalendarId(e.target.value || null)}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none appearance-none"
              >
                <option value="" style={{ background: "#171717" }}>— aucun —</option>
                {calendars.map((c) => (
                  <option key={c.calendar_id} value={c.calendar_id} style={{ background: "#171717" }}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Fixed: date/time */}
          {type === "fixed" && (
            <>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div
                  className={`relative w-8 h-4 rounded-full transition-colors ${allDay ? "bg-white/80" : "bg-white/10"}`}
                  onClick={() => setAllDay(!allDay)}
                >
                  <div className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${allDay ? "translate-x-4" : "translate-x-0.5"}`} />
                </div>
                <span className="text-xs text-white/60">Journée entière</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-white/40 mb-1">Début</label>
                  <input type={allDay ? "date" : "datetime-local"} value={startAt.slice(0, allDay ? 10 : 16)} onChange={(e) => setStartAt(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none [color-scheme:dark]" />
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-1">Fin</label>
                  <input type={allDay ? "date" : "datetime-local"} value={endAt.slice(0, allDay ? 10 : 16)} onChange={(e) => setEndAt(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none [color-scheme:dark]" />
                </div>
              </div>
            </>
          )}

          {/* Dynamic: duration, deadline, mask, dependencies, priority */}
          {type === "dynamic" && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-white/40 mb-1">Durée (min)</label>
                  <input type="number" min="5" step="5" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-1">Priorité (0-10)</label>
                  <input type="number" min="0" max="10" value={priority} onChange={(e) => setPriority(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs text-white/40 mb-1">Deadline (optionnel)</label>
                <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none [color-scheme:dark]" />
              </div>

              <div>
                <label className="block text-xs text-white/40 mb-1">Plage horaire (mask)</label>
                <select value={maskId} onChange={(e) => setMaskId(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none appearance-none">
                  <option value="" style={{ background: "#171717" }}>— aucun (libre) —</option>
                  {masks.map((m) => (
                    <option key={m.mask_id} value={m.mask_id} style={{ background: "#171717" }}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-white/40 mb-1">Dépendances (tâches à finir avant)</label>
                <div className="flex flex-col gap-1 max-h-36 overflow-y-auto">
                  {otherTasks.length === 0 ? (
                    <span className="text-xs text-white/20 italic">Aucune autre tâche disponible</span>
                  ) : otherTasks.map((t) => {
                    const checked = dependencies.includes(t.task_id);
                    return (
                      <label key={t.task_id} className="flex items-center gap-2 cursor-pointer py-0.5">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setDependencies(checked ? dependencies.filter((d) => d !== t.task_id) : [...dependencies, t.task_id])}
                          className="accent-blue-500"
                        />
                        <span className="text-xs text-white/60 truncate">{t.title}</span>
                        <span className={`text-[10px] shrink-0 ${STATUS_COLORS[t.status]}`}>{STATUS_LABELS[t.status]}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Location */}
          <div className="flex items-center gap-2">
            <MapPinIcon className="h-4 w-4 text-white/40 shrink-0" />
            <input value={location} onChange={(e) => setLocation(e.target.value)}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
              placeholder="Lieu (optionnel)" />
          </div>

          {/* Notes */}
          <div className="flex items-start gap-2">
            <Bars3BottomLeftIcon className="h-4 w-4 text-white/40 mt-2 shrink-0" />
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 resize-none"
              placeholder="Notes (optionnel)" />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex items-center justify-between pt-1">
            {onDelete ? (
              <button type="button" onClick={() => { void onDelete?.().then(onClose); }} disabled={saving} className="text-xs text-red-400 hover:text-red-300 transition-colors">
                Supprimer
              </button>
            ) : <span />}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all">
                Annuler
              </button>
              <button type="submit" disabled={saving} className="px-3 py-1.5 text-xs rounded-lg bg-white hover:bg-white/90 text-neutral-900 font-medium transition-all disabled:opacity-50">
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

const DAY_SHORT = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

function MaskFormModal({ onSave, onClose, allMasks }: {
  onSave: (payload: Omit<Mask, "mask_id" | "created_at" | "updated_at">) => Promise<void>;
  onClose: () => void;
  allMasks: Mask[];
}) {
  const [name, setName] = useState("");
  const [slots, setSlots] = useState<MaskSlot[]>([]);
  const [ops, setOps] = useState<{ op: "add" | "subtract"; mask_id: string }[]>([]);
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

  function addOp() {
    const firstOtherMask = allMasks[0];
    if (!firstOtherMask) return;
    setOps([...ops, { op: "subtract", mask_id: firstOtherMask.mask_id }]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Un nom est requis."); return; }
    setSaving(true);
    try {
      await onSave({ name: name.trim(), type: "custom", slots, operations: ops });
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
          <h2 className="text-white font-semibold text-sm">Nouveau mask horaire</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white"><XMarkIcon className="h-4 w-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-sky-500/60"
            placeholder="Nom du mask (ex: Travail, Ouverture magasin…)" />

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-white/40">Créneaux horaires</span>
              <button type="button" onClick={addSlot} className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1">
                <PlusIcon className="h-3 w-3" /> Ajouter
              </button>
            </div>
            {slots.map((slot, i) => (
              <div key={i} className="flex items-center gap-1.5 mb-1.5">
                <select value={slot.day} onChange={(e) => updateSlot(i, "day", parseInt(e.target.value))}
                  className="bg-white/5 border border-white/10 rounded px-1.5 py-1 text-xs text-white focus:outline-none appearance-none">
                  {DAY_SHORT.map((d, idx) => <option key={idx} value={idx} style={{ background: "#171717" }}>{d}</option>)}
                </select>
                <input type="time" value={slot.start} onChange={(e) => updateSlot(i, "start", e.target.value)}
                  className="bg-white/5 border border-white/10 rounded px-1.5 py-1 text-xs text-white focus:outline-none [color-scheme:dark]" />
                <span className="text-white/30 text-xs">→</span>
                <input type="time" value={slot.end} onChange={(e) => updateSlot(i, "end", e.target.value)}
                  className="bg-white/5 border border-white/10 rounded px-1.5 py-1 text-xs text-white focus:outline-none [color-scheme:dark]" />
                <button type="button" onClick={() => removeSlot(i)} className="text-white/30 hover:text-red-400 p-0.5">
                  <XMarkIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          {allMasks.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-white/40">Opérations sur d'autres masks</span>
                <button type="button" onClick={addOp} className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1">
                  <PlusIcon className="h-3 w-3" /> Ajouter
                </button>
              </div>
              {ops.map((op, i) => (
                <div key={i} className="flex items-center gap-1.5 mb-1.5">
                  <select value={op.op} onChange={(e) => setOps(ops.map((o, idx) => idx === i ? { ...o, op: e.target.value as "add" | "subtract" } : o))}
                    className="bg-white/5 border border-white/10 rounded px-1.5 py-1 text-xs text-white focus:outline-none appearance-none">
                    <option value="add" style={{ background: "#171717" }}>+ Ajouter</option>
                    <option value="subtract" style={{ background: "#171717" }}>− Soustraire</option>
                  </select>
                  <select value={op.mask_id} onChange={(e) => setOps(ops.map((o, idx) => idx === i ? { ...o, mask_id: e.target.value } : o))}
                    className="flex-1 bg-white/5 border border-white/10 rounded px-1.5 py-1 text-xs text-white focus:outline-none appearance-none">
                    {allMasks.map((m) => <option key={m.mask_id} value={m.mask_id} style={{ background: "#171717" }}>{m.name}</option>)}
                  </select>
                  <button type="button" onClick={() => setOps(ops.filter((_, idx) => idx !== i))} className="text-white/30 hover:text-red-400 p-0.5">
                    <XMarkIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all">Annuler</button>
            <button type="submit" disabled={saving} className="px-3 py-1.5 text-xs rounded-lg bg-white hover:bg-white/90 text-neutral-900 font-medium disabled:opacity-50">
              {saving ? "…" : "Créer"}
            </button>
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
  onNewTask: () => void;
  onEditTask: (t: Task) => void;
  onQuickStatus: (t: Task, s: TaskStatus) => void;
};

function TaskPoolPanel({ tasks, masks, onNewTask, onEditTask, onQuickStatus }: TaskPoolPanelProps) {
  const doneTasks = new Set(tasks.filter((t) => t.status === "done").map((t) => t.task_id));

  function isUnlocked(t: Task): boolean {
    return t.type !== "dynamic" || t.dependencies.every((d) => doneTasks.has(d));
  }

  const byStatus: Record<TaskStatus, Task[]> = { todo: [], in_progress: [], done: [], failed: [] };
  for (const t of tasks) byStatus[t.status].push(t);

  const sections: { key: TaskStatus; label: string; icon: React.ReactNode }[] = [
    { key: "todo", label: "À faire", icon: <ListBulletIcon className="h-3.5 w-3.5" /> },
    { key: "in_progress", label: "En cours", icon: <ArrowPathIcon className="h-3.5 w-3.5" /> },
    { key: "done", label: "Terminé", icon: <CheckCircleIcon className="h-3.5 w-3.5" /> },
    { key: "failed", label: "Échoué", icon: <ExclamationCircleIcon className="h-3.5 w-3.5" /> },
  ];

  return (
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
                return (
                  <div
                    key={t.task_id}
                    className={`group rounded-lg px-2 py-1.5 border transition-all cursor-pointer ${
                      unlocked
                        ? "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                        : "border-white/5 bg-black/20 opacity-50"
                    }`}
                    onClick={() => onEditTask(t)}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
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
                      <span className={`text-[9px] shrink-0 rounded px-1 py-0.5 ${t.type === "fixed" ? "bg-red-500/20 text-red-400" : "bg-blue-500/20 text-blue-400"}`}>
                        {t.type === "fixed" ? "fixe" : "dyn."}
                      </span>
                    </div>
                    {t.type === "dynamic" && (
                      <div className="flex items-center gap-2 mt-0.5 pl-5 flex-wrap">
                        {t.duration_minutes && (
                          <span className="text-[10px] text-white/30 flex items-center gap-0.5">
                            <ClockIcon className="h-2.5 w-2.5" />{t.duration_minutes}min
                          </span>
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
  );
}

// ─── Masks panel ──────────────────────────────────────────────────────────────

function MasksPanelContent({ masks, onNewMask, onDeleteMask }: {
  masks: Mask[];
  onNewMask: () => void;
  onDeleteMask: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 overflow-y-auto flex-1">
      <button
        onClick={onNewMask}
        className="flex items-center justify-center gap-1.5 w-full py-2 text-xs rounded-lg border border-dashed border-white/10 text-white/40 hover:text-white hover:border-white/20 transition-all"
      >
        <PlusIcon className="h-3.5 w-3.5" />
        Nouveau mask
      </button>
      {masks.map((m) => (
        <div key={m.mask_id} className="rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-2">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <AdjustmentsHorizontalIcon className="h-3.5 w-3.5 text-purple-400/70" />
              <span className="text-xs text-white/70 font-medium">{m.name}</span>
              <span className={`text-[9px] rounded px-1 py-0.5 ${m.type === "native" ? "bg-white/10 text-white/40" : "bg-purple-500/20 text-purple-400"}`}>
                {m.type === "native" ? "natif" : "custom"}
              </span>
            </div>
            {m.type === "custom" && (
              <button onClick={() => onDeleteMask(m.mask_id)} className="text-white/20 hover:text-red-400 transition-colors">
                <TrashIcon className="h-3 w-3" />
              </button>
            )}
          </div>
          {m.slots.length > 0 && (
            <div className="flex flex-wrap gap-1 pl-5">
              {m.slots.slice(0, 4).map((s, i) => (
                <span key={i} className="text-[9px] bg-white/5 rounded px-1 py-0.5 text-white/40">
                  {DAY_SHORT[s.day]} {s.start}-{s.end}
                </span>
              ))}
              {m.slots.length > 4 && <span className="text-[9px] text-white/20">+{m.slots.length - 4}</span>}
            </div>
          )}
          {m.operations.length > 0 && (
            <div className="flex flex-wrap gap-1 pl-5 mt-0.5">
              {m.operations.map((op, i) => (
                <span key={i} className="text-[9px] text-purple-400/60">
                  {op.op === "add" ? "+" : "−"} {masks.find((x) => x.mask_id === op.mask_id)?.name ?? "?"}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  useDocumentTitle("Calendar");

  const today = new Date();
  const [view, setView] = useState<CalendarView>("month");
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

  async function handleSaveEvent(data: {
    calendar_id: string;
    title: string;
    description: string;
    location: string;
    all_day: boolean;
    start_at: string;
    end_at: string;
  }) {
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

  async function handleDeleteTask() {
    if (!editingTask) return;
    await deleteTask(editingTask.task_id);
    setTasks((prev) => prev.filter((t) => t.task_id !== editingTask.task_id));
    const newGhosts = await fetchGhostPlacements();
    setGhosts(newGhosts);
    setEditingTask(null);
  }

  async function handleQuickStatus(task: Task, newStatus: TaskStatus) {
    const updated = await updateTask(task.task_id, { status: newStatus });
    setTasks((prev) => prev.map((t) => t.task_id === updated.task_id ? updated : t));
    const newGhosts = await fetchGhostPlacements();
    setGhosts(newGhosts);
  }

  // ── Masks ────────────────────────────────────────────────────────────────────

  async function handleSaveMask(payload: Omit<Mask, "mask_id" | "created_at" | "updated_at">) {
    const created = await createMask(payload);
    setMasks((prev) => [...prev, created]);
  }

  async function handleDeleteMask(maskId: string) {
    await deleteMask(maskId);
    setMasks((prev) => prev.filter((m) => m.mask_id !== maskId));
  }

  // ── Derived ─────────────────────────────────────────────────────────────────

  const visibleEvents = events.filter((e) => !hiddenCalendars.has(e.calendar_id));
  const calendarMap = Object.fromEntries(calendars.map((c) => [c.calendar_id, c]));

  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();
  const grid = getMonthGrid(viewYear, viewMonth);
  const weekDays = getWeekDays(viewDate);

  function eventsOnDay(day: Date): CalendarEvent[] {
    const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
    const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);
    return visibleEvents.filter((ev) => {
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
      <aside className="w-56 shrink-0 flex flex-col border-r border-white/5 bg-black/20 py-4 px-3 gap-3">
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
            onNewTask={() => { setEditingTask(null); setShowTaskForm(true); }}
            onEditTask={(t) => { setEditingTask(t); setShowTaskForm(true); }}
            onQuickStatus={handleQuickStatus}
          />
        )}

        {/* Masks panel */}
        {sidePanel === "masks" && (
          <MasksPanelContent
            masks={masks}
            onNewMask={() => setShowMaskForm(true)}
            onDeleteMask={handleDeleteMask}
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
              <button key={v} onClick={() => setView(v)}
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
            <button onClick={() => openNewEvent(new Date())}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-white hover:bg-white/90 text-neutral-900 font-medium transition-all shrink-0">
              <PlusIcon className="h-3.5 w-3.5" />
              Nouvel événement
            </button>
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
                const deadlines = deadlinesOnDay(day);
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
                      {/* Fixed events */}
                      {dayEvents.slice(0, 2).map((ev) => {
                        const cal = calendarMap[ev.calendar_id];
                        return (
                          <button key={ev.event_id}
                            onClick={(e) => { e.stopPropagation(); detailAnchorRef.current = e.currentTarget as HTMLElement; setDetailEvent(ev); }}
                            className="w-full text-left px-1 py-0.5 rounded text-[10px] leading-tight truncate font-medium transition-opacity hover:opacity-80"
                            style={{
                              backgroundColor: (cal?.color ?? "#64748b") + "33",
                              color: cal?.color ?? "#94a3b8",
                              borderLeft: `2px solid ${cal?.color ?? "#64748b"}`,
                            }}
                          >
                            {ev.all_day ? "" : `${formatTime(ev.start_at)} `}{ev.title}
                          </button>
                        );
                      })}
                      {/* Ghost placements */}
                      {dayGhosts.slice(0, 1).map((g) => (
                        <div key={g.task_id}
                          className="w-full px-1 py-0.5 rounded text-[10px] leading-tight truncate border border-dashed border-blue-400/40 text-blue-400/60"
                          title={`Suggestion: ${g.task.title} (${formatTime(g.suggested_start)}–${formatTime(g.suggested_end)})`}
                        >
                          ~{formatTime(g.suggested_start)} {g.task.title}
                        </div>
                      ))}
                      {(dayEvents.length + dayGhosts.length) > 3 && (
                        <span className="text-[10px] text-white/30 pl-1">
                          +{dayEvents.length + dayGhosts.length - 3} autre{dayEvents.length + dayGhosts.length - 3 > 1 ? "s" : ""}
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
            ghosts={ghosts}
            tasks={tasks}
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
          onSave={handleSaveTask}
          onDelete={editingTask ? handleDeleteTask : undefined}
          onClose={() => { setShowTaskForm(false); setEditingTask(null); }}
        />
      )}

      {showMaskForm && (
        <MaskFormModal
          onSave={handleSaveMask}
          onClose={() => setShowMaskForm(false)}
          allMasks={masks}
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
