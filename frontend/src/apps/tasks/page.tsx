import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  createCronJob,
  deleteCronJob,
  fetchCronJobs,
  type CronJob,
  updateCronJob,
} from "../../api/cron";
import useDocumentTitle from "../../hooks/useDocumentTitle";

type JobFormState = {
  name: string;
  schedule: string;
  command: string;
  enabled: boolean;
};

const defaultFormState: JobFormState = {
  name: "",
  schedule: "*/5 * * * *",
  command: "",
  enabled: true,
};

function emptyToDefault(value: string): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "-";
}

function isManagedJob(job: CronJob): boolean {
  return job.managed !== false;
}

export default function TasksPage() {
  useDocumentTitle("TASKS - CRON MANAGER");

  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState<JobFormState>(defaultFormState);
  const [editingId, setEditingId] = useState<string | null>(null);

  const sortedJobs = useMemo(() => {
    return [...jobs].sort((a, b) => a.name.localeCompare(b.name));
  }, [jobs]);

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

  const resetForm = () => {
    setForm(defaultFormState);
    setEditingId(null);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.name.trim() || !form.schedule.trim() || !form.command.trim()) {
      setError("Name, schedule and command are required.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);

    const payload = {
      name: form.name.trim(),
      schedule: form.schedule.trim(),
      command: form.command.trim(),
      enabled: form.enabled,
    };

    try {
      if (editingId) {
        const updated = await updateCronJob(editingId, payload);
        setJobs((previous) => previous.map((item) => (item.id === editingId ? updated : item)));
        setMessage("Task updated.");
      } else {
        const created = await createCronJob(payload);
        setJobs((previous) => [created, ...previous]);
        setMessage("Task created.");
      }
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save task");
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (job: CronJob) => {
    setForm({
      name: job.name,
      schedule: job.schedule,
      command: job.command,
      enabled: job.enabled,
    });
    setEditingId(job.id);
    setMessage(null);
    setError(null);
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
        resetForm();
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
        setForm((current) => ({ ...current, enabled: updated.enabled }));
      }
      setMessage(updated.enabled ? "Task enabled." : "Task disabled.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update task status");
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
        <header className="shrink-0 border-b border-white/10 bg-black/30 px-6 py-3 backdrop-blur-md">
          <p className="text-xs uppercase tracking-wide text-slate-400">Task Manager</p>
          <h1 className="mt-1 text-2xl font-semibold">Cron Jobs</h1>
        </header>

        <div className="flex-1 overflow-auto px-4 py-4 lg:px-6">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[370px_minmax(0,1fr)]">
          <section className="rounded-xl border border-white/10 bg-black/40 p-4 backdrop-blur-md">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
              {editingId ? "Edit Task" : "New Task"}
            </h2>

            <form className="mt-4 flex flex-col gap-3" onSubmit={onSubmit}>
              <label className="text-xs text-slate-400">
                Name
                <input
                  className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none"
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Nightly cleanup"
                />
              </label>

              <label className="text-xs text-slate-400">
                Schedule
                <input
                  className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-mono text-slate-100 outline-none"
                  value={form.schedule}
                  onChange={(event) => setForm((current) => ({ ...current, schedule: event.target.value }))}
                  placeholder="0 2 * * *"
                />
              </label>

              <label className="text-xs text-slate-400">
                Command
                <textarea
                  className="mt-1 h-24 w-full resize-y rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-mono text-slate-100 outline-none"
                  value={form.command}
                  onChange={(event) => setForm((current) => ({ ...current, command: event.target.value }))}
                  placeholder="/usr/bin/php /var/www/app/artisan schedule:run"
                />
              </label>

              <label className="inline-flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-white/20 bg-white/10"
                  checked={form.enabled}
                  onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))}
                />
                Enabled
              </label>

              <div className="mt-1 flex items-center gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-400 disabled:opacity-60"
                >
                  {submitting ? "Saving..." : editingId ? "Update task" : "Create task"}
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10"
                  onClick={resetForm}
                >
                  Reset
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10"
                  onClick={() => {
                    void refreshJobs();
                  }}
                >
                  Refresh
                </button>
              </div>
            </form>
          </section>

          <section className="min-h-[260px] rounded-xl border border-white/10 bg-black/40 p-4 backdrop-blur-md">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Scheduled Tasks</h2>

            {loading ? <div className="mt-4 text-sm text-slate-400">Loading tasks...</div> : null}

            {!loading && sortedJobs.length === 0 ? (
              <div className="mt-4 rounded-lg border border-dashed border-white/15 bg-white/5 p-6 text-sm text-slate-400">
                No cron jobs found. Create your first task from the panel.
              </div>
            ) : null}

            {!loading && sortedJobs.length > 0 ? (
              <div className="mt-4 flex flex-col gap-2">
                {sortedJobs.map((job) => (
                  (() => {
                    const managed = isManagedJob(job);
                    return (
                  <article
                    key={job.id}
                    className="rounded-lg border border-white/10 bg-black/30 p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate text-sm font-semibold text-slate-100">{job.name}</h3>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                              job.enabled ? "bg-green-500/20 text-green-300" : "bg-slate-500/20 text-slate-300"
                            }`}
                          >
                            {job.enabled ? "Enabled" : "Disabled"}
                          </span>
                          {!managed ? (
                            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
                              External
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 font-mono text-xs text-amber-200">{emptyToDefault(job.schedule)}</p>
                        <p className="mt-1 break-all font-mono text-xs text-slate-300">{emptyToDefault(job.command)}</p>
                        <p className="mt-1 text-[11px] text-slate-500">ID: {job.id}</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                          onClick={() => {
                            void toggleJob(job);
                          }}
                        >
                          {job.enabled ? "Disable" : "Enable"}
                        </button>
                        <button
                          className="rounded-md border border-blue-300/20 bg-blue-500/10 px-2.5 py-1.5 text-xs text-blue-200 hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                          onClick={() => startEdit(job)}
                        >
                          Edit
                        </button>
                        <button
                          className="rounded-md border border-red-300/20 bg-red-500/10 px-2.5 py-1.5 text-xs text-red-200 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                          onClick={() => {
                            void handleDelete(job);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </article>
                    );
                  })()
                ))}
              </div>
            ) : null}
          </section>
          </div>

          {error ? (
            <div className="mt-4 rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
          ) : null}

          {message ? (
            <div className="mt-4 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{message}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
