import { FormEvent, useEffect, useMemo, useState } from "react";
import { HiOutlinePencilSquare, HiOutlinePlay, HiOutlineTrash, HiOutlineUsers, HiOutlineXMark } from "react-icons/hi2";
import {
  createCronJob,
  deleteCronJob,
  fetchCronJobs,
  runCronJob,
  type CronJob,
  updateCronJob,
} from "../../api/cron";
import useDocumentTitle from "../../hooks/useDocumentTitle";

type ScheduleMode = "hourly" | "daily" | "weekly" | "monthly" | "custom";

type ScheduleFormState = {
  mode: ScheduleMode;
  minute: string;
  hour: string;
  weekday: string;
  dayOfMonth: string;
  customPattern: string;
};

type JobFormState = {
  name: string;
  command: string;
  enabled: boolean;
  schedule: ScheduleFormState;
};

const weekdayOptions = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

function createScheduleState(mode: ScheduleMode = "hourly"): ScheduleFormState {
  return {
    mode,
    minute: "0",
    hour: "0",
    weekday: "1",
    dayOfMonth: "1",
    customPattern: "",
  };
}

function createDefaultFormState(): JobFormState {
  return {
    name: "",
    command: "",
    enabled: true,
    schedule: createScheduleState("hourly"),
  };
}

function isValidIntegerInRange(value: string, min: number, max: number): boolean {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    return false;
  }

  const parsed = Number.parseInt(trimmed, 10);
  return parsed >= min && parsed <= max;
}

function buildScheduleExpression(schedule: ScheduleFormState): string {
  switch (schedule.mode) {
    case "hourly":
      return `${schedule.minute.trim()} * * * *`;
    case "daily":
      return `${schedule.minute.trim()} ${schedule.hour.trim()} * * *`;
    case "weekly":
      return `${schedule.minute.trim()} ${schedule.hour.trim()} * * ${schedule.weekday.trim()}`;
    case "monthly":
      return `${schedule.minute.trim()} ${schedule.hour.trim()} ${schedule.dayOfMonth.trim()} * *`;
    case "custom":
      return schedule.customPattern.trim();
    default:
      return schedule.customPattern.trim();
  }
}

function scheduleModeLabel(mode: ScheduleMode): string {
  switch (mode) {
    case "hourly":
      return "Hourly";
    case "daily":
      return "Daily";
    case "weekly":
      return "Weekly";
    case "monthly":
      return "Monthly";
    case "custom":
      return "Custom";
    default:
      return "Custom";
  }
}

function describeSchedule(schedule: ScheduleFormState): string {
  switch (schedule.mode) {
    case "hourly":
      return `Runs every hour at minute ${schedule.minute.trim() || "0"}.`;
    case "daily":
      return `Runs every day at ${schedule.hour.trim() || "0"}:${schedule.minute.trim() || "0"}.`;
    case "weekly": {
      const weekdayLabel = weekdayOptions.find((option) => option.value === schedule.weekday.trim())?.label ?? "Monday";
      return `Runs every week on ${weekdayLabel} at ${schedule.hour.trim() || "0"}:${schedule.minute.trim() || "0"}.`;
    }
    case "monthly":
      return `Runs every month on day ${schedule.dayOfMonth.trim() || "1"} at ${schedule.hour.trim() || "0"}:${schedule.minute.trim() || "0"}.`;
    case "custom":
      return "Enter a custom cron expression.";
    default:
      return "Select a schedule preset.";
  }
}

function parseScheduleState(schedule: string): ScheduleFormState {
  const normalized = schedule.trim().replace(/\s+/g, " ");

  if (normalized === "@hourly") {
    return createScheduleState("hourly");
  }

  if (normalized === "@daily") {
    return createScheduleState("daily");
  }

  if (normalized === "@weekly") {
    return createScheduleState("weekly");
  }

  if (normalized === "@monthly") {
    return createScheduleState("monthly");
  }

  const hourly = normalized.match(/^(\d{1,2}) \* \* \* \*$/);
  if (hourly) {
    return {
      ...createScheduleState("hourly"),
      minute: hourly[1],
    };
  }

  const daily = normalized.match(/^(\d{1,2}) (\d{1,2}) \* \* \*$/);
  if (daily) {
    return {
      ...createScheduleState("daily"),
      minute: daily[1],
      hour: daily[2],
    };
  }

  const weekly = normalized.match(/^(\d{1,2}) (\d{1,2}) \* \* ([0-7])$/);
  if (weekly) {
    return {
      ...createScheduleState("weekly"),
      minute: weekly[1],
      hour: weekly[2],
      weekday: weekly[3] === "7" ? "0" : weekly[3],
    };
  }

  const monthly = normalized.match(/^(\d{1,2}) (\d{1,2}) (\d{1,2}) \* \*$/);
  if (monthly) {
    return {
      ...createScheduleState("monthly"),
      minute: monthly[1],
      hour: monthly[2],
      dayOfMonth: monthly[3],
    };
  }

  return {
    ...createScheduleState("custom"),
    customPattern: schedule.trim(),
  };
}

