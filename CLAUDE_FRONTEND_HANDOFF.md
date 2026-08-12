# Workout tracker — frontend handoff

## Product in one sentence

A deliberately plain, K Boges–inspired exercise log: log one hard set at a time, see weekly Push / Pull / Legs set totals, and leave one continuing note per day.

## The user’s intent

- This is **not** a prescriptive workout generator. It should make it easy to accumulate hard sets across a week, without punishing skipped days.
- Primary training pattern is high-frequency basics: push, pull, legs. Current likely exercises are push-ups, pull-ups, and a squat/lunge variation.
- Weekly orientation is roughly **10–20 hard sets per pattern**, increased gradually only as recovery allows. It is an orienting note, not a progress bar, target widget, or rule enforcer.
- The user prefers small, repeatable bouts over a “crushing workout” UI. They may do less pull volume at first because strict pull-ups are currently only about 1–3 reps.
- Shoulder safety matters. Avoid UI language that pressures maxing out or accumulating volume blindly.
- The user explicitly wants the site **simple and less pretty**: minimal, calm, almost utilitarian. No card-heavy dashboard, gradients, gamification, or elaborate coaching chrome.
- “Today” means the date currently selected in the date picker—not necessarily the real calendar day. History should show the selected day and earlier days only.

## Current app behavior to preserve

- One set per action: choose an exercise, enter reps, click “Add to today.” There is deliberately no set-count control or multi-set batch entry.
- Each set has a pattern (`push`, `pull`, `legs`), exercise, reps, date, and ID.
- One editable **note per day**, not notes per exercise/set. The note is visible in the edit field for the selected day; it is displayed in history only for earlier days, to avoid duplicating it in the selected/current day block.
- Weekly totals count hard sets by pattern, for the Sunday–Saturday week containing the selected date.
- History groups same-exercise sets for a day. Desired presentation is conceptually:

  ```text
  Today
  Wed, Aug 12        Push (Push-up)
                       3 reps   Delete
                       3 reps   Delete
  ```

- Date controls: previous-day arrow; date picker; next-day arrow only if looking at a past day. The user asked for the previous arrow immediately to the left of the date field.
- Header: theme and Disconnect controls occupy their own line, separate from date navigation.
- Dark mode is supported, with a toggle. The initial render should honor stored theme without a white flash.
- Initial page load should wait for Dropbox data instead of showing zero totals/history and then popping in the loaded data.
- Notes save after 1.5 seconds of idle time; set add/delete saves immediately. Writes should remain serialized to prevent overlapping Dropbox uploads.
- If a Dropbox save fails, surface the actual useful reason (especially expired auth), not just a generic “Save failed.”

## Recent visual feedback / details

- Increase text slightly for readability; current UI was intentionally bumped from a small 14px baseline to 16px.
- Give the weekly orientation sentence a little more space above it.
- “This week” should show its actual range, e.g. `8/9–8/15`, not `Sunday–Saturday`.
- Selected day in history should be subtly privileged (slight background / horizontal boundaries), but remain plain.
- For the selected day, show `Today` on one line and the formatted date underneath, with no dot separator.
- Delete remains available on individual sets.
- Remove redundant helper/footer copy. Specifically, do **not** restore:
  - “Each click adds one hard set…”
  - “Counts are hard sets…” footer

## Exercises currently exposed

- Push: Push-up, Diamond push-up, Deficit push-up, Incline push-up, Ring push-up, Weighted push-up
- Pull: Pull-up, Chin-up, Wide pull-up, Ring row, Inverted row
- Legs: Split squat, Bulgarian split squat, Squat, Walking lunge, Weighted split squat

Exercise choices are intentionally flexible. Variations are for progression, comfort, and managing overuse—not for collecting many exercises.

## Data / backend

- This is a static React/Vite app, not a server database.
- Dropbox is the shared backend for both local and production. Both use the same Dropbox app folder and the same `exercise-log.json`.
- The current desired schema is clean and uniform; treat future schema changes as real migrations, as if this were a relational database. Do not support multiple old shapes indefinitely “for compatibility.”

  ```ts
  type SetLog = {
    id: string;
    date: string;       // YYYY-MM-DD
    exercise: string;
    pattern: "push" | "pull" | "legs";
    reps: string;
  };

  type WorkoutLog = {
    sets: SetLog[];
    dayNotes: Record<string, string>; // keyed by YYYY-MM-DD
  };
  ```

- If a migration is needed, version the stored document and migrate it forward explicitly. No meaningful user data existed when this clean schema was chosen.
- OAuth uses Dropbox PKCE client-side. Never commit app secrets or tokens. The public app key is injected as `VITE_DROPBOX_CLIENT_ID` in `.env.local` locally and must be present at build time for production.

## Deployment / local development

- Source repo: `https://github.com/jondubin/workout-log`
- Live site: `https://jonathandub.in/workout/`
- GitHub Pages is the separate user-site repo `jondubin/jondubin.github.io`; the built static output is copied into its `workout/` directory.
- Vite must build with base `/workout/` in production. A previous mistake generated `/assets/...` URLs and broke the live subpath.
- Local dev is port 3000: `npm run dev` from this project directory.
- The Dropbox app redirect URIs must include:
  - `http://localhost:3000/`
  - `https://jonathandub.in/workout/`
- Required Dropbox scopes: `files.content.read`, `files.content.write`; access type: App folder.

## Important project files

- `src/main.tsx` — UI, state, grouping, debounce/queue behavior
- `src/log-store.ts` — current schema and Dropbox JSON file handling
- `src/dropbox-auth.ts` — PKCE auth/token handling
- `src/style.css` — intentionally small custom CSS
- `vite.config.ts` — port 3000 and production `/workout/` base
- `health-fitness-os.md` — fitness/programming context
- `KBOGES_RESEARCH.md` — source/research notes

## Scope for a frontend pass

Keep the underlying interaction/data semantics above. Improve layout, spacing, typography, and mobile use if helpful, but preserve the minimalist spirit and avoid adding new tracking inputs (RIR, load, ratings, workout plans, etc.) unless the user separately asks.

