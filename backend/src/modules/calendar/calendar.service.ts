import { randomUUID } from 'crypto';
import {
  readStorage,
  updateStorage,
  type StoredCalendar,
  type StoredCalendarEvent,
  type StoredTask,
  type StoredMask,
  type MaskSlot,
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
      ...current.calendar,
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

// ─── Tasks ────────────────────────────────────────────────────────────────────

export async function listTasks(): Promise<StoredTask[]> {
  const storage = await readStorage();
  return storage.calendar.tasks ?? [];
}

export async function createTask(
  payload: Omit<StoredTask, 'task_id' | 'created_at' | 'updated_at'>,
): Promise<StoredTask> {
  const now = new Date().toISOString();
  const created: StoredTask = {
    task_id: randomUUID(),
    created_at: now,
    updated_at: now,
    ...payload,
  };

  await updateStorage((current) => ({
    ...current,
    calendar: {
      ...current.calendar,
      tasks: [...(current.calendar.tasks ?? []), created],
    },
  }));

  return created;
}

export async function updateTask(
  taskId: string,
  patch: Partial<Omit<StoredTask, 'task_id' | 'created_at' | 'updated_at'>>,
): Promise<StoredTask> {
  let updated: StoredTask | null = null;

  await updateStorage((current) => {
    const tasks = (current.calendar.tasks ?? []).map((t) => {
      if (t.task_id !== taskId) return t;
      updated = { ...t, ...patch, updated_at: new Date().toISOString() };
      return updated;
    });
    return { ...current, calendar: { ...current.calendar, tasks } };
  });

  if (!updated) throw new Error('Task not found');
  return updated;
}

export async function deleteTask(taskId: string): Promise<void> {
  await updateStorage((current) => ({
    ...current,
    calendar: {
      ...current.calendar,
      tasks: (current.calendar.tasks ?? []).filter((t) => t.task_id !== taskId),
    },
  }));
}

// ─── Masks ────────────────────────────────────────────────────────────────────

export async function listMasks(): Promise<StoredMask[]> {
  const storage = await readStorage();
  return storage.calendar.masks ?? [];
}

export async function createMask(
  payload: Omit<StoredMask, 'mask_id' | 'created_at' | 'updated_at'>,
): Promise<StoredMask> {
  const now = new Date().toISOString();
  const created: StoredMask = {
    mask_id: randomUUID(),
    created_at: now,
    updated_at: now,
    ...payload,
  };

  await updateStorage((current) => ({
    ...current,
    calendar: {
      ...current.calendar,
      masks: [...(current.calendar.masks ?? []), created],
    },
  }));

  return created;
}

export async function updateMask(
  maskId: string,
  patch: Partial<Omit<StoredMask, 'mask_id' | 'created_at' | 'updated_at'>>,
): Promise<StoredMask> {
  let updated: StoredMask | null = null;

  await updateStorage((current) => {
    const masks = (current.calendar.masks ?? []).map((m) => {
      if (m.mask_id !== maskId) return m;
      updated = { ...m, ...patch, updated_at: new Date().toISOString() };
      return updated;
    });
    return { ...current, calendar: { ...current.calendar, masks } };
  });

  if (!updated) throw new Error('Mask not found');
  return updated;
}

export async function deleteMask(maskId: string): Promise<void> {
  await updateStorage((current) => ({
    ...current,
    calendar: {
      ...current.calendar,
      masks: (current.calendar.masks ?? []).filter((m) => m.mask_id !== maskId),
    },
  }));
}

// ─── Scheduling Engine ────────────────────────────────────────────────────────

/**
 * Resolves a mask to its effective time slots by applying set operations.
 * Returns a flat list of {day, start, end} slots.
 */
function resolveMaskSlots(maskId: string, allMasks: StoredMask[], depth = 0): MaskSlot[] {
  if (depth > 8) return []; // cycle guard
  const mask = allMasks.find((m) => m.mask_id === maskId);
  if (!mask) return [];

  let slots = [...mask.slots];

  for (const op of mask.operations) {
    const opSlots = resolveMaskSlots(op.mask_id, allMasks, depth + 1);
    if (op.op === 'add') {
      slots = mergeSlots([...slots, ...opSlots]);
    } else {
      slots = subtractSlots(slots, opSlots);
    }
  }

  return slots;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60) % 24;
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function mergeSlots(slots: MaskSlot[]): MaskSlot[] {
  const byDay = new Map<number, { start: number; end: number }[]>();
  for (const s of slots) {
    if (!byDay.has(s.day)) byDay.set(s.day, []);
    byDay.get(s.day)!.push({ start: timeToMinutes(s.start), end: timeToMinutes(s.end) });
  }

  const result: MaskSlot[] = [];
  for (const [day, intervals] of byDay) {
    intervals.sort((a, b) => a.start - b.start);
    const merged: { start: number; end: number }[] = [];
    for (const iv of intervals) {
      if (merged.length && iv.start <= merged[merged.length - 1].end) {
        merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, iv.end);
      } else {
        merged.push({ ...iv });
      }
    }
    for (const iv of merged) {
      result.push({ day, start: minutesToTime(iv.start), end: minutesToTime(iv.end) });
    }
  }
  return result;
}

