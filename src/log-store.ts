import { getClient } from "./dropbox-auth";

const path = "/exercise-log.json";
export type Pattern = "push" | "pull" | "legs";
export type SetLog = { id: string; date: string; exercise: string; pattern: Pattern; reps: string };
export type ActivityLog = { id: string; date: string; name: string };
export type WeeklyTargets = Record<Pattern, number>;
export const defaultWeeklyTargets: WeeklyTargets = { push: 6, pull: 6, legs: 6 };
export type WorkoutLog = { sets: SetLog[]; activities: ActivityLog[]; dayNotes: Record<string, string>; weeklyTargets: WeeklyTargets };
type StoredDay = {
  sets: Array<Omit<SetLog, "date">>;
  activities: Array<Omit<ActivityLog, "date">>;
  notes?: string;
};
type StoredWorkoutLog = { version: 2; days: Record<string, StoredDay>; weeklyTargets: WeeklyTargets };

const readWorkoutLog = (value: unknown): WorkoutLog => {
  const saved = value as StoredWorkoutLog;
  const sets: SetLog[] = [];
  const activities: ActivityLog[] = [];
  const dayNotes: Record<string, string> = {};
  for (const [date, day] of Object.entries(saved.days)) {
    sets.push(...day.sets.map((entry) => ({ ...entry, date })));
    activities.push(...day.activities.map((entry) => ({ ...entry, date })));
    if (typeof day.notes === "string") dayNotes[date] = day.notes;
  }
  return { sets, activities, dayNotes, weeklyTargets: saved.weeklyTargets };
};

const storeWorkoutLog = (log: WorkoutLog): StoredWorkoutLog => {
  const dates = [...new Set([...log.sets.map((entry) => entry.date), ...log.activities.map((entry) => entry.date), ...Object.keys(log.dayNotes)])].sort();
  return {
    version: 2,
    days: Object.fromEntries(dates.map((date) => [date, {
      sets: log.sets.filter((entry) => entry.date === date).map(({ id, exercise, pattern, reps }) => ({ id, exercise, pattern, reps })),
      activities: log.activities.filter((entry) => entry.date === date).map(({ id, name }) => ({ id, name })),
      ...(date in log.dayNotes ? { notes: log.dayNotes[date] } : {}),
    }])),
    weeklyTargets: log.weeklyTargets,
  };
};

export async function loadWorkoutLog(): Promise<WorkoutLog> {
  const client = await getClient();
  try {
    const response = await client.filesDownload({ path });
    return readWorkoutLog(JSON.parse(await (response.result as unknown as { fileBlob: Blob }).fileBlob.text()));
  } catch (error) {
    const summary = (error as { error?: { error_summary?: string } }).error?.error_summary;
    if (summary?.startsWith("path/not_found")) return { sets: [], activities: [], dayNotes: {}, weeklyTargets: defaultWeeklyTargets };
    throw error;
  }
}

export async function saveWorkoutLog(log: WorkoutLog) {
  const client = await getClient();
  await client.filesUpload({ path, mode: { ".tag": "overwrite" }, contents: JSON.stringify(storeWorkoutLog(log), null, 2) });
}
