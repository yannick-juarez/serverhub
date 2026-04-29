import { randomUUID } from 'crypto';
import {
  readStorage,
  updateStorage,
  type StoredCalendar,
  type StoredCalendarEvent,
} from '../storage/storage.service';

// ─── Calendars ────────────────────────────────────────────────────────────────

export async function listCalendars(): Promise<StoredCalendar[]> {
  const storage = await readStorage();
  return storage.calendar.calendars;
}

export async function createCalendar(
  payload: Omit<StoredCalendar, 'calendar_id' | 'created_at' | 'updated_at'>,
): Promise<StoredCalendar> {
  const now = new Date().toISOString();
  const created: StoredCalendar = {
    calendar_id: randomUUID(),
    created_at: now,
    updated_at: now,
    ...payload,
  };

  await updateStorage((current) => ({
    ...current,
    calendar: {
      ...current.calendar,
      calendars: [...current.calendar.calendars, created],
    },
  }));

  return created;
}

export async function updateCalendar(
  calendarId: string,
  patch: Partial<Omit<StoredCalendar, 'calendar_id' | 'created_at' | 'updated_at'>>,
): Promise<StoredCalendar> {
  let updated: StoredCalendar | null = null;

  await updateStorage((current) => {
    const calendars = current.calendar.calendars.map((cal) => {
      if (cal.calendar_id !== calendarId) return cal;
      updated = { ...cal, ...patch, updated_at: new Date().toISOString() };
      return updated;
    });

    return { ...current, calendar: { ...current.calendar, calendars } };
  });

  if (!updated) throw new Error('Calendar not found');
  return updated;
}

export async function deleteCalendar(calendarId: string): Promise<void> {
  await updateStorage((current) => ({
    ...current,
    calendar: {
      calendars: current.calendar.calendars.filter((c) => c.calendar_id !== calendarId),
      events: current.calendar.events.filter((e) => e.calendar_id !== calendarId),
    },
  }));
}

// ─── Events ───────────────────────────────────────────────────────────────────

export async function listEvents(): Promise<StoredCalendarEvent[]> {
  const storage = await readStorage();
  return storage.calendar.events;
}

export async function createEvent(
  payload: Omit<StoredCalendarEvent, 'event_id' | 'created_at' | 'updated_at'>,
): Promise<StoredCalendarEvent> {
  const now = new Date().toISOString();
  const created: StoredCalendarEvent = {
    event_id: randomUUID(),
    created_at: now,
    updated_at: now,
    ...payload,
  };

  await updateStorage((current) => ({
    ...current,
    calendar: {
      ...current.calendar,
      events: [...current.calendar.events, created],
    },
  }));

  return created;
}

export async function updateEvent(
  eventId: string,
  patch: Partial<Omit<StoredCalendarEvent, 'event_id' | 'created_at' | 'updated_at'>>,
): Promise<StoredCalendarEvent> {
  let updated: StoredCalendarEvent | null = null;

  await updateStorage((current) => {
    const events = current.calendar.events.map((ev) => {
      if (ev.event_id !== eventId) return ev;
      updated = { ...ev, ...patch, updated_at: new Date().toISOString() };
      return updated;
    });

    return { ...current, calendar: { ...current.calendar, events } };
  });

  if (!updated) throw new Error('Event not found');
  return updated;
}

export async function deleteEvent(eventId: string): Promise<void> {
  await updateStorage((current) => ({
    ...current,
    calendar: {
      ...current.calendar,
      events: current.calendar.events.filter((e) => e.event_id !== eventId),
    },
  }));
}