function validateSchedule(schedule: ScheduleFormState): string | null {
  if (schedule.mode === "hourly" && !isValidIntegerInRange(schedule.minute, 0, 59)) {
    return "Hourly presets need a minute between 0 and 59.";
  }

  if (schedule.mode === "daily") {
    if (!isValidIntegerInRange(schedule.minute, 0, 59) || !isValidIntegerInRange(schedule.hour, 0, 23)) {
      return "Daily presets need a valid hour and minute.";
    }
  }

  if (schedule.mode === "weekly") {
    if (
      !isValidIntegerInRange(schedule.minute, 0, 59) ||
      !isValidIntegerInRange(schedule.hour, 0, 23) ||
      !isValidIntegerInRange(schedule.weekday, 0, 6)
    ) {
      return "Weekly presets need a valid weekday, hour and minute.";
    }
  }

  if (schedule.mode === "monthly") {
    if (
      !isValidIntegerInRange(schedule.minute, 0, 59) ||
      !isValidIntegerInRange(schedule.hour, 0, 23) ||
      !isValidIntegerInRange(schedule.dayOfMonth, 1, 31)
    ) {
      return "Monthly presets need a valid day, hour and minute.";
    }
  }

  if (schedule.mode === "custom" && !schedule.customPattern.trim()) {
    return "Enter a cron pattern for the custom schedule.";
  }

  return null;
}

function emptyToDefault(value: string): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "-";
}

