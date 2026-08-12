import { getClient } from "./dropbox-auth";

const path = "/exercise-log.json";
export type Pattern = "push" | "pull" | "legs";
export type SetLog = { id: string; date: string; exercise: string; pattern: Pattern; reps: string };
export type WorkoutLog = { sets: SetLog[]; dayNotes: Record<string, string> };

export async function loadWorkoutLog(): Promise<WorkoutLog> {
  const client = await getClient();
  try {
    const response = await client.filesDownload({ path });
    const saved = JSON.parse(await (response.result as unknown as { fileBlob: Blob }).fileBlob.text()) as WorkoutLog;
    return { sets: saved.sets ?? [], dayNotes: saved.dayNotes ?? {} };
  } catch (error) {
    const summary = (error as { error?: { error_summary?: string } }).error?.error_summary;
    if (summary?.startsWith("path/not_found")) return { sets: [], dayNotes: {} };
    throw error;
  }
}

export async function saveWorkoutLog(log: WorkoutLog) {
  const client = await getClient();
  await client.filesUpload({ path, mode: { ".tag": "overwrite" }, contents: JSON.stringify(log, null, 2) });
}
