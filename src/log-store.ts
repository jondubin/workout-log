import { getClient } from "./dropbox-auth";

const path = "/exercise-log.json";
export type Pattern = "push" | "pull" | "legs";
export type SetLog = { id: string; date: string; exercise: string; pattern: Pattern; reps: string; notes: string };

export async function loadLogs(): Promise<SetLog[]> {
  const client = await getClient();
  try {
    const response = await client.filesDownload({ path });
    return JSON.parse(await (response.result as unknown as { fileBlob: Blob }).fileBlob.text()) as SetLog[];
  } catch (error) {
    const summary = (error as { error?: { error_summary?: string } }).error?.error_summary;
    if (summary?.startsWith("path/not_found")) return [];
    throw error;
  }
}

export async function saveLogs(logs: SetLog[]) {
  const client = await getClient();
  await client.filesUpload({ path, mode: { ".tag": "overwrite" }, contents: JSON.stringify(logs, null, 2) });
}