function subtractSlots(base: MaskSlot[], subtract: MaskSlot[]): MaskSlot[] {
  const result: MaskSlot[] = [];
  for (const b of base) {
    let segments: { start: number; end: number }[] = [{ start: timeToMinutes(b.start), end: timeToMinutes(b.end) }];
    for (const s of subtract) {
      if (s.day !== b.day) continue;
      const sStart = timeToMinutes(s.start);
      const sEnd = timeToMinutes(s.end);
      const next: { start: number; end: number }[] = [];
      for (const seg of segments) {
        if (sEnd <= seg.start || sStart >= seg.end) {
          next.push(seg);
        } else {
          if (sStart > seg.start) next.push({ start: seg.start, end: sStart });
          if (sEnd < seg.end) next.push({ start: sEnd, end: seg.end });
        }
      }
      segments = next;
    }
    for (const seg of segments) {
      result.push({ day: b.day, start: minutesToTime(seg.start), end: minutesToTime(seg.end) });
    }
  }
  return result;
}

export type GhostPlacement = {
  task_id: string;
  suggested_start: string; // ISO
  suggested_end: string;   // ISO
};

/**
 * Compute ghost placements for all unlocked dynamic tasks.
 * A task is "unlocked" when all its dependencies are 'done'.
 * Scheduling is greedy: finds the first available slot from now within the mask.
 */
