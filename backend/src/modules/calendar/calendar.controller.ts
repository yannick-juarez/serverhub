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

// ─── Tasks ────────────────────────────────────────────────────────────────────

export async function handleListTasks(_req: Request, res: Response): Promise<void> {
  const data = await listTasks();
  res.json({ success: true, data });
}

export async function handleCreateTask(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, unknown>;
  const { title, type } = body;

  if (!title || !type) {
    res.status(400).json({ success: false, error: 'Missing required fields: title, type' });
    return;
  }

  const created = await createTask({
    calendar_id: (body.calendar_id as string) ?? null,
    title: title as string,
    notes: (body.notes as string) ?? null,
    location: (body.location as string) ?? null,
    type: type as 'fixed' | 'dynamic',
    status: (body.status as 'todo' | 'in_progress' | 'done' | 'failed') ?? 'todo',
    start_at: (body.start_at as string) ?? null,
    end_at: (body.end_at as string) ?? null,
    all_day: (body.all_day as boolean) ?? false,
    duration_minutes: (body.duration_minutes as number) ?? null,
    deadline: (body.deadline as string) ?? null,
    mask_id: (body.mask_id as string) ?? null,
    dependencies: (body.dependencies as string[]) ?? [],
    priority: (body.priority as number) ?? 0,
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

export async function handleGetGhostPlacements(_req: Request, res: Response): Promise<void> {
  const data = await computeGhostPlacements();
  res.json({ success: true, data });
}

// ─── Masks ────────────────────────────────────────────────────────────────────

export async function handleListMasks(_req: Request, res: Response): Promise<void> {
  const data = await listMasks();
  res.json({ success: true, data });
}

export async function handleCreateMask(req: Request, res: Response): Promise<void> {
  const { name, type, slots, operations } = req.body as Record<string, unknown>;
  if (!name || !type) {
    res.status(400).json({ success: false, error: 'Missing required fields: name, type' });
    return;
  }
  const created = await createMask({
    name: name as string,
    type: type as 'native' | 'custom',
    slots: (slots as Parameters<typeof createMask>[0]['slots']) ?? [],
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
