import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { completeLogin, isConfigured, isLoggedIn, logout, startLogin } from "./dropbox-auth";
import { defaultWeeklyTargets, loadWorkoutLog, saveWorkoutLog, type ActivityLog, type Pattern, type SetLog, type WeeklyTargets } from "./log-store";
import "./style.css";

type Exercise = { name: string; short: string; pattern: Pattern };
const exercises: Exercise[] = [
  { name: "Push-up", short: "Push-up", pattern: "push" }, { name: "Diamond push-up", short: "Diamond", pattern: "push" }, { name: "Deficit push-up", short: "Deficit", pattern: "push" }, { name: "Incline push-up", short: "Incline", pattern: "push" }, { name: "Ring push-up", short: "Ring", pattern: "push" }, { name: "Weighted push-up", short: "Weighted", pattern: "push" },
  { name: "Pull-up", short: "Pull-up", pattern: "pull" }, { name: "Chin-up", short: "Chin-up", pattern: "pull" }, { name: "Wide pull-up", short: "Wide", pattern: "pull" }, { name: "Ring row", short: "Ring row", pattern: "pull" }, { name: "Inverted row", short: "Inverted row", pattern: "pull" },
  { name: "Split squat", short: "Split squat", pattern: "legs" }, { name: "Bulgarian split squat", short: "Bulgarian", pattern: "legs" }, { name: "Squat", short: "Squat", pattern: "legs" }, { name: "Walking lunge", short: "Lunge", pattern: "legs" }, { name: "Weighted split squat", short: "Weighted split", pattern: "legs" },
];
const patterns: Pattern[] = ["push", "pull", "legs"];
const patternNames: Record<Pattern, string> = { push: "Push", pull: "Pull", legs: "Legs" };
// Keep the target experiment ready to restore without showing it for now.
const showWeeklyTargets = false;
const localDate = () => { const now = new Date(); return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const shiftDate = (value: string, days: number) => { const date = new Date(`${value}T12:00:00`); date.setDate(date.getDate() + days); return date.toISOString().slice(0, 10); };
const weekStart = (value: string) => { const d = new Date(`${value}T12:00:00`); d.setDate(d.getDate() - d.getDay()); return d.toISOString().slice(0, 10); };
const formatDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
const formatShortDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: "numeric", day: "numeric" });
const repLabel = (reps: string) => `${reps} ${Number(reps) === 1 ? "rep" : "reps"}`;
const saveError = (error: unknown) => {
  const message = (error as { error?: { error_summary?: string }; message?: string }).error?.error_summary ?? (error as { message?: string }).message ?? "unknown Dropbox error";
  if (message.includes("invalid_access_token") || message.includes("expired_access_token")) return "Dropbox connection expired. Disconnect, then reconnect.";
  return `Save failed: ${message}`;
};