export async function computeGhostPlacements(): Promise<GhostPlacement[]> {
  const storage = await readStorage();
  const tasks = storage.calendar.tasks ?? [];
  const masks = storage.calendar.masks ?? [];

  const doneTasks = new Set(tasks.filter((t) => t.status === 'done').map((t) => t.task_id));

  const unlockedDynamic = tasks.filter(
    (t) =>
      t.type === 'dynamic' &&
      t.status === 'todo' &&
      t.duration_minutes != null &&
      t.dependencies.every((dep) => doneTasks.has(dep)),
  );

  // Sort by priority desc, then deadline asc
  unlockedDynamic.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return 0;
  });

  const now = new Date();
  // Track occupied slots to avoid overlaps between ghost placements
  const occupied: { start: Date; end: Date }[] = [];

  // Also account for existing fixed events
  for (const ev of storage.calendar.events) {
    occupied.push({ start: new Date(ev.start_at), end: new Date(ev.end_at) });
  }
  // Fixed tasks
  for (const t of tasks) {
    if (t.type === 'fixed' && t.start_at && t.end_at) {
      occupied.push({ start: new Date(t.start_at), end: new Date(t.end_at) });
    }
  }

  const placements: GhostPlacement[] = [];

  for (const task of unlockedDynamic) {
    const durationMs = (task.duration_minutes ?? 30) * 60 * 1000;
    const deadlineDate = task.deadline ? new Date(task.deadline) : null;

    const maskSlots = task.mask_id
      ? resolveMaskSlots(task.mask_id, masks)
      : null; // no mask = any time

    // Search up to 4 weeks ahead
    const searchEnd = new Date(now.getTime() + 28 * 24 * 3600 * 1000);
    let found: GhostPlacement | null = null;

    // Iterate day by day, slot by slot
    const cursor = new Date(now);
    cursor.setSeconds(0, 0);
    // Round up to next 30-min
    const mins = cursor.getMinutes();
    if (mins > 0 && mins <= 30) cursor.setMinutes(30);
    else if (mins > 30) { cursor.setMinutes(0); cursor.setHours(cursor.getHours() + 1); }

    while (cursor < searchEnd && !found) {
      const dayOfWeek = cursor.getDay();

      if (maskSlots) {
        const daySlots = maskSlots.filter((s) => s.day === dayOfWeek);
        for (const slot of daySlots) {
          // Build absolute window for this slot on this day
          const slotStart = new Date(cursor);
          const [sh, sm] = slot.start.split(':').map(Number);
          const [eh, em] = slot.end.split(':').map(Number);
          slotStart.setHours(sh, sm, 0, 0);
          const slotEnd = new Date(cursor);
          slotEnd.setHours(eh, em, 0, 0);

          // Try fitting from max(cursor, slotStart)
          let tryStart = new Date(Math.max(cursor.getTime(), slotStart.getTime()));
          while (tryStart.getTime() + durationMs <= slotEnd.getTime()) {
            const tryEnd = new Date(tryStart.getTime() + durationMs);
            if (deadlineDate && tryEnd > deadlineDate) break;

            const conflict = occupied.some(
              (o) => tryStart < o.end && tryEnd > o.start,
            );

            if (!conflict) {
              found = {
                task_id: task.task_id,
                suggested_start: tryStart.toISOString(),
                suggested_end: tryEnd.toISOString(),
              };
              occupied.push({ start: tryStart, end: tryEnd });
              break;
            }
            // Advance past the conflicting slot
            const blocker = occupied.find((o) => tryStart < o.end && tryEnd > o.start);
            if (blocker) tryStart = new Date(blocker.end);
            else tryStart = new Date(tryStart.getTime() + 30 * 60 * 1000);
          }
          if (found) break;
        }
      } else {
        // No mask: try from cursor in 30-min steps (08:00-22:00 window)
        const windowStart = new Date(cursor);
        if (windowStart.getHours() < 8) windowStart.setHours(8, 0, 0, 0);
        const windowEnd = new Date(cursor);
        windowEnd.setHours(22, 0, 0, 0);

        let tryStart = new Date(Math.max(cursor.getTime(), windowStart.getTime()));
        while (tryStart.getTime() + durationMs <= windowEnd.getTime()) {
          const tryEnd = new Date(tryStart.getTime() + durationMs);
          if (deadlineDate && tryEnd > deadlineDate) break;

          const conflict = occupied.some((o) => tryStart < o.end && tryEnd > o.start);
          if (!conflict) {
            found = {
              task_id: task.task_id,
              suggested_start: tryStart.toISOString(),
              suggested_end: tryEnd.toISOString(),
            };
            occupied.push({ start: tryStart, end: tryEnd });
            break;
          }
          const blocker = occupied.find((o) => tryStart < o.end && tryEnd > o.start);
          if (blocker) tryStart = new Date(blocker.end);
          else tryStart = new Date(tryStart.getTime() + 30 * 60 * 1000);
        }
      }

      if (found) break;
      // Advance to next day 00:00
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(0, 0, 0, 0);
    }

    if (found) placements.push(found);
  }

  return placements;
}
