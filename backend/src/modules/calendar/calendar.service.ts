import { randomUUID } from 'crypto';
import {
  readStorage,
  updateStorage,
  type StoredCalendar,
  type StoredCalendarEvent,
  type StoredTask,
  type StoredMask,
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
  const targetCount = payload.target_count != null && payload.target_count > 0
    ? Math.floor(payload.target_count)
    : null;
  const currentCount = targetCount == null
    ? null
    : Math.max(0, Math.min(Math.floor(payload.current_count ?? 0), targetCount));
  const status = targetCount != null && currentCount != null
    ? currentCount >= targetCount ? 'done' : currentCount > 0 ? 'in_progress' : 'todo'
    : payload.status;
  const created: StoredTask = {
    task_id: randomUUID(),
    created_at: now,
    updated_at: now,
    ...payload,
    status,
    target_count: targetCount,
    current_count: currentCount,
    started_at: status === 'in_progress' || status === 'done' ? now : null,
    completed_at: status === 'done' ? now : null,
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
      const now = new Date().toISOString();
      const requestedTarget = patch.target_count === undefined ? t.target_count : patch.target_count;
      const targetCount = requestedTarget != null && requestedTarget > 0 ? Math.floor(requestedTarget) : null;
      const requestedCount = patch.current_count === undefined ? t.current_count : patch.current_count;
      const currentCount = targetCount == null
        ? null
        : Math.max(0, Math.min(Math.floor(requestedCount ?? 0), Math.floor(targetCount)));
      let nextStatus = patch.status ?? t.status;
      if (targetCount != null) {
        if (targetCount != null && currentCount != null && currentCount >= targetCount) nextStatus = 'done';
        else if (currentCount != null && currentCount > 0) nextStatus = 'in_progress';
        else nextStatus = 'todo';
      }
      let executionPatch: Pick<StoredTask, 'started_at' | 'completed_at'> = {
        started_at: t.started_at,
        completed_at: t.completed_at,
      };
      if (nextStatus === 'in_progress' && t.status !== 'in_progress') {
        executionPatch = { started_at: now, completed_at: null };
      } else if (nextStatus === 'done' && t.status !== 'done') {
        executionPatch = { started_at: t.started_at ?? now, completed_at: now };
      } else if (nextStatus === 'todo' && t.status !== 'todo') {
        executionPatch = { started_at: null, completed_at: null };
      } else if (nextStatus === 'failed') {
        executionPatch = { started_at: t.started_at, completed_at: null };
      }
      updated = {
        ...t,
        ...patch,
        status: nextStatus,
        target_count: targetCount,
        current_count: currentCount,
        ...executionPatch,
        updated_at: now,
      };
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

type ResolvedInterval = { start: number; end: number };

function resolveMaskIntervals(
  maskId: string,
  date: string,
  dayOfWeek: number,
  allMasks: StoredMask[],
  depth = 0,
): ResolvedInterval[] {
  if (depth > 8) return []; // cycle guard
  const mask = allMasks.find((m) => m.mask_id === maskId);
  if (!mask) return [];

  let intervals = [
    ...mask.slots
      .filter((slot) => slot.day === dayOfWeek)
      .map((slot) => ({ start: timeToMinutes(slot.start), end: timeToMinutes(slot.end) })),
    ...(mask.date_ranges ?? [])
      .filter((range) => range.start_date <= date && range.end_date >= date)
      .map((range) => ({ start: timeToMinutes(range.start), end: timeToMinutes(range.end) })),
  ];
  intervals = mergeIntervals(intervals);

  for (const op of mask.operations) {
    const opIntervals = resolveMaskIntervals(op.mask_id, date, dayOfWeek, allMasks, depth + 1);
    if (op.op === 'add') {
      intervals = mergeIntervals([...intervals, ...opIntervals]);
    } else {
      intervals = subtractIntervals(intervals, opIntervals);
    }
  }

  return intervals;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  if (minutes === 24 * 60) return '24:00';
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function validTimeZone(timeZone: string): string {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format();
    return timeZone;
  } catch {
    return 'UTC';
  }
}

function zonedParts(date: Date, timeZone: string): Record<string, number> {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  return Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]),
  );
}

