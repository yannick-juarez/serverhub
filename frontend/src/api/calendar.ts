import { apiRequest } from "./http";

export type Calendar = {
  calendar_id: string;
  name: string;
  color: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type CalendarEvent = {
  event_id: string;
  calendar_id: string;
  title: string;
  description: string | null;
  location: string | null;
  location_lat: number | null;
  location_lon: number | null;
  all_day: boolean;
  start_at: string;
  end_at: string;
  created_at: string;
  updated_at: string;
};

type Envelope<T> = { success: boolean; data?: T };

function unwrap<T>(raw: unknown): T {
  const r = raw as Envelope<T>;
  return (r.data ?? raw) as T;
}

// ─── Calendars ────────────────────────────────────────────────────────────────

export async function fetchCalendars(): Promise<Calendar[]> {
  const raw = await apiRequest<Envelope<Calendar[]>>("/calendar/calendars");
  const data = unwrap<Calendar[]>(raw);
  return Array.isArray(data) ? data : [];
}

export async function createCalendar(payload: {
  name: string;
  color: string;
  description?: string;
}): Promise<Calendar> {
  const raw = await apiRequest<Envelope<Calendar>>("/calendar/calendars", {
    method: "POST",
    body: payload,
  });
  return unwrap<Calendar>(raw);
}

export async function updateCalendar(
  calendarId: string,
  patch: Partial<{ name: string; color: string; description: string | null }>,
): Promise<Calendar> {
  const raw = await apiRequest<Envelope<Calendar>>(`/calendar/calendars/${calendarId}`, {
    method: "PATCH",
    body: patch,
  });
  return unwrap<Calendar>(raw);
}

export async function deleteCalendar(calendarId: string): Promise<void> {
  await apiRequest<unknown>(`/calendar/calendars/${calendarId}`, { method: "DELETE" });
}

// ─── Events ───────────────────────────────────────────────────────────────────

export async function fetchEvents(): Promise<CalendarEvent[]> {
  const raw = await apiRequest<Envelope<CalendarEvent[]>>("/calendar/events");
  const data = unwrap<CalendarEvent[]>(raw);
  return Array.isArray(data) ? data : [];
}

export async function createEvent(payload: {
  calendar_id: string;
  title: string;
  description?: string;
  location?: string;
  location_lat?: number | null;
  location_lon?: number | null;
  all_day: boolean;
  start_at: string;
  end_at: string;
}): Promise<CalendarEvent> {
  const raw = await apiRequest<Envelope<CalendarEvent>>("/calendar/events", {
    method: "POST",
    body: payload,
  });
  return unwrap<CalendarEvent>(raw);
}

export async function updateEvent(
  eventId: string,
  patch: Partial<{
    calendar_id: string;
    title: string;
    description: string | null;
    location: string | null;
    location_lat: number | null;
    location_lon: number | null;
    all_day: boolean;
    start_at: string;
    end_at: string;
  }>,
): Promise<CalendarEvent> {
  const raw = await apiRequest<Envelope<CalendarEvent>>(`/calendar/events/${eventId}`, {
    method: "PATCH",
    body: patch,
  });
  return unwrap<CalendarEvent>(raw);
}

export async function deleteEvent(eventId: string): Promise<void> {
  await apiRequest<unknown>(`/calendar/events/${eventId}`, { method: "DELETE" });
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'failed';
export type TaskType = 'fixed' | 'dynamic';

export type Task = {
  task_id: string;
  calendar_id: string | null;
  title: string;
  notes: string | null;
  location: string | null;
  location_lat: number | null;
  location_lon: number | null;
  type: TaskType;
  status: TaskStatus;
  // Fixed
  start_at: string | null;
  end_at: string | null;
  all_day: boolean;
  // Dynamic
  duration_minutes: number | null;
  deadline: string | null;
  mask_id: string | null;
  dependencies: string[];
  priority: number;
  created_at: string;
  updated_at: string;
};

export type GhostPlacement = {
  task_id: string;
  suggested_start: string;
  suggested_end: string;
};

export async function fetchTasks(): Promise<Task[]> {
  const raw = await apiRequest<Envelope<Task[]>>("/calendar/tasks");
  const data = unwrap<Task[]>(raw);
  return Array.isArray(data) ? data : [];
}

export async function fetchGhostPlacements(): Promise<GhostPlacement[]> {
  const raw = await apiRequest<Envelope<GhostPlacement[]>>("/calendar/tasks/ghost-placements");
  const data = unwrap<GhostPlacement[]>(raw);
  return Array.isArray(data) ? data : [];
}

export async function createTask(payload: Omit<Task, 'task_id' | 'created_at' | 'updated_at'>): Promise<Task> {
  const raw = await apiRequest<Envelope<Task>>("/calendar/tasks", { method: "POST", body: payload });
  return unwrap<Task>(raw);
}

export async function updateTask(taskId: string, patch: Partial<Omit<Task, 'task_id' | 'created_at' | 'updated_at'>>): Promise<Task> {
  const raw = await apiRequest<Envelope<Task>>(`/calendar/tasks/${taskId}`, { method: "PATCH", body: patch });
  return unwrap<Task>(raw);
}

export async function deleteTask(taskId: string): Promise<void> {
  await apiRequest<unknown>(`/calendar/tasks/${taskId}`, { method: "DELETE" });
}

// ─── Masks ────────────────────────────────────────────────────────────────────

export type MaskSlot = { day: number; start: string; end: string };
export type MaskOperation = { op: 'add' | 'subtract'; mask_id: string };

export type Mask = {
  mask_id: string;
  name: string;
  type: 'native' | 'custom';
  slots: MaskSlot[];
  operations: MaskOperation[];
  created_at: string;
  updated_at: string;
};

export async function fetchMasks(): Promise<Mask[]> {
  const raw = await apiRequest<Envelope<Mask[]>>("/calendar/masks");
  const data = unwrap<Mask[]>(raw);
  return Array.isArray(data) ? data : [];
}

export async function createMask(payload: Omit<Mask, 'mask_id' | 'created_at' | 'updated_at'>): Promise<Mask> {
  const raw = await apiRequest<Envelope<Mask>>("/calendar/masks", { method: "POST", body: payload });
  return unwrap<Mask>(raw);
}

export async function updateMask(maskId: string, patch: Partial<Omit<Mask, 'mask_id' | 'created_at' | 'updated_at'>>): Promise<Mask> {
  const raw = await apiRequest<Envelope<Mask>>(`/calendar/masks/${maskId}`, { method: "PATCH", body: patch });
  return unwrap<Mask>(raw);
}

export async function deleteMask(maskId: string): Promise<void> {
  await apiRequest<unknown>(`/calendar/masks/${maskId}`, { method: "DELETE" });
}

// ─── Geocode ──────────────────────────────────────────────────────────────────

export type GeocodeResult = {
  display_name: string;
  lat: number;
  lon: number;
  type: string;
};

export async function geocodeLocation(q: string): Promise<GeocodeResult[]> {
  const raw = await apiRequest<Envelope<GeocodeResult[]>>(`/calendar/geocode?q=${encodeURIComponent(q)}`);
  const data = unwrap<GeocodeResult[]>(raw);
  return Array.isArray(data) ? data : [];
}
