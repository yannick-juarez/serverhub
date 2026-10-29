import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HiCheck, HiOutlineChevronRight, HiOutlinePlay, HiPlay, HiXMark, HiOutlineTrash, HiOutlineUsers, HiOutlineXMark } from "react-icons/hi2";
import {
  createCronJob,
  deleteCronJob,
  fetchCronJobs,
  runCronJob,
  type CronJob,
  updateCronJob,
} from "../../api/cron";
import { useAppHeader } from "../../components/Header/appHeader";
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

function formatClock(hour: string, minute: string): string {
  return `${hour.trim().padStart(2, "0")}:${minute.trim().padStart(2, "0")}`;
}

function humanizeSchedule(schedule: string): string | null {
  const parsed = parseScheduleState(schedule);

  switch (parsed.mode) {
    case "hourly":
      return `Hourly at :${parsed.minute.trim().padStart(2, "0")}`;
    case "daily":
      return `Daily at ${formatClock(parsed.hour, parsed.minute)}`;
    case "weekly": {
      const weekday = weekdayOptions.find((option) => option.value === parsed.weekday)?.label.slice(0, 3) ?? "Mon";
      return `${weekday} at ${formatClock(parsed.hour, parsed.minute)}`;
    }
    case "monthly":
      return `Monthly, day ${parsed.dayOfMonth} at ${formatClock(parsed.hour, parsed.minute)}`;
    default:
      return null;
  }
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
  return (
    <div>
      <div>
        <label className="block text-xs text-slate-400">
          Schedule
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

      <div className="mt-3 grid gap-3 sm:auto-cols-fr sm:grid-flow-col">
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
          <label className="text-xs text-slate-400">
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

      {value.mode !== "custom" ? (
        <p className="mt-3 text-sm text-white">{describeSchedule(value)}</p>
      ) : null}
    </div>
  );
}

type RunState = "running" | "success" | "error";

const RUN_FEEDBACK_MS = 2500;

function RunStatusIcon({ state, className = "h-4 w-4" }: { state?: RunState; className?: string }) {
  if (state === "running") {
    return (
      <span
        aria-hidden="true"
        className={`${className} inline-block animate-spin rounded-full border-2 border-current border-r-transparent`}
      />
    );
  }
  if (state === "success") {
    return <HiCheck className={`${className} text-emerald-500`} aria-hidden="true" />;
  }
  if (state === "error") {
    return <HiXMark className={`${className} text-red-500`} aria-hidden="true" />;
  }
  return null;
}

type EnabledSwitchProps = {
  enabled: boolean;
  onToggle: () => void;
  disabled?: boolean;
};

