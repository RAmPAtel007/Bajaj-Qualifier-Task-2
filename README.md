# TaskFlow

A small task manager with server-computed priority scoring. Each task carries an
importance (1–5) and a due date; the API derives a `priorityScore` on every read
and the React UI sorts the list by that score.

Stack: **MongoDB · Express · React · Node**.

## Layout

```
backend/    Express + Mongoose API, all routes mounted under /bfhl
frontend/   Vite + React app
```

## Backend

### Setup

```bash
cd backend
cp .env.example .env       # set MONGODB_URI
npm install
npm run dev
```

`.env` keys:

| key | purpose |
| --- | --- |
| `PORT` | HTTP port (default 4100) |
| `MONGODB_URI` | MongoDB Atlas connection string |
| `CORS_ORIGIN` | allowed Origin for browsers (`*` is fine while dev) |

### Endpoints (base: `/bfhl`)

| method | path | notes |
| --- | --- | --- |
| `POST` | `/bfhl/tasks` | Create. Rejects past `dueDate`, bad importance, etc. |
| `GET` | `/bfhl/tasks` | List, sorted by `priorityScore` DESC. Filters: `?status=`, `?minImportance=` (combinable). |
| `GET` | `/bfhl/tasks/stats` | **Bonus** — totals + breakdowns via MongoDB aggregation. |
| `PATCH` | `/bfhl/tasks/:id` | Partial update. Whitelisted fields only. |
| `DELETE` | `/bfhl/tasks/:id` | Delete; `204` on success, `404` if already gone. |

### Priority score

For every task on read:

```
completed             -> 0
otherwise             -> (importance * 10) + (100 / max(daysUntilDue, 1))
                          rounded to 2 decimals
```

`daysUntilDue` is the floor of the day delta between now and `dueDate`. The
divisor is clamped to 1 so sub-day or past due dates don't blow up the formula.

### Aggregation (bonus)

`/bfhl/tasks/stats` does everything in a single MongoDB pipeline with `$facet`:
one branch computes `totalTasks`, `pendingTasks`, `completedTasks`,
`averageImportance`, `overdueTasks` via `$cond` + `$sum`; another branch buckets
by `importance` with `$group`. Nothing is computed in Node.

### Dry-run

`backend/test/dryrun.js` wipes the collection then exercises validation,
scoring math, sort order, filter combinations, PATCH/DELETE edge cases, and
the stats endpoint. Run after the server is up:

```bash
node test/dryrun.js
```

## Frontend

```bash
cd frontend
cp .env.example .env       # VITE_API_URL=http://localhost:4100 for local dev
npm install
npm run dev
```

The UI is a two-column layout: a sidebar with the create form and filters,
and a main column with the sorted task list. A small stats card sits on top
showing the aggregation results. High-priority tasks (`score >= 50`) are
highlighted; overdue pending tasks get a red accent.

Loading, empty, and error states are all handled visibly.
