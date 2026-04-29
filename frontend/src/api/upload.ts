import { apiUrl } from "../config/api";
import Cookies from "js-cookie";

export async function uploadSampleFiles(params: {
  files: File[];
  destination: string;
}): Promise<{ count: number; destination: string }> {
  const token = Cookies.get("token");
  const form = new FormData();

  params.files.forEach((file) => {
    form.append("files", file, file.name);
  });
  form.append("destination", params.destination);

  const response = await fetch(apiUrl("/samples/upload"), {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });

  const payload = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    data?: { count?: number; destination?: string };
    error?: string;
    message?: string;
  };

  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || payload.message || "Upload failed");
  }

  return {
    count: payload.data?.count ?? params.files.length,
    destination: payload.data?.destination ?? params.destination,
  };
}