function EnabledSwitch({ enabled, onToggle, disabled = false }: EnabledSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={enabled ? "Disable task" : "Enable task"}
      title={enabled ? "Disable task" : "Enable task"}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-50 ${
        enabled ? "border-emerald-300/40 bg-emerald-500/30" : "border-white/15 bg-white/10"
      }`}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
          enabled ? "translate-x-[18px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

type TaskFormFieldsProps = {
  form: JobFormState;
  onChange: (next: JobFormState) => void;
  disabled?: boolean;
  idPrefix: string;
  showEnabled?: boolean;
};

function TaskFormFields({ form, onChange, disabled = false, idPrefix, showEnabled = true }: TaskFormFieldsProps) {
  return (
    <div className="space-y-4">
      <label className="block text-xs text-slate-400">
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

      <label className="block text-xs text-slate-400">
        Command
        <textarea
          className="mt-1 h-28 w-full resize-y rounded-lg border border-white/10 bg-black/70 px-3 py-2.5 font-mono text-xs leading-5 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-white/30 disabled:opacity-60"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          value={form.command}
          onChange={(event) => onChange({ ...form, command: event.target.value })}
          placeholder="/usr/bin/php /var/www/app/artisan schedule:run"
          disabled={disabled}
        />
      </label>

      <ScheduleBuilder
        idPrefix={`${idPrefix}-schedule`}
        value={form.schedule}
        onChange={(schedule) => onChange({ ...form, schedule })}
        disabled={disabled}
      />

      {showEnabled ? (
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
      ) : null}
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
  const [runStates, setRunStates] = useState<Record<string, RunState>>({});
  const runFeedbackTimers = useRef<Record<string, number>>({});

  useEffect(() => {
    const timers = runFeedbackTimers.current;
    return () => Object.values(timers).forEach((timer) => window.clearTimeout(timer));
  }, []);

  const sortedJobs = useMemo(() => {
    return [...jobs].sort((a, b) => a.name.localeCompare(b.name));
  }, [jobs]);

  const editingJob = useMemo(() => {
    if (!editingId) {
      return null;
    }

    return jobs.find((job) => job.id === editingId) ?? null;
  }, [editingId, jobs]);

  const refreshJobs = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    void refreshJobs();
  }, [refreshJobs]);

  useEffect(() => {
    if (editingId && !editingJob) {
      setEditingId(null);
      setEditForm(null);
    }
  }, [editingId, editingJob]);

  useEffect(() => {
    if (!editingId || createModalOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setEditingId(null);
        setEditForm(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editingId, createModalOpen]);

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

  const openCreateModal = useCallback(() => {
    setError(null);
    setMessage(null);
    setCreateForm(createDefaultFormState());
    setCreateModalOpen(true);
  }, []);

  const headerConfig = useMemo(
    () => ({
      menus: [
        {
          label: "File",
          items: [
            { name: "New task", shortcut: "N", disabled: createModalOpen, action: openCreateModal },
            { name: "Refresh", shortcut: "R", disabled: loading, action: () => void refreshJobs() },
          ],
        },
      ],
    }),
    [createModalOpen, loading, openCreateModal, refreshJobs],
  );

  useAppHeader(headerConfig);

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

  const setRunState = (jobId: string, state: RunState | null) => {
    window.clearTimeout(runFeedbackTimers.current[jobId]);
    delete runFeedbackTimers.current[jobId];
    setRunStates((previous) => {
      const next = { ...previous };
      if (state) {
        next[jobId] = state;
      } else {
        delete next[jobId];
      }
      return next;
    });
    if (state === "success" || state === "error") {
      runFeedbackTimers.current[jobId] = window.setTimeout(() => setRunState(jobId, null), RUN_FEEDBACK_MS);
    }
  };

  const runJobManually = async (job: CronJob) => {
    if (runStates[job.id] === "running") {
      return;
    }

    setError(null);
    setMessage(null);
    setRunState(job.id, "running");

    try {
      const result = await runCronJob(job.id);
      const output = result.stdout.trim() || result.stderr.trim();
      if (result.exitCode !== 0) {
        setRunState(job.id, "error");
        setError(`Task exited with code ${result.exitCode}${output ? `: ${output.slice(0, 140)}` : "."}`);
        return;
      }
      setRunState(job.id, "success");
      setMessage(output ? `Task ran successfully: ${output.slice(0, 140)}` : "Task ran successfully.");
    } catch (err) {
      setRunState(job.id, "error");
      setError(err instanceof Error ? err.message : "Unable to run task");
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
            <h1 className="text-2xl font-semibold">Task Manager</h1>

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
          <div
            className={`grid grid-cols-1 gap-4 ${editingJob ? "xl:grid-cols-[minmax(0,1fr)_440px]" : ""}`}
          >
            <section className="min-w-0 overflow-hidden rounded-xl border border-white/10 bg-black/40 backdrop-blur-md">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Scheduled tasks</h2>
                {!loading ? (
                  <span className="text-xs text-slate-500">
                    {sortedJobs.filter((job) => job.enabled).length} / {sortedJobs.length} active
                  </span>
                ) : null}
              </div>

              {loading && sortedJobs.length === 0 ? <div className="px-4 py-6 text-sm text-slate-400">Loading tasks...</div> : null}

              {!loading && sortedJobs.length === 0 ? (
                <div className="m-4 rounded-lg border border-dashed border-white/15 bg-white/5 p-6 text-sm text-slate-400">
                  No cron jobs found. Use the <span className="text-orange-300">+ Create task</span> button to create your first task.
                </div>
              ) : null}

              {sortedJobs.length > 0 ? (
                <ul className="divide-y divide-white/5">
                  {sortedJobs.map((job) => {
                    const managed = isManagedJob(job);
                    const selected = editingId === job.id;
                    const recurrence = humanizeSchedule(job.schedule);

                    return (
                      <li key={job.id}>
                        <div
                          className={`group relative flex cursor-pointer items-center gap-3 px-4 py-3 transition focus-within:bg-white/[0.04] ${
                            selected ? "bg-orange-500/10" : "hover:bg-white/[0.04]"
                          }`}
                          onClick={() => startEdit(job)}
                        >
                          <span
                            className={`absolute inset-y-0 left-0 w-0.5 transition ${selected ? "bg-orange-400" : "bg-transparent"}`}
                            aria-hidden="true"
                          />

                          <EnabledSwitch enabled={job.enabled} onToggle={() => void toggleJob(job)} />

                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <h3 className="min-w-0">
                              <button
                                type="button"
                                aria-expanded={selected}
                                className={`block max-w-full truncate text-left text-sm font-medium outline-none focus-visible:underline ${
                                  job.enabled ? "text-slate-100" : "text-slate-500"
                                }`}
                                title={job.name}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  startEdit(job);
                                }}
                              >
                                {job.name}
                              </button>
                            </h3>
                            {!managed ? (
                              <span
                                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-400"
                                title="Defined outside ServerHub"
                              >
                                <HiOutlineUsers className="h-3 w-3" aria-hidden="true" />
                                External
                              </span>
                            ) : null}
                          </div>

                          <div className="flex shrink-0 items-center gap-2" title={recurrence ?? undefined}>
                            {recurrence ? (
                              <span className="hidden text-xs text-slate-400 md:inline">{recurrence}</span>
                            ) : null}
                            <code className="rounded-md border border-amber-300/15 bg-amber-500/10 px-2 py-0.5 font-mono text-[11px] text-amber-200">
                              {emptyToDefault(job.schedule)}
                            </code>
                          </div>

                          <div className="flex shrink-0 items-center gap-1 opacity-60 transition group-hover:opacity-100 group-focus-within:opacity-100">
                            <button
                              type="button"
                              aria-label="Run task"
                              title="Run now"
                              aria-busy={runStates[job.id] === "running"}
                              disabled={runStates[job.id] === "running"}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-300 transition hover:bg-emerald-500/15 hover:text-emerald-200 disabled:cursor-not-allowed"
                              onClick={(event) => {
                                event.stopPropagation();
                                void runJobManually(job);
                              }}
                            >
                              {runStates[job.id] ? (
                                <RunStatusIcon state={runStates[job.id]} />
                              ) : (
                                <HiOutlinePlay className="h-4 w-4" aria-hidden="true" />
                              )}
                            </button>
                            <button
                              type="button"
                              aria-label="Delete task"
                              title="Delete"
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-300 transition hover:bg-red-500/15 hover:text-red-200"
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleDelete(job);
                              }}
                            >
                              <HiOutlineTrash className="h-4 w-4" aria-hidden="true" />
                            </button>
                            <HiOutlineChevronRight
                              className={`ml-1 h-4 w-4 transition ${selected ? "text-orange-300" : "text-slate-600 group-hover:text-slate-400"}`}
                              aria-hidden="true"
                            />
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </section>

            {editingJob && editForm ? (
              <>
                <div
                  className="absolute inset-0 z-[110] bg-black/50 xl:hidden"
                  onClick={clearEditing}
                  aria-hidden="true"
                />
                <aside className="absolute inset-y-0 right-0 z-[111] flex w-full max-w-md flex-col overflow-hidden border-l border-white/10 bg-zinc-950 shadow-2xl xl:sticky xl:inset-auto xl:top-0 xl:z-auto xl:max-h-[calc(100vh-10rem)] xl:max-w-none xl:rounded-xl xl:border xl:bg-black/40 xl:shadow-none">
                  <div className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-3">
                    <EnabledSwitch enabled={editingJob.enabled} onToggle={() => void toggleJob(editingJob)} />
                    <h2
                      className={`min-w-0 flex-1 truncate text-base font-semibold ${editingJob.enabled ? "text-white" : "text-slate-400"}`}
                      title={editingJob.name}
                    >
                      {editingJob.name}
                    </h2>
                    <button
                      type="button"
                      className="shrink-0 rounded-md p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
                      onClick={clearEditing}
                      aria-label="Close details panel"
                      title="Close"
                    >
                      <HiOutlineXMark className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>

                  <form className="flex min-h-0 flex-1 flex-col" onSubmit={onSubmitEdit}>
                    <div className="flex-1 space-y-6 overflow-auto p-4">
                      <TaskFormFields
                        idPrefix="edit"
                        form={editForm}
                        onChange={(next) => setEditForm(next)}
                        disabled={submitting}
                        showEnabled={false}
                      />

                      <section className="border-t border-white/10 pt-4">
                        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Details</h3>
                        <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-xs">
                          <dt className="text-slate-500">Cron</dt>
                          <dd className="font-mono text-amber-200">{buildScheduleExpression(editForm.schedule) || "-"}</dd>
                          <dt className="text-slate-500">Last run</dt>
                          <dd className="text-slate-200">{formatDateTime(editingJob.lastRun)}</dd>
                          <dt className="text-slate-500">Next run</dt>
                          <dd className="text-slate-200">{formatDateTime(editingJob.nextRun)}</dd>
                          <dt className="text-slate-500">Source</dt>
                          <dd className="text-slate-200">{isManagedJob(editingJob) ? "Managed by ServerHub" : "External crontab"}</dd>
                          <dt className="text-slate-500">ID</dt>
                          <dd className="break-all font-mono text-slate-400">{editingJob.id}</dd>
                        </dl>
                      </section>
                    </div>

                    <div className="flex shrink-0 items-center gap-2 border-t border-white/10 bg-black/30 px-4 py-3">
                      <button
                        type="button"
                        aria-busy={runStates[editingJob.id] === "running"}
                        disabled={runStates[editingJob.id] === "running"}
                        className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-slate-200 disabled:cursor-progress"
                        onClick={() => {
                          void runJobManually(editingJob);
                        }}
                      >
                        {runStates[editingJob.id] ? (
                          <RunStatusIcon state={runStates[editingJob.id]} />
                        ) : (
                          <HiPlay className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                        )}
                        {runStates[editingJob.id] === "running"
                          ? "Running..."
                          : runStates[editingJob.id] === "success"
                            ? "Done"
                            : runStates[editingJob.id] === "error"
                              ? "Failed"
                              : "Run now"}
                      </button>
                      <div className="ml-auto flex items-center gap-2">
                        <button
                          type="button"
                          className="rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white disabled:opacity-60"
                          onClick={() => setEditForm(jobToForm(editingJob))}
                          disabled={submitting}
                        >
                          Reset
                        </button>
                        <button
                          type="submit"
                          disabled={submitting}
                          className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-400 disabled:opacity-60"
                        >
                          {submitting ? "Saving..." : "Save"}
                        </button>
                      </div>
                    </div>
                  </form>
                </aside>
              </>
            ) : null}
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
