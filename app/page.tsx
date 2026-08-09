"use client";

import { useEffect, useMemo, useState } from "react";

type SetLog = { reps: string; rir: string; quality: number };
type Exercise = { id: string; name: string; variation: string; sets: SetLog[]; notes: string };

const freshSet = (): SetLog => ({ reps: "", rir: "2", quality: 4 });

const starterExercises = (): Exercise[] => [
  { id: "push", name: "Push", variation: "Push-up", sets: [freshSet(), freshSet()], notes: "" },
  { id: "pull", name: "Pull", variation: "Pull-up / row", sets: [freshSet(), freshSet()], notes: "" },
  { id: "squat", name: "Squat", variation: "Bodyweight squat", sets: [freshSet(), freshSet()], notes: "" },
  { id: "hinge", name: "Hinge / core", variation: "Hip hinge or trunk work", sets: [freshSet()], notes: "" },
];

const today = new Date().toISOString().slice(0, 10);

export default function Home() {
  const [date, setDate] = useState(today);
  const [structure, setStructure] = useState("Practice sets");
  const [readiness, setReadiness] = useState(4);
  const [exercises, setExercises] = useState<Exercise[]>(starterExercises);
  const [sessionNote, setSessionNote] = useState("");
  const [saved, setSaved] = useState<Record<string, { exercises: Exercise[]; structure: string; readiness: number; note: string }>>({});

  useEffect(() => {
    const stored = localStorage.getItem("kboges-tracker");
    if (stored) setSaved(JSON.parse(stored));
  }, []);

  useEffect(() => {
    const entry = saved[date];
    if (entry) {
      setExercises(entry.exercises);
      setStructure(entry.structure);
      setReadiness(entry.readiness);
      setSessionNote(entry.note);
    } else {
      setExercises(starterExercises());
      setStructure("Practice sets");
      setReadiness(4);
      setSessionNote("");
    }
  }, [date]);

  const totalSets = useMemo(
    () => exercises.reduce((sum, exercise) => sum + exercise.sets.filter((set) => set.reps).length, 0),
    [exercises],
  );

  const updateExercise = (id: string, next: Partial<Exercise>) =>
    setExercises((current) => current.map((exercise) => (exercise.id === id ? { ...exercise, ...next } : exercise)));

  const updateSet = (id: string, index: number, next: Partial<SetLog>) =>
    setExercises((current) => current.map((exercise) =>
      exercise.id === id
        ? { ...exercise, sets: exercise.sets.map((set, setIndex) => (setIndex === index ? { ...set, ...next } : set)) }
        : exercise,
    ));

  const saveSession = () => {
    const next = { ...saved, [date]: { exercises, structure, readiness, note: sessionNote } };
    setSaved(next);
    localStorage.setItem("kboges-tracker", JSON.stringify(next));
  };

  const addExercise = () => setExercises((current) => [...current, { id: crypto.randomUUID(), name: "New pattern", variation: "Choose a variation", sets: [freshSet()], notes: "" }]);

  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">HIGH-FREQUENCY CALISTHENICS</p>
          <h1>Move well.<br /><em>Often.</em></h1>
          <p className="intro">A daily practice log built around the basics: controlled reps, a few reps in reserve, and enough volume you can recover from tomorrow.</p>
        </div>
        <div className="framework-card">
          <img src="/simple-framework.png" alt="Simple framework for fitness" />
          <span>YOUR COMPASS, NOT A RULEBOOK</span>
        </div>
      </section>

      <section className="control-bar" aria-label="Session settings">
        <label><span>Date</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        <label><span>Set structure</span><select value={structure} onChange={(event) => setStructure(event.target.value)}><option>Practice sets</option><option>Simple straight sets</option><option>Density block</option><option>Easy volume day</option><option>Freestyle practice</option></select></label>
        <div className="readiness"><span>Readiness</span><div className="readiness-dots">{[1, 2, 3, 4, 5].map((number) => <button key={number} className={number <= readiness ? "active" : ""} onClick={() => setReadiness(number)} aria-label={`Readiness ${number} of 5`}>{number}</button>)}</div></div>
        <button className="save-button" onClick={saveSession}>Save session <span>→</span></button>
      </section>

      <section className="guidance">
        <p><strong>Today’s cue:</strong> Leave 1–3 clean reps in reserve. If form changes, the set is over.</p>
        <span>{totalSets} logged working {totalSets === 1 ? "set" : "sets"}</span>
      </section>

      <section className="tracker" aria-label="Exercise tracker">
        <div className="tracker-heading"><div><p className="eyebrow">SESSION LOG</p><h2>Build your practice</h2></div><p>Rotate variations when a pattern feels worn down. Keep the motor patterns familiar.</p></div>
        <div className="exercise-list">
          {exercises.map((exercise, exerciseIndex) => (
            <article className="exercise-card" key={exercise.id}>
              <div className="exercise-number">{String(exerciseIndex + 1).padStart(2, "0")}</div>
              <div className="exercise-main">
                <input className="pattern-input" aria-label="Movement pattern" value={exercise.name} onChange={(event) => updateExercise(exercise.id, { name: event.target.value })} />
                <input className="variation-input" aria-label="Exercise variation" value={exercise.variation} onChange={(event) => updateExercise(exercise.id, { variation: event.target.value })} />
              </div>
              <div className="sets-area">
                <div className="set-labels"><span>SET</span><span>REPS / TIME</span><span>RIR</span><span>FORM</span></div>
                {exercise.sets.map((set, setIndex) => <div className="set-row" key={setIndex}>
                  <b>{setIndex + 1}</b>
                  <input inputMode="decimal" aria-label={`Set ${setIndex + 1} reps or time`} placeholder="—" value={set.reps} onChange={(event) => updateSet(exercise.id, setIndex, { reps: event.target.value })} />
                  <input inputMode="numeric" aria-label={`Set ${setIndex + 1} reps in reserve`} value={set.rir} onChange={(event) => updateSet(exercise.id, setIndex, { rir: event.target.value })} />
                  <select aria-label={`Set ${setIndex + 1} form quality`} value={set.quality} onChange={(event) => updateSet(exercise.id, setIndex, { quality: Number(event.target.value) })}>{[5, 4, 3, 2, 1].map((score) => <option key={score} value={score}>{"●".repeat(score)}{"○".repeat(5 - score)}</option>)}</select>
                </div>)}
                <button className="add-set" onClick={() => updateExercise(exercise.id, { sets: [...exercise.sets, freshSet()] })}>+ Add set</button>
              </div>
              <input className="note-input" aria-label={`${exercise.name} note`} placeholder="Form cue / note" value={exercise.notes} onChange={(event) => updateExercise(exercise.id, { notes: event.target.value })} />
            </article>
          ))}
        </div>
        <button className="add-pattern" onClick={addExercise}>+ Add another movement pattern</button>
      </section>

      <section className="reflection">
        <div><p className="eyebrow">CLOSE THE LOOP</p><h2>What did you notice?</h2><p>Progress can be more control, a fuller range, better connection, or simply another week of good training.</p></div>
        <textarea aria-label="Session reflection" value={sessionNote} onChange={(event) => setSessionNote(event.target.value)} placeholder="e.g. Neutral-grip pull-ups felt smooth. Keep the same variation tomorrow; take an easy squat day." />
      </section>
      <footer>Inspired by the high-frequency, basics-first training philosophy of Kyle Boggeman. Your data stays in this browser.</footer>
    </main>
  );
}
