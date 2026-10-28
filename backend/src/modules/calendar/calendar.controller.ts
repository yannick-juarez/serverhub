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
  listTasks,
  createTask,
  updateTask,
  deleteTask,
  listMasks,
  createMask,
  updateMask,
  deleteMask,
  computeGhostPlacements,
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
  const { calendar_id, color, title, description, location, location_lat, location_lon, all_day, allows_overlap, start_at, end_at, recurrence_days, recurrence_start, recurrence_end, recurrence_timezone } = req.body as {
    calendar_id?: string;
    color?: string | null;
    title?: string;
    description?: string;
    location?: string;
    location_lat?: number;
    location_lon?: number;
    all_day?: boolean;
    allows_overlap?: boolean;
    start_at?: string;
    end_at?: string;
    recurrence_days?: number[];
    recurrence_start?: string | null;
    recurrence_end?: string | null;
    recurrence_timezone?: string | null;
  };

  if (!calendar_id || !title || !start_at || !end_at) {
    res.status(400).json({ success: false, error: 'Missing required fields: calendar_id, title, start_at, end_at' });
    return;
  }

  const created = await createEvent({
    calendar_id,
    color: color ?? null,
    title,
    description: description ?? null,
    location: location ?? null,
    location_lat: location_lat ?? null,
    location_lon: location_lon ?? null,
    all_day: all_day ?? false,
    allows_overlap: allows_overlap ?? false,
    start_at,
    end_at,
    recurrence_days: Array.isArray(recurrence_days)
      ? recurrence_days.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
      : [],
    recurrence_start: recurrence_start ?? null,
    recurrence_end: recurrence_end ?? null,
    recurrence_timezone: recurrence_timezone ?? null,
  });

  res.status(201).json({ success: true, data: created });
}

export async function handleUpdateEvent(req: Request, res: Response): Promise<void> {
  const { eventId } = req.params;
  const { calendar_id, color, title, description, location, location_lat, location_lon, all_day, allows_overlap, start_at, end_at } = req.body as {
    calendar_id?: string;
    color?: string | null;
    title?: string;
    description?: string | null;
    location?: string | null;
    location_lat?: number | null;
    location_lon?: number | null;
    all_day?: boolean;
    allows_overlap?: boolean;
    start_at?: string;
    end_at?: string;
  };

  const { recurrence_days, recurrence_start, recurrence_end, recurrence_timezone } = req.body as {
    recurrence_days?: number[];
    recurrence_start?: string | null;
    recurrence_end?: string | null;
    recurrence_timezone?: string | null;
  };
  const updated = await updateEvent(eventId, {
    calendar_id, color, title, description, location, location_lat, location_lon, all_day, allows_overlap, start_at, end_at,
    recurrence_days, recurrence_start, recurrence_end, recurrence_timezone,
  });
  res.json({ success: true, data: updated });
}

