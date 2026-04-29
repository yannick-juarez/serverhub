import type { Request, Response } from 'express';
import {
  createCalendar,
  createEvent,
  deleteCalendar,
  deleteEvent,
  listCalendars,
  listEvents,
  updateCalendar,
  updateEvent,
} from './calendar.service';

// ─── Calendars ────────────────────────────────────────────────────────────────

export async function handleListCalendars(_req: Request, res: Response): Promise<void> {
  const data = await listCalendars();
  res.json({ success: true, data });
}

export async function handleCreateCalendar(req: Request, res: Response): Promise<void> {
  const { name, color, description } = req.body as {
    name?: string;
    color?: string;
    description?: string;
  };

  if (!name || !color) {
    res.status(400).json({ success: false, error: 'Missing required fields: name, color' });
    return;
  }

  const created = await createCalendar({ name, color, description: description ?? null });
  res.status(201).json({ success: true, data: created });
}

export async function handleUpdateCalendar(req: Request, res: Response): Promise<void> {
  const { calendarId } = req.params;
  const { name, color, description } = req.body as {
    name?: string;
    color?: string;
    description?: string | null;
  };

  const updated = await updateCalendar(calendarId, { name, color, description });
  res.json({ success: true, data: updated });
}

export async function handleDeleteCalendar(req: Request, res: Response): Promise<void> {
  const { calendarId } = req.params;
  await deleteCalendar(calendarId);
  res.json({ success: true, message: 'Calendar deleted' });
}

// ─── Events ───────────────────────────────────────────────────────────────────

export async function handleListEvents(_req: Request, res: Response): Promise<void> {
  const data = await listEvents();
  res.json({ success: true, data });
}

export async function handleCreateEvent(req: Request, res: Response): Promise<void> {
  const { calendar_id, title, description, location, all_day, start_at, end_at } = req.body as {
    calendar_id?: string;
    title?: string;
    description?: string;
    location?: string;
    all_day?: boolean;
    start_at?: string;
    end_at?: string;
  };

  if (!calendar_id || !title || !start_at || !end_at) {
    res.status(400).json({ success: false, error: 'Missing required fields: calendar_id, title, start_at, end_at' });
    return;
  }

  const created = await createEvent({
    calendar_id,
    title,
    description: description ?? null,
    location: location ?? null,
    all_day: all_day ?? false,
    start_at,
    end_at,
  });

  res.status(201).json({ success: true, data: created });
}

export async function handleUpdateEvent(req: Request, res: Response): Promise<void> {
  const { eventId } = req.params;
  const { calendar_id, title, description, location, all_day, start_at, end_at } = req.body as {
    calendar_id?: string;
    title?: string;
    description?: string | null;
    location?: string | null;
    all_day?: boolean;
    start_at?: string;
    end_at?: string;
  };

  const updated = await updateEvent(eventId, { calendar_id, title, description, location, all_day, start_at, end_at });
  res.json({ success: true, data: updated });
}

export async function handleDeleteEvent(req: Request, res: Response): Promise<void> {
  const { eventId } = req.params;
  await deleteEvent(eventId);
  res.json({ success: true, message: 'Event deleted' });
}
