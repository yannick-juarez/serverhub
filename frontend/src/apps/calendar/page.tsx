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
} from "@heroicons/react/24/outline";
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
  type Calendar,
  type CalendarEvent,
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

function TimeGridView({ days, visibleEvents, calendarMap, today, onClickSlot, onClickEvent }: TimeGridProps) {
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
            <span
              className={`text-sm font-semibold mt-0.5 h-7 w-7 flex items-center justify-center rounded-full ${
                isSameDay(day, today) ? "bg-white text-neutral-900" : "text-white/70"
              }`}
            >
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
                    <button
                      key={ev.event_id}
                      onClick={(e) => { e.stopPropagation(); onClickEvent(ev, e.currentTarget as HTMLElement); }}
                      className="w-full text-left px-1 rounded text-[10px] leading-5 truncate font-medium"
                      style={{
                        backgroundColor: (cal?.color ?? "#64748b") + "33",
                        color: cal?.color ?? "#94a3b8",
                        borderLeft: `2px solid ${cal?.color ?? "#64748b"}`,
                      }}
                    >
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
            <div
              key={h}
              className="absolute w-full flex items-start justify-end pr-2"
              style={{ top: h * PX_PER_HOUR, height: PX_PER_HOUR }}
            >
              {h > 0 && (
                <span className="text-[10px] text-white/20 -mt-2">
                  {String(h).padStart(2, "0")}:00
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Day columns */}
        {days.map((day, i) => {
          const dayEvs = eventsForDay(day).filter((e) => !e.all_day);
          const isNowDay = day.toDateString() === nowStr;

          return (
            <div
              key={i}
              className="flex-1 relative border-l border-white/5"
              style={{ height: totalH }}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const y = e.clientY - rect.top;
                const hour = Math.min(23, Math.max(0, Math.floor(y / PX_PER_HOUR)));
                const d = new Date(day);
                d.setHours(hour, 0, 0, 0);
                onClickSlot(d);
              }}
            >
              {/* Hour lines */}
              {HOURS.map((h) => (
                <div
                  key={h}
                  className="absolute left-0 right-0 border-t border-white/5 pointer-events-none"
                  style={{ top: h * PX_PER_HOUR }}
                />
              ))}

              {/* Current time indicator */}
              {isNowDay && (
                <div
                  className="absolute left-0 right-0 z-20 flex items-center pointer-events-none"
                  style={{ top: nowY }}
                >
                  <div className="h-2 w-2 rounded-full bg-white -ml-1 shrink-0" />
                  <div className="flex-1 h-px bg-white" />
                </div>
              )}

              {/* Timed events */}
              {dayEvs.map((ev) => {
                const cal = calendarMap[ev.calendar_id];
                const top = timeToY(ev.start_at);
                const height = durationPx(ev.start_at, ev.end_at);
                return (
                  <button
                    key={ev.event_id}
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  useDocumentTitle("Calendar");

  const today = new Date();
  const [view, setView] = useState<CalendarView>("month");
  const [viewDate, setViewDate] = useState(new Date(today));

  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [hiddenCalendars, setHiddenCalendars] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(true);

  // Modals
  const [showCalendarForm, setShowCalendarForm] = useState(false);
  const [editingCalendar, setEditingCalendar] = useState<Calendar | null>(null);
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [newEventDate, setNewEventDate] = useState<Date | null>(null);

  // Event detail popover
  const [detailEvent, setDetailEvent] = useState<CalendarEvent | null>(null);
  const detailAnchorRef = useRef<HTMLElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cals, evs] = await Promise.all([fetchCalendars(), fetchEvents()]);
      setCalendars(cals);
      setEvents(evs);
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
      <aside className="w-56 shrink-0 flex flex-col border-r border-white/5 bg-black/20 py-4 px-3 gap-4">
        {/* Mini month nav placeholder */}
        <div className="text-xs text-white/40 uppercase tracking-widest font-semibold px-1">
          Mes calendriers
        </div>
        <div className="flex flex-col gap-1">
          {calendars.map((cal) => {
            const hidden = hiddenCalendars.has(cal.calendar_id);
            return (
              <div key={cal.calendar_id} className="flex items-center gap-2 group">
                <button
                  onClick={() => toggleCalendarVisibility(cal.calendar_id)}
                  className="flex items-center gap-2 flex-1 min-w-0 py-1 px-1 rounded-md hover:bg-white/5 transition-colors"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-sm shrink-0 transition-opacity"
                    style={{
                      backgroundColor: cal.color,
                      opacity: hidden ? 0.2 : 1,
                    }}
                  />
                  <span className={`text-xs truncate transition-colors ${hidden ? "text-white/20" : "text-white/70"}`}>
                    {cal.name}
                  </span>
                </button>
                <button
                  onClick={() => { setEditingCalendar(cal); setShowCalendarForm(true); }}
                  className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-white/70 transition-all p-0.5"
                >
                  <PencilIcon className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
        <button
          onClick={() => { setEditingCalendar(null); setShowCalendarForm(true); }}
          className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white transition-colors px-1 mt-auto"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          Ajouter un calendrier
        </button>
      </aside>

      {/* ── Main area ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header bar */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-white/5 shrink-0">
          <button
            onClick={goToday}
            className="px-3 py-1 text-xs rounded-lg border border-white/10 text-white/60 hover:text-white hover:border-white/20 transition-all"
          >
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

          {/* View switcher */}
          <div className="flex items-center border border-white/10 rounded-lg overflow-hidden text-xs shrink-0">
            {(["day", "week", "month"] as CalendarView[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 transition-colors border-r border-white/10 last:border-r-0 ${
                  view === v ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70 hover:bg-white/5"
                }`}
              >
                {v === "day" ? "Jour" : v === "week" ? "Semaine" : "Mois"}
              </button>
            ))}
          </div>

          {/* Main CTA: create calendar when none exist, else new event */}
          {calendars.length === 0 ? (
            <button
              onClick={() => { setEditingCalendar(null); setShowCalendarForm(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-white hover:bg-white/90 text-neutral-900 font-medium transition-all shrink-0"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              Créer un calendrier
            </button>
          ) : (
            <button
              onClick={() => openNewEvent(new Date())}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-white hover:bg-white/90 text-neutral-900 font-medium transition-all shrink-0"
            >
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
                return (
                  <div
                    key={i}
                    className={`border-b border-r border-white/5 p-1 flex flex-col min-h-0 cursor-pointer group transition-colors ${
                      isCurrentMonth ? "bg-transparent hover:bg-white/[0.02]" : "bg-black/10"
                    }`}
                    onClick={() => openNewEvent(day)}
                  >
                    <div className="flex items-center justify-center w-full mb-1">
                      <span
                        onClick={(e) => { e.stopPropagation(); setViewDate(new Date(day)); setView("day"); }}
                        className={`text-xs font-medium h-5 w-5 flex items-center justify-center rounded-full cursor-pointer transition-colors ${
                          isToday
                            ? "bg-white text-neutral-900"
                            : isCurrentMonth
                            ? "text-white/70 hover:text-white hover:bg-white/10"
                            : "text-white/20"
                        }`}
                      >
                        {day.getDate()}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5 overflow-hidden flex-1">
                      {dayEvents.slice(0, 3).map((ev) => {
                        const cal = calendarMap[ev.calendar_id];
                        return (
                          <button
                            key={ev.event_id}
                            onClick={(e) => {
                              e.stopPropagation();
                              detailAnchorRef.current = e.currentTarget as HTMLElement;
                              setDetailEvent(ev);
                            }}
                            className="w-full text-left px-1 py-0.5 rounded text-[10px] leading-tight truncate font-medium transition-opacity hover:opacity-80"
                            style={{
                              backgroundColor: (cal?.color ?? "#64748b") + "33",
                              color: cal?.color ?? "#94a3b8",
                              borderLeft: `2px solid ${cal?.color ?? "#64748b"}`,
                            }}
                          >
                            {ev.all_day ? "" : `${formatTime(ev.start_at)} `}
                            {ev.title}
                          </button>
                        );
                      })}
                      {dayEvents.length > 3 && (
                        <span className="text-[10px] text-white/30 pl-1">
                          +{dayEvents.length - 3} autre{dayEvents.length - 3 > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Week view */}
        {view === "week" && (
          <TimeGridView
            days={weekDays}
            visibleEvents={visibleEvents}
            calendarMap={calendarMap}
            today={today}
            onClickSlot={openNewEvent}
            onClickEvent={handleClickEvent}
          />
        )}

        {/* Day view */}
        {view === "day" && (
          <TimeGridView
            days={[viewDate]}
            visibleEvents={visibleEvents}
            calendarMap={calendarMap}
            today={today}
            onClickSlot={openNewEvent}
            onClickEvent={handleClickEvent}
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