export async function handleDeleteEvent(req: Request, res: Response): Promise<void> {
  const { eventId } = req.params;
  await deleteEvent(eventId);
  res.json({ success: true, message: 'Event deleted' });
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export async function handleListTasks(_req: Request, res: Response): Promise<void> {
  const data = await listTasks();
  res.json({ success: true, data });
}

export async function handleCreateTask(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, unknown>;
  const { title } = body;

  if (!title) {
    res.status(400).json({ success: false, error: 'Missing required field: title' });
    return;
  }

  const created = await createTask({
    calendar_id: (body.calendar_id as string) ?? null,
    color: (body.color as string) ?? null,
    title: title as string,
    notes: (body.notes as string) ?? null,
    location: (body.location as string) ?? null,
    location_lat: (body.location_lat as number) ?? null,
    location_lon: (body.location_lon as number) ?? null,
    type: 'dynamic',
    status: (body.status as 'todo' | 'in_progress' | 'done' | 'failed') ?? 'todo',
    started_at: null,
    completed_at: null,
    start_at: (body.start_at as string) ?? null,
    end_at: (body.end_at as string) ?? null,
    all_day: (body.all_day as boolean) ?? false,
    allows_overlap: (body.allows_overlap as boolean) ?? false,
    duration_minutes: (body.duration_minutes as number) ?? null,
    deadline: (body.deadline as string) ?? null,
    deadline_event_id: (body.deadline_event_id as string) ?? null,
    mask_id: (body.mask_id as string) ?? null,
    dependencies: (body.dependencies as string[]) ?? [],
    dependency_event_ids: (body.dependency_event_ids as string[]) ?? [],
    priority: (body.priority as number) ?? 0,
    target_count: typeof body.target_count === 'number' && body.target_count > 0
      ? Math.floor(body.target_count)
      : null,
    current_count: typeof body.target_count === 'number' && body.target_count > 0
      ? Math.max(0, Math.min(Math.floor(body.current_count as number) || 0, Math.floor(body.target_count)))
      : null,
    recurrence_days: Array.isArray(body.recurrence_days)
      ? (body.recurrence_days as number[]).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
      : [],
    recurrence_time: (body.recurrence_time as string) ?? null,
    recurrence_start: (body.recurrence_start as string) ?? null,
    recurrence_end: (body.recurrence_end as string) ?? null,
    recurrence_timezone: (body.recurrence_timezone as string) ?? null,
  });

  res.status(201).json({ success: true, data: created });
}

export async function handleUpdateTask(req: Request, res: Response): Promise<void> {
  const { taskId } = req.params;
  const updated = await updateTask(taskId, req.body as Parameters<typeof updateTask>[1]);
  res.json({ success: true, data: updated });
}

export async function handleDeleteTask(req: Request, res: Response): Promise<void> {
  const { taskId } = req.params;
  await deleteTask(taskId);
  res.json({ success: true, message: 'Task deleted' });
}

export async function handleGetGhostPlacements(req: Request, res: Response): Promise<void> {
  const timezone = typeof req.query.timezone === 'string' ? req.query.timezone : 'UTC';
  const data = await computeGhostPlacements(timezone);
  res.json({ success: true, data });
}

// ─── Masks ────────────────────────────────────────────────────────────────────

export async function handleListMasks(_req: Request, res: Response): Promise<void> {
  const data = await listMasks();
  res.json({ success: true, data });
}

export async function handleCreateMask(req: Request, res: Response): Promise<void> {
  const { name, type, slots, date_ranges, operations } = req.body as Record<string, unknown>;
  if (!name || !type) {
    res.status(400).json({ success: false, error: 'Missing required fields: name, type' });
    return;
  }
  const created = await createMask({
    name: name as string,
    type: type as 'native' | 'custom',
    slots: (slots as Parameters<typeof createMask>[0]['slots']) ?? [],
    date_ranges: (date_ranges as Parameters<typeof createMask>[0]['date_ranges']) ?? [],
    operations: (operations as Parameters<typeof createMask>[0]['operations']) ?? [],
  });
  res.status(201).json({ success: true, data: created });
}

export async function handleUpdateMask(req: Request, res: Response): Promise<void> {
  const { maskId } = req.params;
  const updated = await updateMask(maskId, req.body as Parameters<typeof updateMask>[1]);
  res.json({ success: true, data: updated });
}

export async function handleDeleteMask(req: Request, res: Response): Promise<void> {
  const { maskId } = req.params;
  await deleteMask(maskId);
  res.json({ success: true, message: 'Mask deleted' });
}

// ─── Geocode (Nominatim proxy) ────────────────────────────────────────────────

export async function handleGeocode(req: Request, res: Response): Promise<void> {
  const q = req.query.q as string | undefined;
  if (!q || !q.trim()) {
    res.status(400).json({ success: false, error: 'Missing query parameter: q' });
    return;
  }

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q.trim())}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'ServerHub/1.0 (self-hosted calendar app)',
      'Accept-Language': 'fr,en',
    },
  });

  if (!response.ok) {
    res.status(502).json({ success: false, error: 'Nominatim request failed' });
    return;
  }

  type NominatimResult = { lat: string; lon: string; display_name: string; type: string; importance: number };
  const raw = await response.json() as NominatimResult[];
  const data = raw.map((r) => ({
    display_name: r.display_name,
    lat: parseFloat(r.lat),
    lon: parseFloat(r.lon),
    type: r.type,
  }));

  res.json({ success: true, data });
}
