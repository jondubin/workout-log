import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { completeLogin, isConfigured, isLoggedIn, logout, startLogin } from "./dropbox-auth";
import { loadWorkoutLog, saveWorkoutLog, type Pattern, type SetLog } from "./log-store";
import "./style.css";

type Exercise = { name: string; pattern: Pattern };
const exercises: Exercise[] = [
  { name: "Push-up", pattern: "push" }, { name: "Diamond push-up", pattern: "push" }, { name: "Deficit push-up", pattern: "push" }, { name: "Incline push-up", pattern: "push" }, { name: "Ring push-up", pattern: "push" }, { name: "Weighted push-up", pattern: "push" },
  { name: "Pull-up", pattern: "pull" }, { name: "Chin-up", pattern: "pull" }, { name: "Wide pull-up", pattern: "pull" }, { name: "Ring row", pattern: "pull" }, { name: "Inverted row", pattern: "pull" },
  { name: "Split squat", pattern: "legs" }, { name: "Bulgarian split squat", pattern: "legs" }, { name: "Squat", pattern: "legs" }, { name: "Walking lunge", pattern: "legs" }, { name: "Weighted split squat", pattern: "legs" },
];
const patternNames: Record<Pattern, string> = { push: "Push", pull: "Pull", legs: "Legs" };
const localDate = () => { const now = new Date(); return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const weekStart = (value: string) => { const d = new Date(`${value}T12:00:00`); d.setDate(d.getDate() - d.getDay()); return d.toISOString().slice(0, 10); };
const formatDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

function App() {
  const [date, setDate] = useState(localDate());
  const [logs, setLogs] = useState<SetLog[]>([]);
  const [dayNotes, setDayNotes] = useState<Record<string, string>>({});
  const [exercise, setExercise] = useState(exercises[0].name);
  const [reps, setReps] = useState("");
  const [dark, setDark] = useState(() => localStorage.getItem("workout-log:theme") !== "light");
  const [status, setStatus] = useState("Loading Dropbox…");

  useEffect(() => { document.documentElement.dataset.theme = dark ? "dark" : "light"; localStorage.setItem("workout-log:theme", dark ? "dark" : "light"); }, [dark]);
  useEffect(() => {
    const initialize = async () => {
      try {
        await completeLogin();
        if (!isConfigured()) { setStatus("Dropbox app key is not configured."); return; }
        if (!isLoggedIn()) { setStatus("Connect Dropbox to start your log."); return; }
        const saved = await loadWorkoutLog();
        setLogs(saved.sets); setDayNotes(saved.dayNotes); setStatus("");
      } catch { setStatus("Couldn’t load Dropbox. Try reconnecting."); }
    };
    void initialize();
  }, []);

  const selected = exercises.find((item) => item.name === exercise) ?? exercises[0];
  const start = weekStart(date);
  const totals = useMemo(() => logs.filter((entry) => entry.date >= start && entry.date <= new Date(new Date(`${start}T12:00:00`).getTime() + 6 * 86400000).toISOString().slice(0, 10)).reduce<Record<Pattern, number>>((sum, entry) => { sum[entry.pattern] += 1; return sum; }, { push: 0, pull: 0, legs: 0 }), [logs, start]);
  const history = useMemo(() => Object.entries(logs.filter((entry) => entry.date <= date).reduce<Record<string, SetLog[]>>((groups, entry) => { (groups[entry.date] ??= []).push(entry); return groups; }, { [date]: [] })).sort(([a], [b]) => b.localeCompare(a)).slice(0, 14), [logs, date]);
  const persist = async (nextSets: SetLog[], nextDayNotes = dayNotes) => { setLogs(nextSets); setDayNotes(nextDayNotes); setStatus("Saving…"); try { await saveWorkoutLog({ sets: nextSets, dayNotes: nextDayNotes }); setStatus(""); } catch { setStatus("Save failed. Check Dropbox and try again."); } };
  const addSet = () => { if (!reps.trim()) return; void persist([...logs, { id: crypto.randomUUID(), date, exercise: selected.name, pattern: selected.pattern, reps: reps.trim() }]); setReps(""); };
  const updateDayNote = (note: string) => { const next = { ...dayNotes, [date]: note }; void persist(logs, next); };

  if (!isConfigured() || !isLoggedIn()) return <main className="auth"><h1>Exercise log</h1><p>{status}</p><button onClick={() => void startLogin()} disabled={!isConfigured()}>Connect Dropbox</button>{!isConfigured() && <p className="help">Add `VITE_DROPBOX_CLIENT_ID` to `.env.local` first.</p>}</main>;
  return <main>
    <header><h1>Exercise log</h1><div className="header-right"><label>Date <input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><button className="theme-toggle" onClick={() => setDark((value) => !value)}>{dark ? "Light" : "Dark"}</button><button className="link-button" onClick={() => { logout(); window.location.reload(); }}>Disconnect</button></div></header>
    <section className="week"><h2>This week <small>Sunday–Saturday</small></h2><div>{(["push", "pull", "legs"] as Pattern[]).map((pattern) => <p key={pattern}><strong>{totals[pattern]}</strong> {patternNames[pattern]} set{totals[pattern] === 1 ? "" : "s"}</p>)}</div><p className="weekly-guide">Orientation: aim for roughly 10–20 hard sets per pattern each week, building up gradually.</p></section>
    <section className="add"><h2>Add a set</h2><div className="form"><label>Exercise<select value={exercise} onChange={(event) => setExercise(event.target.value)}>{(["push", "pull", "legs"] as Pattern[]).map((pattern) => <optgroup key={pattern} label={patternNames[pattern]}>{exercises.filter((item) => item.pattern === pattern).map((item) => <option key={item.name}>{item.name}</option>)}</optgroup>)}</select></label><label className="reps">Reps<input inputMode="numeric" value={reps} placeholder="Reps" onChange={(event) => setReps(event.target.value)} /></label><button className="add-button" onClick={addSet}>Add to today</button></div><p className="hint">Each click adds one hard set. Add another when you’re ready.</p><label className="day-notes">Notes for this day<textarea value={dayNotes[date] ?? ""} placeholder="How did it feel? Anything to remember?" onChange={(event) => updateDayNote(event.target.value)} /></label></section>
    <section className="history"><h2>Exercise history</h2>{history.map(([day, entries]) => <div className={`history-day${day === date ? " current-day" : ""}`} key={day}><strong>{day === date ? `Today · ${formatDate(day)}` : formatDate(day)}</strong><div>{entries.length === 0 ? <p className="empty">No sets logged yet.</p> : <ul>{entries.map((entry) => <li key={entry.id}>{entry.exercise} · {entry.reps} reps<button onClick={() => void persist(logs.filter((item) => item.id !== entry.id))}>Delete</button></li>)}</ul>}{dayNotes[day] && <p className="saved-day-note">{dayNotes[day]}</p>}</div></div>)}</section>
    <footer>{status || "Counts are hard sets. Keep the movement choices simple; use variations when you want or need them."}</footer>
  </main>;
}

createRoot(document.getElementById("root")!).render(<App />);