function App() {
  const [date, setDate] = useState(localDate());
  const [logs, setLogs] = useState<SetLog[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [dayNotes, setDayNotes] = useState<Record<string, string>>({});
  const [miscNotes, setMiscNotes] = useState<Record<string, string>>({});
  const [weeklyTargets, setWeeklyTargets] = useState<WeeklyTargets>(defaultWeeklyTargets);
  const [exercise, setExercise] = useState(exercises[0].name);
  const [reps, setReps] = useState("0");
  const [activity, setActivity] = useState("");
  const [miscDraft, setMiscDraft] = useState("");
  const [dark, setDark] = useState(() => localStorage.getItem("workout-log:theme") !== "light");
  const [status, setStatus] = useState("Loading Dropbox…");
  const [ready, setReady] = useState(false);
  const logsRef = useRef<SetLog[]>([]);
  const activitiesRef = useRef<ActivityLog[]>([]);
  const dayNotesRef = useRef<Record<string, string>>({});
  const miscNotesRef = useRef<Record<string, string>>({});
  const weeklyTargetsRef = useRef<WeeklyTargets>(defaultWeeklyTargets);
  const noteTimer = useRef<number | undefined>(undefined);
  const saveQueue = useRef(Promise.resolve());

  useEffect(() => { document.documentElement.dataset.theme = dark ? "dark" : "light"; localStorage.setItem("workout-log:theme", dark ? "dark" : "light"); }, [dark]);
  useEffect(() => { logsRef.current = logs; }, [logs]);
  useEffect(() => { activitiesRef.current = activities; }, [activities]);
  useEffect(() => { dayNotesRef.current = dayNotes; }, [dayNotes]);
  useEffect(() => { miscNotesRef.current = miscNotes; }, [miscNotes]);
  useEffect(() => { setMiscDraft(miscNotes[date] ?? ""); }, [date, miscNotes]);
  useEffect(() => { weeklyTargetsRef.current = weeklyTargets; }, [weeklyTargets]);
  useEffect(() => () => { if (noteTimer.current) window.clearTimeout(noteTimer.current); }, []);
  useEffect(() => {
    const initialize = async () => {
      try {
        await completeLogin();
        if (!isConfigured()) { setStatus("Dropbox app key is not configured."); return; }
        if (!isLoggedIn()) { setStatus("Connect Dropbox to start your log."); return; }
        const saved = await loadWorkoutLog();
        setLogs(saved.sets); setActivities(saved.activities); setDayNotes(saved.dayNotes); setMiscNotes(saved.miscNotes); setWeeklyTargets(saved.weeklyTargets);
        const lastExercise = saved.sets.at(-1)?.exercise;
        if (lastExercise && exercises.some((item) => item.name === lastExercise)) setExercise(lastExercise);
        setStatus("");
      } catch { setStatus("Couldn’t load Dropbox. Try reconnecting."); }
      finally { setReady(true); }
    };
    void initialize();
  }, []);

  const selected = exercises.find((item) => item.name === exercise) ?? exercises[0];
  const isCurrentDay = date === localDate();
  const start = weekStart(date);
  const end = shiftDate(start, 6);
  const daysLeft = Math.max(1, Math.round((new Date(`${end}T12:00:00`).getTime() - new Date(`${date}T12:00:00`).getTime()) / 86400000) + 1);
  const totals = useMemo(() => logs.filter((entry) => entry.date >= start && entry.date <= end).reduce<Record<Pattern, number>>((sum, entry) => { sum[entry.pattern] += 1; return sum; }, { push: 0, pull: 0, legs: 0 }), [logs, start, end]);
  const historyDays = useMemo(() => [...new Set([date, ...logs.filter((entry) => entry.date <= date).map((entry) => entry.date), ...activities.filter((entry) => entry.date <= date).map((entry) => entry.date)])].sort((a, b) => b.localeCompare(a)).slice(0, 14), [logs, activities, date]);
  const groupByExercise = (entries: SetLog[]) => Object.entries(entries.reduce<Record<string, SetLog[]>>((groups, entry) => { (groups[entry.exercise] ??= []).push(entry); return groups; }, {}));
  // Most recent exercise per pattern, so tapping a pattern tab lands on what you actually train.
  const lastByPattern = useMemo(() => logs.reduce<Partial<Record<Pattern, string>>>((map, entry) => { map[entry.pattern] = entry.exercise; return map; }, {}), [logs]);
  const exercisesForPattern = (pattern: Pattern) => {
    const matching = exercises.filter((item) => item.pattern === pattern);
    const lastUsed = lastByPattern[pattern];
    return lastUsed ? [...matching.filter((item) => item.name === lastUsed), ...matching.filter((item) => item.name !== lastUsed)] : matching;
  };

  const persist = (nextSets: SetLog[], nextDayNotes = dayNotesRef.current, nextWeeklyTargets = weeklyTargetsRef.current, nextActivities = activitiesRef.current, nextMiscNotes = miscNotesRef.current) => {
    logsRef.current = nextSets; activitiesRef.current = nextActivities; dayNotesRef.current = nextDayNotes; miscNotesRef.current = nextMiscNotes; weeklyTargetsRef.current = nextWeeklyTargets;
    setLogs(nextSets); setActivities(nextActivities); setDayNotes(nextDayNotes); setMiscNotes(nextMiscNotes); setWeeklyTargets(nextWeeklyTargets); setStatus("Saving…");
    saveQueue.current = saveQueue.current.catch(() => undefined).then(async () => {
      try { await saveWorkoutLog({ sets: nextSets, activities: nextActivities, dayNotes: nextDayNotes, miscNotes: nextMiscNotes, weeklyTargets: nextWeeklyTargets }); setStatus(""); }
      catch (error) { setStatus(saveError(error)); }
    });
    return saveQueue.current;
  };
  const logSet = () => {
    if (!Number(reps)) return;
    if (noteTimer.current) window.clearTimeout(noteTimer.current);
    void persist([...logsRef.current, { id: crypto.randomUUID(), date, exercise: selected.name, pattern: selected.pattern, reps }]);
    setReps("0");
  };
  const logActivity = () => {
    const name = activity.trim();
    if (!name) return;
    void persist(logsRef.current, dayNotesRef.current, weeklyTargetsRef.current, [...activitiesRef.current, { id: crypto.randomUUID(), date, name }]);
    setActivity("");
  };
  const deleteActivity = (id: string) => void persist(logsRef.current, dayNotesRef.current, weeklyTargetsRef.current, activitiesRef.current.filter((entry) => entry.id !== id));
  const stepReps = (amount: number) => setReps((current) => String(Math.max(0, Number(current) + amount)));
  // Digits only, and no leading zeros, so typing into the default 0 gives "8" rather than "08".
  // Clearing the field is allowed while it has focus; blur restores 0.
  const editReps = (value: string) => setReps(value.replace(/\D/g, "").replace(/^0+(?=\d)/, ""));
  const selectPattern = (pattern: Pattern) => setExercise(lastByPattern[pattern] ?? exercises.find((item) => item.pattern === pattern)!.name);
  const changeWeeklyTarget = (pattern: Pattern, value: number) => {
    const next = { ...weeklyTargetsRef.current, [pattern]: Math.max(0, value) };
    void persist(logsRef.current, dayNotesRef.current, next);
  };
  // Pace as a range, not a decimal: 2.5 reads as "2–3 per day", since the aim is guidance.
  const perDayLeft = (pattern: Pattern) => {
    const remaining = Math.max(0, weeklyTargets[pattern] - totals[pattern]);
    if (!remaining) return "aim met";
    const average = remaining / daysLeft;
    const low = Math.floor(average);
    const high = Math.ceil(average);
    return `${low === 0 || low === high ? high : `${low}–${high}`} per day left`;
  };
  const updateDayNote = (note: string) => {
    const next = { ...dayNotesRef.current, [date]: note };
    dayNotesRef.current = next; setDayNotes(next); setStatus("Saving soon…");
    if (noteTimer.current) window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => { noteTimer.current = undefined; void persist(logsRef.current, dayNotesRef.current); }, 1500);
  };
  const saveMiscNote = () => {
    const next = { ...miscNotesRef.current };
    if (miscDraft) next[date] = miscDraft;
    else delete next[date];
    void persist(logsRef.current, dayNotesRef.current, weeklyTargetsRef.current, activitiesRef.current, next);
  };

  if (!isConfigured() || !isLoggedIn()) return <main className="auth"><h1>Exercise log</h1><p>{status}</p><button className="primary" onClick={() => void startLogin()} disabled={!isConfigured()}>Connect Dropbox</button>{!isConfigured() && <p className="help">Add `VITE_DROPBOX_CLIENT_ID` to `.env.local` first.</p>}</main>;
  if (!ready) return <main className="auth"><h1>Exercise log</h1><p>Loading your log…</p></main>;
  return <main>
    <header>
      <div className="title-row">
        <h1>Exercise log</h1>
        <div className="header-actions">
          <button className="icon-button" aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} onClick={() => setDark((value) => !value)}>{dark ? "☀" : "☾"}</button>
          <details className="menu">
            <summary aria-label="More options">⋯</summary>
            <div><button onClick={() => { logout(); window.location.reload(); }}>Disconnect Dropbox</button></div>
          </details>
        </div>
      </div>
      <div className="date-row">
        <button aria-label="Previous day" onClick={() => setDate((value) => shiftDate(value, -1))}>←</button>
        <input aria-label="Date" type="date" value={date} max={localDate()} onChange={(event) => setDate(event.target.value)} />
        <button aria-label="Next day" disabled={isCurrentDay} onClick={() => setDate((value) => shiftDate(value, 1))}>→</button>
      </div>
    </header>

    <section className="week">
      <h2>This week <small>{formatShortDate(start)}–{formatShortDate(end)}</small></h2>
      <div className="week-stats">{patterns.map((pattern) => <div className="week-stat" key={pattern}>
        <p><strong>{totals[pattern]}</strong> {patternNames[pattern]}</p>
        {showWeeklyTargets && <>
          {/* One quiet number per pattern — an aim to glance at, not a quota to hit. */}
          <label className="weekly-target">Aim
            <input type="number" min="0" aria-label={`${patternNames[pattern]} sets to aim for this week`} value={weeklyTargets[pattern]} onChange={(event) => changeWeeklyTarget(pattern, Number(event.target.value))} />
          </label>
          <p className="week-pace">{perDayLeft(pattern)}</p>
        </>}
      </div>)}</div>
      <p className="weekly-guide">Orientation: aim for roughly 10–20 hard sets per pattern each week, building up gradually.</p>
    </section>

    <section className="add">
      <h2>{isCurrentDay ? "Today" : formatDate(date)}</h2>
      <div className="tabs" role="group" aria-label="Movement pattern">
        {patterns.map((pattern) => <button key={pattern} className={pattern === selected.pattern ? "active" : ""} aria-pressed={pattern === selected.pattern} onClick={() => selectPattern(pattern)}>{patternNames[pattern]}</button>)}
      </div>
      <div className="chips" role="group" aria-label="Exercise">
        {exercisesForPattern(selected.pattern).map((item) => <button key={item.name} className={item.name === selected.name ? "active" : ""} aria-pressed={item.name === selected.name} onClick={() => setExercise(item.name)}>{item.short}</button>)}
      </div>
      <div className="reps-row">
        <label className="reps-field">Reps
          <span>
            <button aria-label="One less rep" onClick={() => stepReps(-1)}>−</button>
            <input aria-label="Reps" inputMode="numeric" value={reps} onFocus={() => setReps((current) => current === "0" ? "" : current)} onBlur={() => setReps((current) => current || "0")} onChange={(event) => editReps(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") logSet(); }} />
            <button aria-label="One more rep" onClick={() => stepReps(1)}>+</button>
          </span>
        </label>
        <button className="primary" disabled={!Number(reps)} onClick={logSet}>Log</button>
      </div>
      <div className="day-notes">
        <h3>Strength notes</h3>
        <textarea aria-label="Strength notes" value={dayNotes[date] ?? ""} placeholder="How did the strength work feel? Anything to remember?" onChange={(event) => updateDayNote(event.target.value)} />
      </div>
      <div className="other-activity">
        <h3>Activity log</h3>
        <div className="activity-entry"><input aria-label="Activity log" value={activity} onChange={(event) => setActivity(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") logActivity(); }} /><button className="primary" disabled={!activity.trim()} onClick={logActivity}>Log</button></div>
      </div>
      <div className="misc-notes">
        <h3>Misc</h3>
        <textarea aria-label="Misc" value={miscDraft} onChange={(event) => setMiscDraft(event.target.value)} />
        <div className="misc-actions"><button className="action-button" disabled={miscDraft === (miscNotes[date] ?? "")} onClick={saveMiscNote}>Save</button></div>
      </div>
    </section>

    <section className="history">
      <h2>Exercise history</h2>
      {historyDays.map((day) => { const entries = logs.filter((entry) => entry.date === day); const dayActivities = activities.filter((entry) => entry.date === day); return <div className={`history-day${day === date ? " current-day" : ""}`} key={day}>
        <strong>{day === date ? <><span>Today</span><span>{formatDate(day)}</span></> : formatDate(day)}</strong>
        <div>
          {entries.length === 0 ? <p className="empty">No sets logged yet.</p> : <div className="pattern-columns">
            {patterns.map((pattern) => <div className="pattern-column" key={pattern}>
              <b>{patternNames[pattern]}</b>
              {groupByExercise(entries.filter((entry) => entry.pattern === pattern)).map(([exerciseName, sets]) => <div className="exercise-group" key={exerciseName}>
                <small>{exerciseName}</small>
                {/* Delete is offered only on the selected day, so earlier days can't be edited by a stray tap. */}
                <ul>{sets.map((entry) => <li key={entry.id}><span>{repLabel(entry.reps)}</span>{day === date && <button className="delete" aria-label={`Delete ${repLabel(entry.reps)} of ${exerciseName}`} onClick={() => void persist(logsRef.current.filter((item) => item.id !== entry.id))}>×</button>}</li>)}</ul>
              </div>)}
              {!entries.some((entry) => entry.pattern === pattern) && <p className="empty-pattern">—</p>}
            </div>)}
          </div>}
          {dayActivities.length > 0 && <div className="history-activities">
            <b>Activity log</b>
            <ul className={dayActivities.length > 1 ? "multiple" : ""}>{dayActivities.map((entry) => <li key={entry.id}><span>{entry.name}</span>{day === date && <button className="delete" aria-label={`Delete ${entry.name}`} onClick={() => deleteActivity(entry.id)}>×</button>}</li>)}</ul>
          </div>}
          {miscNotes[day] && <div className="history-misc"><b>Misc</b><p>{miscNotes[day]}</p></div>}
          {day !== date && dayNotes[day] && <p className="saved-day-note">{dayNotes[day]}</p>}
        </div>
      </div>})}
    </section>
    {status && <div className="toast" role="status">{status}</div>}
  </main>;
}

createRoot(document.getElementById("root")!).render(<App />);
