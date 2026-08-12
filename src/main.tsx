import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { completeLogin, isConfigured, isLoggedIn, logout, startLogin } from "./dropbox-auth";
import { loadWorkoutLog, saveWorkoutLog, type Pattern, type SetLog } from "./log-store";
import "./style.css";

type Exercise = { name: string; short: string; pattern: Pattern };
const exercises: Exercise[] = [
  { name: "Push-up", short: "Push-up", pattern: "push" }, { name: "Diamond push-up", short: "Diamond", pattern: "push" }, { name: "Deficit push-up", short: "Deficit", pattern: "push" }, { name: "Incline push-up", short: "Incline", pattern: "push" }, { name: "Ring push-up", short: "Ring", pattern: "push" }, { name: "Weighted push-up", short: "Weighted", pattern: "push" },
  { name: "Pull-up", short: "Pull-up", pattern: "pull" }, { name: "Chin-up", short: "Chin-up", pattern: "pull" }, { name: "Wide pull-up", short: "Wide", pattern: "pull" }, { name: "Ring row", short: "Ring row", pattern: "pull" }, { name: "Inverted row", short: "Inverted row", pattern: "pull" },
  { name: "Split squat", short: "Split squat", pattern: "legs" }, { name: "Bulgarian split squat", short: "Bulgarian", pattern: "legs" }, { name: "Squat", short: "Squat", pattern: "legs" }, { name: "Walking lunge", short: "Lunge", pattern: "legs" }, { name: "Weighted split squat", short: "Weighted split", pattern: "legs" },
];
const patterns: Pattern[] = ["push", "pull", "legs"];
const patternNames: Record<Pattern, string> = { push: "Push", pull: "Pull", legs: "Legs" };
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
  const [dayNotes, setDayNotes] = useState<Record<string, string>>({});
  const [exercise, setExercise] = useState(exercises[0].name);
  const [reps, setReps] = useState("0");
  const [dark, setDark] = useState(() => localStorage.getItem("workout-log:theme") !== "light");
  const [status, setStatus] = useState("Loading Dropbox…");
  const [ready, setReady] = useState(false);
  const logsRef = useRef<SetLog[]>([]);
  const dayNotesRef = useRef<Record<string, string>>({});
  const noteTimer = useRef<number | undefined>(undefined);
  const saveQueue = useRef(Promise.resolve());

  useEffect(() => { document.documentElement.dataset.theme = dark ? "dark" : "light"; localStorage.setItem("workout-log:theme", dark ? "dark" : "light"); }, [dark]);
  useEffect(() => { logsRef.current = logs; }, [logs]);
  useEffect(() => { dayNotesRef.current = dayNotes; }, [dayNotes]);
  useEffect(() => () => { if (noteTimer.current) window.clearTimeout(noteTimer.current); }, []);
  useEffect(() => {
    const initialize = async () => {
      try {
        await completeLogin();
        if (!isConfigured()) { setStatus("Dropbox app key is not configured."); return; }
        if (!isLoggedIn()) { setStatus("Connect Dropbox to start your log."); return; }
        const saved = await loadWorkoutLog();
        setLogs(saved.sets); setDayNotes(saved.dayNotes); setStatus("");
      } catch { setStatus("Couldn’t load Dropbox. Try reconnecting."); }
      finally { setReady(true); }
    };
    void initialize();
  }, []);

  const selected = exercises.find((item) => item.name === exercise) ?? exercises[0];
  const isCurrentDay = date === localDate();
  const start = weekStart(date);
  const end = shiftDate(start, 6);
  const totals = useMemo(() => logs.filter((entry) => entry.date >= start && entry.date <= end).reduce<Record<Pattern, number>>((sum, entry) => { sum[entry.pattern] += 1; return sum; }, { push: 0, pull: 0, legs: 0 }), [logs, start, end]);
  const history = useMemo(() => Object.entries(logs.filter((entry) => entry.date <= date).reduce<Record<string, SetLog[]>>((groups, entry) => { (groups[entry.date] ??= []).push(entry); return groups; }, { [date]: [] })).sort(([a], [b]) => b.localeCompare(a)).slice(0, 14), [logs, date]);
  const groupByExercise = (entries: SetLog[]) => Object.entries(entries.reduce<Record<string, SetLog[]>>((groups, entry) => { (groups[entry.exercise] ??= []).push(entry); return groups; }, {}));
  // Most recent exercise per pattern, so tapping a pattern tab lands on what you actually train.
  const lastByPattern = useMemo(() => logs.reduce<Partial<Record<Pattern, string>>>((map, entry) => { map[entry.pattern] = entry.exercise; return map; }, {}), [logs]);

  const persist = (nextSets: SetLog[], nextDayNotes = dayNotesRef.current) => {
    logsRef.current = nextSets; dayNotesRef.current = nextDayNotes;
    setLogs(nextSets); setDayNotes(nextDayNotes); setStatus("Saving…");
    saveQueue.current = saveQueue.current.catch(() => undefined).then(async () => {
      try { await saveWorkoutLog({ sets: nextSets, dayNotes: nextDayNotes }); setStatus(""); }
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
  const stepReps = (amount: number) => setReps((current) => String(Math.max(0, Number(current) + amount)));
  // Digits only, and no leading zeros, so typing into the default 0 gives "8" rather than "08".
  // Clearing the field is allowed while it has focus; blur restores 0.
  const editReps = (value: string) => setReps(value.replace(/\D/g, "").replace(/^0+(?=\d)/, ""));
  const selectPattern = (pattern: Pattern) => setExercise(lastByPattern[pattern] ?? exercises.find((item) => item.pattern === pattern)!.name);
  const updateDayNote = (note: string) => {
    const next = { ...dayNotesRef.current, [date]: note };
    dayNotesRef.current = next; setDayNotes(next); setStatus("Saving soon…");
    if (noteTimer.current) window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => { noteTimer.current = undefined; void persist(logsRef.current, dayNotesRef.current); }, 1500);
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
      <div>{patterns.map((pattern) => <p key={pattern}><strong>{totals[pattern]}</strong> {patternNames[pattern]} set{totals[pattern] === 1 ? "" : "s"}</p>)}</div>
      <p className="weekly-guide">Orientation: aim for roughly 10–20 hard sets per pattern each week, building up gradually.</p>
    </section>

    <section className="add">
      <div className="tabs" role="group" aria-label="Movement pattern">
        {patterns.map((pattern) => <button key={pattern} className={pattern === selected.pattern ? "active" : ""} aria-pressed={pattern === selected.pattern} onClick={() => selectPattern(pattern)}>{patternNames[pattern]}</button>)}
      </div>
      <div className="chips" role="group" aria-label="Exercise">
        {exercises.filter((item) => item.pattern === selected.pattern).map((item) => <button key={item.name} className={item.name === selected.name ? "active" : ""} aria-pressed={item.name === selected.name} onClick={() => setExercise(item.name)}>{item.short}</button>)}
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
      <details className="day-notes" open={Boolean(dayNotes[date])}>
        <summary>Notes for this day</summary>
        <textarea aria-label="Notes for this day" value={dayNotes[date] ?? ""} placeholder="How did it feel? Anything to remember?" onChange={(event) => updateDayNote(event.target.value)} />
      </details>
    </section>

    <section className="history">
      <h2>Exercise history</h2>
      {history.map(([day, entries]) => <div className={`history-day${day === date ? " current-day" : ""}`} key={day}>
        <strong>{day === date ? <><span>Today</span><span>{formatDate(day)}</span></> : formatDate(day)}</strong>
        <div>
          {entries.length === 0 ? <p className="empty">No sets logged yet.</p> : <div className="exercise-groups">
            {groupByExercise(entries).map(([exerciseName, sets]) => <div className="exercise-group" key={exerciseName}>
              <b>{patternNames[sets[0].pattern]} <small>({exerciseName})</small></b>
              <ul>{sets.map((entry) => <li key={entry.id}><span>{repLabel(entry.reps)}</span><button className="delete" aria-label={`Delete ${repLabel(entry.reps)} of ${exerciseName}`} onClick={() => void persist(logsRef.current.filter((item) => item.id !== entry.id))}>×</button></li>)}</ul>
            </div>)}
          </div>}
          {day !== date && dayNotes[day] && <p className="saved-day-note">{dayNotes[day]}</p>}
        </div>
      </div>)}
    </section>
    {status && <div className="toast" role="status">{status}</div>}
  </main>;
}

createRoot(document.getElementById("root")!).render(<App />);
