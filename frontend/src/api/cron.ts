import { apiRequest } from "./http";

export type CronJob = {
  id: string;
  name: string;
  schedule: string;
  command: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
};

export function fetchCronJobs(): Promise<CronJob[]> {
  return apiRequest<CronJob[]>("/cron");
}

export function createCronJob(payload: Pick<CronJob, "name" | "schedule" | "command" | "enabled">): Promise<CronJob> {
  return apiRequest<CronJob>("/cron", {
    method: "POST",
    body: payload,
  });
}

export function updateCronJob(id: string, payload: Partial<Pick<CronJob, "name" | "schedule" | "command" | "enabled">>): Promise<CronJob> {
  return apiRequest<CronJob>(`/cron/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: payload,
  });
}

export async function deleteCronJob(id: string): Promise<void> {
  await apiRequest<void>(`/cron/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