function dateInTimeZone(date: Date, timeZone: string): string {
  const parts = zonedParts(date, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function timeInTimeZone(date: Date, timeZone: string): string {
  const parts = zonedParts(date, timeZone);
  return `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
}

function zonedDateTime(date: string, time: string, timeZone: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const targetWallTime = Date.UTC(year, month - 1, day, hour, minute);
  let instant = targetWallTime;

  for (let iteration = 0; iteration < 2; iteration += 1) {
    const parts = zonedParts(new Date(instant), timeZone);
    const representedWallTime = Date.UTC(
      parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second,
    );
    instant += targetWallTime - representedWallTime;
  }

  return new Date(instant);
}

function mergeIntervals(intervals: ResolvedInterval[]): ResolvedInterval[] {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: ResolvedInterval[] = [];
  for (const interval of sorted) {
    if (merged.length && interval.start <= merged[merged.length - 1].end) {
      merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, interval.end);
    } else {
      merged.push({ ...interval });
    }
  }
  return merged;
}

function subtractIntervals(base: ResolvedInterval[], subtract: ResolvedInterval[]): ResolvedInterval[] {
  const result: ResolvedInterval[] = [];
  for (const interval of base) {
    let segments: ResolvedInterval[] = [{ ...interval }];
    for (const subtracted of subtract) {
      const next: { start: number; end: number }[] = [];
      for (const seg of segments) {
        if (subtracted.end <= seg.start || subtracted.start >= seg.end) {
          next.push(seg);
        } else {
          if (subtracted.start > seg.start) next.push({ start: seg.start, end: subtracted.start });
          if (subtracted.end < seg.end) next.push({ start: subtracted.end, end: seg.end });
        }
      }
      segments = next;
    }
    result.push(...segments);
  }
  return result;
}

export type GhostPlacement = {
  task_id: string;
  suggested_start: string; // ISO
  suggested_end: string;   // ISO
};

function remainingTaskDurationMinutes(task: StoredTask): number {
  const unitDuration = task.duration_minutes ?? 30;
  if (task.target_count == null || task.current_count == null) return unitDuration;
  return unitDuration * Math.max(0, task.target_count - task.current_count);
}

/**
 * Compute ghost placements for dynamic tasks in dependency order.
 * Planned prerequisite completion times unlock their dependants during the same pass.
 */
export async function computeGhostPlacements(requestTimeZone = 'UTC'): Promise<GhostPlacement[]> {
  const storage = await readStorage();
  const tasks = storage.calendar.tasks ?? [];
  const events = storage.calendar.events ?? [];
  const masks = storage.calendar.masks ?? [];

  // An event-based dependency is "done" when the event's start time has passed
  const now = new Date();
  const passedEvents = new Set(events.filter((e) => new Date(e.start_at) <= now).map((e) => e.event_id));
  const completionTimes = new Map<string, Date>();
  const activePlacements: Array<{ task: StoredTask; start: Date; end: Date }> = [];
  for (const task of tasks) {
    if (task.status === 'done') completionTimes.set(task.task_id, now);
    else if (task.type === 'fixed' && task.end_at) completionTimes.set(task.task_id, new Date(task.end_at));
    else if (task.type === 'dynamic' && task.status === 'in_progress' && task.duration_minutes != null) {
      const start = new Date(task.started_at ?? task.updated_at);
      const remainingDuration = remainingTaskDurationMinutes(task);
      const end = task.target_count == null
        ? new Date(start.getTime() + remainingDuration * 60 * 1000)
        : new Date(now.getTime() + remainingDuration * 60 * 1000);
      activePlacements.push({ task, start, end });
      completionTimes.set(task.task_id, end);
    }
  }

  const pending = new Map(
    tasks
      .filter((task) => task.type === 'dynamic' && task.status === 'todo' && task.duration_minutes != null)
      .map((task) => [task.task_id, task]),
  );

  // Resolve effective deadline: prefer event-linked deadline
  function effectiveDeadline(t: typeof tasks[number]): string | null {
    if (t.deadline_event_id) {
      const ev = events.find((e) => e.event_id === t.deadline_event_id);
      if (ev) return ev.start_at;
    }
    return t.deadline ?? null;
  }

  function distanceFromLastLocation(
    task: typeof tasks[number],
    lastLocation: { lat: number; lon: number } | null,
  ): number {
    if (!lastLocation || task.location_lat == null || task.location_lon == null) return Number.POSITIVE_INFINITY;
    const toRadians = (degrees: number) => degrees * Math.PI / 180;
    const latitudeDelta = toRadians(task.location_lat - lastLocation.lat);
    const longitudeDelta = toRadians(task.location_lon - lastLocation.lon);
    const startLatitude = toRadians(lastLocation.lat);
    const endLatitude = toRadians(task.location_lat);
    const haversine = Math.sin(latitudeDelta / 2) ** 2
      + Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  }

  let lastLocation: { lat: number; lon: number } | null = null;

  function compareTasks(a: typeof tasks[number], b: typeof tasks[number]): number {
    if (b.priority !== a.priority) return b.priority - a.priority;
    const da = effectiveDeadline(a);
    const db = effectiveDeadline(b);
    if (da && db) return da.localeCompare(db);
    if (da) return -1;
    if (db) return 1;
    const distanceDelta = distanceFromLastLocation(a, lastLocation) - distanceFromLastLocation(b, lastLocation);
    if (Number.isFinite(distanceDelta) && distanceDelta !== 0) return distanceDelta;
    if (a.created_at !== b.created_at) return a.created_at.localeCompare(b.created_at);
    return 0;
  }

  // Track occupied slots to avoid overlaps between ghost placements
  const occupied: { start: Date; end: Date }[] = [];

  // Also account for existing fixed and recurring events
  for (const ev of events) {
    if (ev.allows_overlap) continue;
    if (ev.recurrence_days.length > 0 && ev.recurrence_start && ev.recurrence_end) {
      const timeZone = validTimeZone(ev.recurrence_timezone || requestTimeZone);
      const horizonEnd = dateInTimeZone(new Date(now.getTime() + 28 * 24 * 3600 * 1000), timeZone);
      const today = dateInTimeZone(now, timeZone);
      const rangeStart = ev.recurrence_start > today ? ev.recurrence_start : today;
      const rangeEnd = ev.recurrence_end < horizonEnd ? ev.recurrence_end : horizonEnd;
      const durationMs = new Date(ev.end_at).getTime() - new Date(ev.start_at).getTime();
      const recurrenceTime = ev.all_day ? '00:00' : timeInTimeZone(new Date(ev.start_at), timeZone);
      const cursor = new Date(`${rangeStart}T00:00:00Z`);

      while (cursor.toISOString().slice(0, 10) <= rangeEnd) {
        const date = cursor.toISOString().slice(0, 10);
        if (ev.recurrence_days.includes(cursor.getUTCDay())) {
          const start = zonedDateTime(date, recurrenceTime, timeZone);
          const end = ev.all_day
            ? zonedDateTime(date, '23:59', timeZone)
            : new Date(start.getTime() + durationMs);
          occupied.push({ start, end });
        }
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
    } else {
      occupied.push({ start: new Date(ev.start_at), end: new Date(ev.end_at) });
    }
  }
  // Fixed tasks
  for (const t of tasks) {
    if (t.type === 'fixed' && !t.allows_overlap && t.start_at && t.end_at) {
      occupied.push({ start: new Date(t.start_at), end: new Date(t.end_at) });
    }
  }

  for (const active of activePlacements) {
    if (!active.task.allows_overlap) occupied.push({ start: active.start, end: active.end });
  }

  const placements: GhostPlacement[] = activePlacements.map(({ task, start, end }) => ({
    task_id: task.task_id,
    suggested_start: start.toISOString(),
    suggested_end: end.toISOString(),
  }));

  while (pending.size > 0) {
    const available = [...pending.values()]
      .filter((task) => task.dependencies.every((dependencyId) => completionTimes.has(dependencyId)))
      .filter((task) => (task.dependency_event_ids ?? []).every(
        (eventId) => passedEvents.has(eventId) || events.some((event) => event.event_id === eventId),
      ))
      .sort(compareTasks);

    if (available.length === 0) break;

    const task = available[0];
    pending.delete(task.task_id);
    const dependencyTimes = task.dependencies
      .map((dependencyId) => completionTimes.get(dependencyId)?.getTime() ?? now.getTime());
    const eventDependencyTimes = (task.dependency_event_ids ?? []).map((eventId) => {
      if (passedEvents.has(eventId)) return now.getTime();
      const event = events.find((candidate) => candidate.event_id === eventId);
      return event ? new Date(event.start_at).getTime() : now.getTime();
    });
    const taskReadyAt = new Date(Math.max(now.getTime(), ...dependencyTimes, ...eventDependencyTimes));
    const placementStartIndex = placements.length;
    const durationMinutes = remainingTaskDurationMinutes(task);
    const durationMs = durationMinutes * 60 * 1000;
    const deadlineDate = effectiveDeadline(task) ? new Date(effectiveDeadline(task)!) : null;

    if (task.recurrence_days.length > 0 && task.recurrence_time) {
      const [hours, minutes] = task.recurrence_time.split(':').map(Number);
      const timeZone = validTimeZone(task.recurrence_timezone || requestTimeZone);
      const today = dateInTimeZone(taskReadyAt, timeZone);
      const rangeStart = task.recurrence_start && task.recurrence_start > today ? task.recurrence_start : today;
      const cursor = new Date(`${rangeStart}T00:00:00Z`);
      const defaultRangeEnd = new Date(cursor);
      defaultRangeEnd.setUTCDate(defaultRangeEnd.getUTCDate() + 28);
      const rangeEnd = task.recurrence_end ?? defaultRangeEnd.toISOString().slice(0, 10);

      while (cursor.toISOString().slice(0, 10) <= rangeEnd) {
        const cursorDate = cursor.toISOString().slice(0, 10);
        const dayOfWeek = cursor.getUTCDay();
        if (task.recurrence_days.includes(dayOfWeek)) {
          const tryStart = zonedDateTime(cursorDate, task.recurrence_time, timeZone);
          const tryEnd = new Date(tryStart.getTime() + durationMs);
          const maskIntervals = task.mask_id
            ? resolveMaskIntervals(task.mask_id, cursorDate, dayOfWeek, masks)
            : null;
          const insideMask = !maskIntervals || maskIntervals.some((interval) =>
            interval.start <= hours * 60 + minutes
            && hours * 60 + minutes + durationMinutes <= interval.end,
          );
          const beforeDeadline = !deadlineDate || tryEnd <= deadlineDate;
          const conflict = !task.allows_overlap && occupied.some((item) => tryStart < item.end && tryEnd > item.start);

          if (tryStart >= taskReadyAt && insideMask && beforeDeadline && !conflict) {
            placements.push({
              task_id: task.task_id,
              suggested_start: tryStart.toISOString(),
              suggested_end: tryEnd.toISOString(),
            });
            if (!task.allows_overlap) occupied.push({ start: tryStart, end: tryEnd });
          }
        }
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
      const firstPlacement = placements.slice(placementStartIndex)
        .sort((left, right) => left.suggested_end.localeCompare(right.suggested_end))[0];
      if (firstPlacement) completionTimes.set(task.task_id, new Date(firstPlacement.suggested_end));
      if (firstPlacement && task.location_lat != null && task.location_lon != null) {
        lastLocation = { lat: task.location_lat, lon: task.location_lon };
      }
      continue;
    }

    // Search up to 4 weeks ahead
    const searchEnd = new Date(now.getTime() + 28 * 24 * 3600 * 1000);
    const schedulingTimeZone = validTimeZone(task.recurrence_timezone || requestTimeZone);
    let found: GhostPlacement | null = null;

    // Iterate day by day, slot by slot
    const cursor = new Date(taskReadyAt);
    cursor.setSeconds(0, 0);
    // Round up to next 30-min
    const mins = cursor.getMinutes();
    if (mins > 0 && mins <= 30) cursor.setMinutes(30);
    else if (mins > 30) { cursor.setMinutes(0); cursor.setHours(cursor.getHours() + 1); }

    while (cursor < searchEnd && !found) {
      const cursorDate = dateInTimeZone(cursor, schedulingTimeZone);
      const dayOfWeek = new Date(`${cursorDate}T00:00:00Z`).getUTCDay();

      if (task.mask_id) {
        const dayIntervals = resolveMaskIntervals(task.mask_id, cursorDate, dayOfWeek, masks);
        for (const interval of dayIntervals) {
          // Build absolute window for this slot on this day
          const slotStart = zonedDateTime(cursorDate, minutesToTime(interval.start), schedulingTimeZone);
          const slotEnd = zonedDateTime(cursorDate, minutesToTime(interval.end), schedulingTimeZone);

          // Try fitting from max(cursor, slotStart)
          let tryStart = new Date(Math.max(cursor.getTime(), slotStart.getTime()));
          while (tryStart.getTime() + durationMs <= slotEnd.getTime()) {
            const tryEnd = new Date(tryStart.getTime() + durationMs);
            if (deadlineDate && tryEnd > deadlineDate) break;

            const conflict = !task.allows_overlap && occupied.some(
              (o) => tryStart < o.end && tryEnd > o.start,
            );

            if (!conflict) {
              found = {
                task_id: task.task_id,
                suggested_start: tryStart.toISOString(),
                suggested_end: tryEnd.toISOString(),
              };
              if (!task.allows_overlap) occupied.push({ start: tryStart, end: tryEnd });
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

          const conflict = !task.allows_overlap && occupied.some((o) => tryStart < o.end && tryEnd > o.start);
          if (!conflict) {
            found = {
              task_id: task.task_id,
              suggested_start: tryStart.toISOString(),
              suggested_end: tryEnd.toISOString(),
            };
            if (!task.allows_overlap) occupied.push({ start: tryStart, end: tryEnd });
            break;
          }
          const blocker = occupied.find((o) => tryStart < o.end && tryEnd > o.start);
          if (blocker) tryStart = new Date(blocker.end);
          else tryStart = new Date(tryStart.getTime() + 30 * 60 * 1000);
        }
      }

      if (found) break;
      // Advance to next day 00:00
      const nextDate = new Date(`${cursorDate}T00:00:00Z`);
      nextDate.setUTCDate(nextDate.getUTCDate() + 1);
      cursor.setTime(zonedDateTime(nextDate.toISOString().slice(0, 10), '00:00', schedulingTimeZone).getTime());
    }

    if (found) {
      placements.push(found);
      completionTimes.set(task.task_id, new Date(found.suggested_end));
      if (task.location_lat != null && task.location_lon != null) {
        lastLocation = { lat: task.location_lat, lon: task.location_lon };
      }
    }
  }

  return placements;
}