function formatDateTime(value?: string): string {
  if (!value?.trim()) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

function isManagedJob(job: CronJob): boolean {
  return job.managed !== false;
}

function jobToForm(job: CronJob): JobFormState {
  return {
    name: job.name,
    command: job.command,
    enabled: job.enabled,
    schedule: parseScheduleState(job.schedule),
  };
}

type ScheduleBuilderProps = {
  idPrefix: string;
  value: ScheduleFormState;
  onChange: (next: ScheduleFormState) => void;
  disabled?: boolean;
};

function ScheduleBuilder({ idPrefix, value, onChange, disabled = false }: ScheduleBuilderProps) {
  const preview = buildScheduleExpression(value);

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Schedule</p>
          <h3 className="mt-1 text-sm font-semibold text-white">{scheduleModeLabel(value.mode)}</h3>
        </div>

        <label className="text-xs text-slate-400">
          Preset
          <select
            className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none disabled:opacity-60"
            value={value.mode}
            onChange={(event) => {
              const nextMode = event.target.value as ScheduleMode;
              if (nextMode === value.mode) {
                return;
              }

              if (nextMode === "custom") {
                onChange({
                  ...createScheduleState("custom"),
                  customPattern: buildScheduleExpression(value),
                });
                return;
              }

              const nextState = createScheduleState(nextMode);

              if (nextMode === "hourly") {
                onChange({
                  ...nextState,
                  minute: value.minute || nextState.minute,
                });
                return;
              }

              if (nextMode === "daily") {
                onChange({
                  ...nextState,
                  minute: value.minute || nextState.minute,
                  hour: value.hour || nextState.hour,
                });
                return;
              }

              if (nextMode === "weekly") {
                onChange({
                  ...nextState,
                  minute: value.minute || nextState.minute,
                  hour: value.hour || nextState.hour,
                  weekday: value.weekday || nextState.weekday,
                });
                return;
              }

              onChange({
                ...nextState,
                minute: value.minute || nextState.minute,
                hour: value.hour || nextState.hour,
                dayOfMonth: value.dayOfMonth || nextState.dayOfMonth,
              });
            }}
            disabled={disabled}
          >
            <option value="hourly">Hourly</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="custom">Custom</option>
          </select>
        </label>
      </div>

      <p className="mt-2 text-xs text-slate-400">{describeSchedule(value)}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {value.mode === "hourly" ? (
          <label className="text-xs text-slate-400">
            Minute
            <input
              id={`${idPrefix}-minute`}
              type="number"
              min={0}
              max={59}
              className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none disabled:opacity-60"
              value={value.minute}
              onChange={(event) => onChange({ ...value, minute: event.target.value })}
              placeholder="0"
              disabled={disabled}
            />
          </label>
        ) : null}

        {value.mode === "daily" ? (
          <>
            <label className="text-xs text-slate-400">
              Hour
              <input
                id={`${idPrefix}-hour`}
                type="number"
                min={0}
                max={23}
                className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none disabled:opacity-60"
                value={value.hour}
                onChange={(event) => onChange({ ...value, hour: event.target.value })}
                placeholder="0"
                disabled={disabled}
              />
            </label>
            <label className="text-xs text-slate-400">
              Minute
              <input
                id={`${idPrefix}-minute`}
                type="number"
                min={0}
                max={59}
                className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none disabled:opacity-60"
                value={value.minute}
                onChange={(event) => onChange({ ...value, minute: event.target.value })}
                placeholder="0"
                disabled={disabled}
              />
            </label>
          </>
        ) : null}

        {value.mode === "weekly" ? (
          <>
            <label className="text-xs text-slate-400">
              Day of week
              <select
                id={`${idPrefix}-weekday`}
                className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none disabled:opacity-60"
                value={value.weekday}
                onChange={(event) => onChange({ ...value, weekday: event.target.value })}
                disabled={disabled}
              >
                {weekdayOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-400">
              Hour
              <input
                id={`${idPrefix}-hour`}
                type="number"
                min={0}
                max={23}
                className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none disabled:opacity-60"
                value={value.hour}
                onChange={(event) => onChange({ ...value, hour: event.target.value })}
                placeholder="0"
                disabled={disabled}
              />
            </label>
            <label className="text-xs text-slate-400">
              Minute
              <input
                id={`${idPrefix}-minute`}
                type="number"
                min={0}
                max={59}
                className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none disabled:opacity-60"
                value={value.minute}
                onChange={(event) => onChange({ ...value, minute: event.target.value })}
                placeholder="0"
                disabled={disabled}
              />
            </label>
          </>
        ) : null}

        {value.mode === "monthly" ? (
          <>
            <label className="text-xs text-slate-400">
              Day of month
              <input
                id={`${idPrefix}-day`}
                type="number"
                min={1}
                max={31}
                className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none disabled:opacity-60"
                value={value.dayOfMonth}
                onChange={(event) => onChange({ ...value, dayOfMonth: event.target.value })}
                placeholder="1"
                disabled={disabled}
              />
            </label>
            <label className="text-xs text-slate-400">
              Hour
              <input
                id={`${idPrefix}-hour`}
                type="number"
                min={0}
                max={23}
                className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none disabled:opacity-60"
                value={value.hour}
                onChange={(event) => onChange({ ...value, hour: event.target.value })}
                placeholder="0"
                disabled={disabled}
              />
            </label>
            <label className="text-xs text-slate-400">
              Minute
              <input
                id={`${idPrefix}-minute`}
                type="number"
                min={0}
                max={59}
                className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none disabled:opacity-60"
                value={value.minute}
                onChange={(event) => onChange({ ...value, minute: event.target.value })}
                placeholder="0"
                disabled={disabled}
              />
            </label>
          </>
        ) : null}

        {value.mode === "custom" ? (
          <label className="sm:col-span-2 text-xs text-slate-400">
            Cron pattern
            <textarea
              id={`${idPrefix}-custom`}
              className="mt-1 h-24 w-full resize-y rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-mono text-slate-100 outline-none disabled:opacity-60"
              value={value.customPattern}
              onChange={(event) => onChange({ ...value, customPattern: event.target.value })}
              placeholder="0 2 * * *"
              disabled={disabled}
            />
          </label>
        ) : null}
      </div>

      <div className="mt-4 rounded-lg border border-dashed border-white/15 bg-black/20 px-3 py-2">
        <p className="text-[11px] uppercase tracking-wide text-slate-500">Generated cron</p>
        <p className="mt-1 break-all font-mono text-sm text-amber-200">{preview || "-"}</p>
      </div>
    </div>
  );
}

type TaskFormFieldsProps = {
  form: JobFormState;
  onChange: (next: JobFormState) => void;
  disabled?: boolean;
  idPrefix: string;
};

function TaskFormFields({ form, onChange, disabled = false, idPrefix }: TaskFormFieldsProps) {
  return (
    <div className="space-y-4">
      <label className="text-xs text-slate-400">
        Name
        <input
          className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none disabled:opacity-60"
          value={form.name}
          onChange={(event) => onChange({ ...form, name: event.target.value })}
          placeholder="Nightly cleanup"
          disabled={disabled}
          autoFocus={idPrefix === "create"}
        />
      </label>

      <ScheduleBuilder
        idPrefix={`${idPrefix}-schedule`}
        value={form.schedule}
        onChange={(schedule) => onChange({ ...form, schedule })}
        disabled={disabled}
      />

      <label className="text-xs text-slate-400">
        Command
        <textarea
          className="mt-1 h-28 w-full resize-y rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-mono text-slate-100 outline-none disabled:opacity-60"
          value={form.command}
          onChange={(event) => onChange({ ...form, command: event.target.value })}
          placeholder="/usr/bin/php /var/www/app/artisan schedule:run"
          disabled={disabled}
        />
      </label>

      <label className="inline-flex items-center gap-2 text-sm text-slate-300">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-white/20 bg-white/10"
          checked={form.enabled}
          onChange={(event) => onChange({ ...form, enabled: event.target.checked })}
          disabled={disabled}
        />
        Enabled
      </label>
    </div>
  );
}

export default function TasksPage() {
  useDocumentTitle("TASKS - CRON MANAGER");

  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<JobFormState>(createDefaultFormState());
  const [editForm, setEditForm] = useState<JobFormState | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [runningJobId, setRunningJobId] = useState<string | null>(null);

  const sortedJobs = useMemo(() => {
    return [...jobs].sort((a, b) => a.name.localeCompare(b.name));
  }, [jobs]);

  const editingJob = useMemo(() => {
    if (!editingId) {
      return null;
    }

    return jobs.find((job) => job.id === editingId) ?? null;
  }, [editingId, jobs]);

  const refreshJobs = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchCronJobs();
      setJobs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load cron tasks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshJobs();
  }, []);

  useEffect(() => {
    if (editingId && !editingJob) {
      setEditingId(null);
      setEditForm(null);
    }
  }, [editingId, editingJob]);

  useEffect(() => {
    if (!createModalOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setCreateModalOpen(false);
        setCreateForm(createDefaultFormState());
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [createModalOpen]);

  const openCreateModal = () => {
    setError(null);
    setMessage(null);
    setCreateForm(createDefaultFormState());
    setCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    setCreateModalOpen(false);
    setCreateForm(createDefaultFormState());
  };

  const clearEditing = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const onSubmitCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const scheduleError = validateSchedule(createForm.schedule);
    if (!createForm.name.trim() || !createForm.command.trim() || scheduleError) {
      setError(!createForm.name.trim() || !createForm.command.trim() ? "Name and command are required." : scheduleError);
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);

    const payload = {
      name: createForm.name.trim(),
      schedule: buildScheduleExpression(createForm.schedule),
      command: createForm.command.trim(),
      enabled: createForm.enabled,
    };

    try {
      const created = await createCronJob(payload);
      setJobs((previous) => [created, ...previous]);
      setMessage("Task created.");
      closeCreateModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save task");
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (job: CronJob) => {
    setEditForm(jobToForm(job));
    setEditingId(job.id);
    setMessage(null);
    setError(null);
  };

  const onSubmitEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editingId || !editForm) {
      return;
    }

    const scheduleError = validateSchedule(editForm.schedule);
    if (!editForm.name.trim() || !editForm.command.trim() || scheduleError) {
      setError(!editForm.name.trim() || !editForm.command.trim() ? "Name and command are required." : scheduleError);
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);

    const payload = {
      name: editForm.name.trim(),
      schedule: buildScheduleExpression(editForm.schedule),
      command: editForm.command.trim(),
      enabled: editForm.enabled,
    };

    try {
      const updated = await updateCronJob(editingId, payload);
      setJobs((previous) => previous.map((item) => (item.id === editingId ? updated : item)));
      setEditForm(jobToForm(updated));
      setMessage("Task updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save task");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (job: CronJob) => {
    if (!window.confirm(`Delete cron task "${job.name}"?`)) {
      return;
    }

    setError(null);
    setMessage(null);

    try {
      await deleteCronJob(job.id);
      setJobs((previous) => previous.filter((item) => item.id !== job.id));
      if (editingId === job.id) {
        clearEditing();
      }
      setMessage("Task deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete task");
    }
  };

  const toggleJob = async (job: CronJob) => {
    setError(null);
    setMessage(null);

    try {
      const updated = await updateCronJob(job.id, { enabled: !job.enabled });
      setJobs((previous) => previous.map((item) => (item.id === job.id ? updated : item)));
      if (editingId === job.id) {
        setEditForm((current) => (current ? { ...current, enabled: updated.enabled } : current));
      }
      setMessage(updated.enabled ? "Task enabled." : "Task disabled.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update task status");
    }
  };

  const runJobManually = async (job: CronJob) => {
    setError(null);
    setMessage(null);
    setRunningJobId(job.id);

    try {
      const result = await runCronJob(job.id);
      const output = result.stdout.trim() || result.stderr.trim();
      setMessage(output ? `Task ran successfully: ${output.slice(0, 140)}` : "Task ran successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to run task");
    } finally {
      setRunningJobId(null);
    }
  };

  return (
    <div className="h-full w-full overflow-auto bg-black text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -left-24 -top-20 h-72 w-72 rounded-full bg-orange-500/10 blur-3xl" />
        <div className="absolute right-0 top-12 h-72 w-72 rounded-full bg-red-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />
      </div>

      <div className="relative z-10 flex h-full w-full flex-col">
        <header className="shrink-0 border-b border-white/10 bg-black/30 px-4 py-3 backdrop-blur-md lg:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Task Manager</p>
              <h1 className="mt-1 text-2xl font-semibold">Cron Jobs</h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
                onClick={() => {
                  void refreshJobs();
                }}
              >
                Refresh
              </button>
              <button
                type="button"
                className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-400"
                onClick={openCreateModal}
              >
                + Create task
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto px-4 py-4 lg:px-6">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
            <section className="rounded-xl border border-white/10 bg-black/40 p-4 backdrop-blur-md">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Scheduled Tasks</h2>
                  <p className="mt-1 text-xs text-slate-500">Choose a task to open its details in the panel on the right.</p>
                </div>
              </div>

              {loading ? <div className="mt-4 text-sm text-slate-400">Loading tasks...</div> : null}

              {!loading && sortedJobs.length === 0 ? (
                <div className="mt-4 rounded-lg border border-dashed border-white/15 bg-white/5 p-6 text-sm text-slate-400">
                  No cron jobs found. Use the <span className="text-orange-300">+ Create task</span> button to create your first task.
                </div>
              ) : null}

              {!loading && sortedJobs.length > 0 ? (
                <div className="mt-4 flex flex-col gap-2">
                  {sortedJobs.map((job) => {
                    const managed = isManagedJob(job);
                    const selected = editingId === job.id;

                    return (
                      <article
                        key={job.id}
                        className={`rounded-lg border p-3 transition ${
                          selected ? "border-orange-400/40 bg-orange-500/10" : "border-white/10 bg-black/30"
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-center gap-2">
                              <span
                                className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                                  job.enabled ? "bg-emerald-400" : "bg-slate-500"
                                }`}
                                aria-hidden="true"
                                title={job.enabled ? "Enabled" : "Disabled"}
                              />
                              <h3 className="truncate text-sm font-semibold text-slate-100">{job.name}</h3>
                              {!managed ? (
                                <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-slate-400">
                                  <HiOutlineUsers className="h-3.5 w-3.5" aria-hidden="true" />
                                  <span>External</span>
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-2 font-mono text-xs text-amber-200">{emptyToDefault(job.schedule)}</p>
                            <p className="mt-1 break-all font-mono text-xs text-slate-300">{emptyToDefault(job.command)}</p>
                            <p className="mt-1 text-[11px] text-slate-500">ID: {job.id}</p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              role="switch"
                              aria-checked={job.enabled}
                              aria-label={job.enabled ? "Disable task" : "Enable task"}
                              title={job.enabled ? "Disable task" : "Enable task"}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full border transition ${
                                job.enabled
                                  ? "border-emerald-300/40 bg-emerald-500/25"
                                  : "border-white/20 bg-white/10"
                              }`}
                              onClick={() => {
                                void toggleJob(job);
                              }}
                            >
                              <span
                                className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                                  job.enabled ? "translate-x-6" : "translate-x-1"
                                }`}
                              />
                            </button>
                            <button
                              type="button"
                              aria-label="Run task"
                              title="Run task"
                              disabled={runningJobId === job.id}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-emerald-300/20 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                              onClick={() => {
                                void runJobManually(job);
                              }}
                            >
                              <HiOutlinePlay className="h-4 w-4" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              aria-label="Edit task"
                              title="Edit task"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-blue-300/20 bg-blue-500/10 text-blue-200 hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                              onClick={() => startEdit(job)}
                            >
                              <HiOutlinePencilSquare className="h-4 w-4" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              aria-label="Delete task"
                              title="Delete task"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-300/20 bg-red-500/10 text-red-200 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                              onClick={() => {
                                void handleDelete(job);
                              }}
                            >
                              <HiOutlineTrash className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : null}
            </section>

            <aside className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-md xl:sticky xl:top-4">
              <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Task details</p>
                  <h2 className="mt-1 text-lg font-semibold text-white">
                    {editingJob ? editingJob.name : "Select a task to edit"}
                  </h2>
                </div>

                {editingJob ? (
                  <button
                    type="button"
                    className="rounded-md border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
                    onClick={clearEditing}
                    aria-label="Close details panel"
                    title="Close details panel"
                  >
                    <HiOutlineXMark className="h-4 w-4" aria-hidden="true" />
                  </button>
                ) : null}
              </div>

              {!editingJob || !editForm ? (
                <div className="px-4 py-6 text-sm text-slate-400">
                  Pick a cron job from the list to inspect or update it here.
                </div>
              ) : (
                <div className="space-y-4 p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-slate-500">Status</p>
                      <p className="mt-1 text-sm text-slate-100">{editForm.enabled ? "Enabled" : "Disabled"}</p>
                      <p className="mt-2 text-xs text-slate-400">{isManagedJob(editingJob) ? "Managed job" : "External job"}</p>
                    </div>

                    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-slate-500">Identifiers</p>
                      <p className="mt-1 break-all text-sm text-slate-100">ID: {editingJob.id}</p>
                      <p className="mt-2 text-xs text-slate-400">Schedule: {buildScheduleExpression(editForm.schedule) || "-"}</p>
                    </div>

                    <div className="rounded-lg border border-white/10 bg-black/20 p-3 sm:col-span-2">
                      <p className="text-[11px] uppercase tracking-wide text-slate-500">Runtime info</p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <div>
                          <p className="text-xs text-slate-400">Last run</p>
                          <p className="mt-1 text-sm text-slate-100">{formatDateTime(editingJob.lastRun)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Next run</p>
                          <p className="mt-1 text-sm text-slate-100">{formatDateTime(editingJob.nextRun)}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <form className="space-y-4" onSubmit={onSubmitEdit}>
                    <TaskFormFields
                      idPrefix="edit"
                      form={editForm}
                      onChange={(next) => setEditForm(next)}
                      disabled={submitting}
                    />

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={runningJobId === editingJob.id}
                          className="rounded-lg border border-emerald-300/20 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20 disabled:opacity-60"
                          onClick={() => {
                            void runJobManually(editingJob);
                          }}
                        >
                          {runningJobId === editingJob.id ? "Running..." : "Run"}
                        </button>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-400 disabled:opacity-60"
                      >
                        {submitting ? "Saving..." : "Update task"}
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10"
                        onClick={() => {
                          if (editingJob) {
                            setEditForm(jobToForm(editingJob));
                          }
                        }}
                        disabled={submitting}
                      >
                        Reset
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </aside>
          </div>

          {error ? (
            <div className="mt-4 rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
          ) : null}

          {message ? (
            <div className="mt-4 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{message}</div>
          ) : null}
        </div>
      </div>

      {createModalOpen ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">New task</p>
                <h2 className="mt-1 text-xl font-semibold text-white">Create cron job</h2>
              </div>

              <button
                type="button"
                className="rounded-md border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
                onClick={closeCreateModal}
                aria-label="Close create task modal"
                title="Close"
              >
                <HiOutlineXMark className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <form className="max-h-[calc(100vh-6rem)] overflow-auto p-5" onSubmit={onSubmitCreate}>
              <TaskFormFields
                idPrefix="create"
                form={createForm}
                onChange={(next) => setCreateForm(next)}
                disabled={submitting}
              />

              <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-white/10 pt-4">
                <button
                  type="button"
                  className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10"
                  onClick={closeCreateModal}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-400 disabled:opacity-60"
                >
                  {submitting ? "Creating..." : "Create task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
