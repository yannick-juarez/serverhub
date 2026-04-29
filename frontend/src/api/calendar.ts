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
