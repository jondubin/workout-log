"use client";

import { useEffect, useMemo, useState } from "react";

type Pattern = "push" | "pull" | "legs";
type Exercise = { name: string; pattern: Pattern };
type SetLog = { id: string; date: string; exercise: string; pattern: Pattern; reps: string; notes: string };

const exercises: Exercise[] = [
  { name: "Push-up", pattern: "push" }, { name: "Diamond push-up", pattern: "push" }, { name: "Deficit push-up", pattern: "push" }, { name: "Incline push-up", pattern: "push" }, { name: "Ring push-up", pattern: "push" }, { name: "Weighted push-up", pattern: "push" },
  { name: "Pull-up", pattern: "pull" }, { name: "Chin-up", pattern: "pull" }, { name: "Wide pull-up", pattern: "pull" }, { name: "Ring row", pattern: "pull" }, { name: "Inverted row", pattern: "pull" },
  { name: "Split squat", pattern: "legs" }, { name: "Bulgarian split squat", pattern: "legs" }, { name: "Squat", pattern: "legs" }, { name: "Walking lunge", pattern: "legs" }, { name: "Weighted split squat", pattern: "legs" },
];
const patternNames: Record<Pattern, string> = { push: "Push", pull: "Pull", legs: "Legs" };
const today = new Date().toISOString().slice(0, 10);
const weekStart = (value: string) => { const d = new Date(`${value}T12:00:00`); d.setDate(d.getDate() - d.getDay()); return d.toISOString().slice(0, 10); };
const formatDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

export default function Home() {
  const [date, setDate] = useState(today);
  const [logs, setLogs] = useState<SetLog[]>([]);
  const [darkMode, setDarkMode] = useState(false);
  const [exercise, setExercise] = useState(exercises[0].name);
  const [reps, setReps] = useState([""]);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("kboges-set-log");
    if (saved) setLogs(JSON.parse(saved));
    setDarkMode(document.documentElement.dataset.theme === "dark");
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = darkMode ? "dark" : "light"; }, [darkMode]);
  const saveLogs = (next: SetLog[]) => { setLogs(next); localStorage.setItem("kboges-set-log", JSON.stringify(next)); };
  const selected = exercises.find((item) => item.name === exercise) ?? exercises[0];
  const start = weekStart(date);
  const totals = useMemo(() => logs.filter((entry) => entry.date >= start && entry.date <= new Date(new Date(`${start}T12:00:00`).getTime() + 6 * 86400000).toISOString().slice(0, 10)).reduce<Record<Pattern, number>>((sum, entry) => { sum[entry.pattern] += 1; return sum; }, { push: 0, pull: 0, legs: 0 }), [logs, start]);
  const todayLogs = logs.filter((entry) => entry.date === date);
  const groupedHistory = useMemo(() => Object.entries(logs.reduce<Record<string, SetLog[]>>((groups, entry) => { (groups[entry.date] ??= []).push(entry); return groups; }, {})).sort(([a], [b]) => b.localeCompare(a)).slice(0, 14), [logs]);
  const addSets = () => { const valid = reps.filter((rep) => rep.trim()); if (!valid.length) return; saveLogs([...logs, ...valid.map((rep) => ({ id: crypto.randomUUID(), date, exercise: selected.name, pattern: selected.pattern, reps: rep.trim(), notes }))]); setReps([""]); setNotes(""); };
  const deleteSet = (id: string) => saveLogs(logs.filter((entry) => entry.id !== id));
  const changeSetCount = (amount: number) => setReps((current) => amount > 0 ? [...current, ""] : current.length > 1 ? current.slice(0, -1) : current);

  return <main>
    <header><h1>Exercise log</h1><div className="header-right"><label>Date <input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><button className="theme-toggle" onClick={() => { const next = !darkMode; setDarkMode(next); localStorage.setItem("kboges-theme", next ? "dark" : "light"); }}>{darkMode ? "Light" : "Dark"}</button></div></header>
    <section className="week"><h2>This week <small>Sunday–Saturday</small></h2><div>{(["push", "pull", "legs"] as Pattern[]).map((pattern) => <p key={pattern}><strong>{totals[pattern]}</strong> {patternNames[pattern]} set{totals[pattern] === 1 ? "" : "s"}</p>)}</div><p className="weekly-guide">Orientation: aim for roughly 10–20 hard sets per pattern each week, building up gradually.</p></section>

    <section className="add"><h2>Add sets for {date === today ? "today" : formatDate(date)}</h2><div className="form"><label>Exercise<select value={exercise} onChange={(event) => setExercise(event.target.value)}>{(["push", "pull", "legs"] as Pattern[]).map((pattern) => <optgroup key={pattern} label={patternNames[pattern]}>{exercises.filter((item) => item.pattern === pattern).map((item) => <option key={item.name}>{item.name}</option>)}</optgroup>)}</select></label><div className="set-count"><span>Sets</span><button onClick={() => changeSetCount(-1)}>−</button><b>{reps.length}</b><button onClick={() => changeSetCount(1)}>+</button></div><label className="reps">Reps{reps.map((rep, index) => <input key={index} inputMode="numeric" value={rep} placeholder={`Set ${index + 1}`} onChange={(event) => setReps((current) => current.map((value, currentIndex) => currentIndex === index ? event.target.value : value))} />)}</label><label className="notes-field">Notes <input value={notes} placeholder="optional" onChange={(event) => setNotes(event.target.value)} /></label><button className="add-button" onClick={addSets}>Add to today</button></div><p className="hint">Each row is one hard set. Add another batch later if you train again.</p></section>

    <section className="today"><h2>Today’s log</h2>{todayLogs.length === 0 ? <p className="empty">No sets logged.</p> : <table><thead><tr><th>Exercise</th><th>Reps</th><th>Notes</th><th></th></tr></thead><tbody>{todayLogs.map((entry) => <tr key={entry.id}><td>{entry.exercise}</td><td>{entry.reps}</td><td>{entry.notes}</td><td><button onClick={() => deleteSet(entry.id)}>Delete</button></td></tr>)}</tbody></table>}</section>

    <section className="history"><h2>Exercise history</h2>{groupedHistory.length === 0 ? <p className="empty">Your logged sets will appear here.</p> : groupedHistory.map(([day, entries]) => <div className="history-day" key={day}><strong>{formatDate(day)}</strong><ul>{entries.map((entry) => <li key={entry.id}>{entry.exercise} · {entry.reps} reps{entry.notes ? ` · ${entry.notes}` : ""}<button onClick={() => deleteSet(entry.id)}>Delete</button></li>)}</ul></div>)}</section>
    <footer>Counts are hard sets. Keep the movement choices simple; use variations when you want or need them.</footer>
  </main>;
}
