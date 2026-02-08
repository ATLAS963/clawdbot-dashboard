# Test Coverage Analysis

## Current State

The codebase has **zero test coverage**. There are no test files, no testing framework installed, no test scripts in `package.json`, and no CI step that runs tests before merging.

**Source files (758 lines total):**

| File | Lines | Purpose |
|------|-------|---------|
| `api/_db.js` | 152 | Database layer (Supabase + in-memory fallback), auth, CORS, data mapping |
| `api/tasks/index.js` | 47 | `GET /api/tasks` and `POST /api/tasks` endpoints |
| `api/tasks/[id].js` | 50 | `PATCH /api/tasks/:id` and `DELETE /api/tasks/:id` endpoints |
| `public/script.js` | 509 | Full client-side application (auth, rendering, drag-and-drop, API calls) |

---

## Proposed Test Areas (Priority Order)

### 1. Database Module — `api/_db.js` (High Priority)

This is the core data layer. A bug here affects every endpoint.

**What to test:**

- **`checkAuth(req)`** — The sole authentication gate for the entire API.
  - Returns `true` when `CLAWDBOT_API_KEY` env var is unset (dev mode).
  - Returns `true` when the `Authorization: Bearer <token>` header matches the env var.
  - Returns `false` for missing header, wrong token, empty token.
  - Handles the `Bearer ` prefix correctly and also accepts raw tokens.

- **`toApi(row)` / `toDb(obj)`** — snake_case-to-camelCase mapping.
  - Converts all fields correctly in both directions.
  - Handles `null`/`undefined` values for optional fields (`description`, `completed_at`).
  - `toDb` only includes fields that are present in the input (partial updates).

- **In-memory CRUD (`listTasks`, `createTask`, `updateTask`, `deleteTask`)** — when Supabase is not configured.
  - `listTasks()` returns a copy of the seed data array.
  - `createTask()` generates a unique ID, prepends to the array, and returns the task.
  - `updateTask()` merges updates into the existing task and returns it; returns `null` for unknown IDs.
  - `deleteTask()` removes the task from the array and returns it; returns `null` for unknown IDs.

**Why this matters:** Auth bypass or data corruption bugs here are invisible without tests. The in-memory fallback is used during local development, so CRUD correctness should be verified.

---

### 2. API Endpoints — `api/tasks/index.js` and `api/tasks/[id].js` (High Priority)

These are the public-facing HTTP handlers. Tests should mock the `_db` module and verify request/response behavior.

**What to test for `tasks/index.js`:**

- **GET /api/tasks** — Returns `{ tasks, lastUpdated }` with a 200 status.
- **POST /api/tasks** — Validates that `title` is present and non-empty (400 otherwise). Defaults `status` to `"todo"` and `category` to `"development"` for invalid/missing values. Sets `completedAt` when status is `"done"`. Restricts `agent` to `"bot"` or `"manual"`.
- **OPTIONS** — Returns 204 (CORS preflight).
- **Other methods** — Returns 405.
- **Missing auth** — Returns 401.
- **DB errors** — Returns 500.

**What to test for `tasks/[id].js`:**

- **PATCH /api/tasks/:id** — Accepts partial updates. Validates `status` and `category` against allowlists. Auto-sets `completedAt` when status changes to `"done"`; clears it otherwise. Returns 404 for unknown IDs.
- **DELETE /api/tasks/:id** — Returns the deleted task or 404.
- **Edge case: empty PATCH body** — Should result in a no-op update (not a crash).
- **Edge case: invalid category/status in PATCH** — Silently ignored (not applied to updates). This behavior should be explicitly verified since it differs from POST, which defaults invalid values.

**Why this matters:** The PATCH endpoint has subtle conditional logic around `completedAt` timestamps that is easy to break during refactoring. The difference in validation behavior between POST (defaults invalid values) and PATCH (ignores invalid values) is a potential source of bugs.

---

### 3. Frontend Utility Functions — `public/script.js` (Medium Priority)

The pure functions in `script.js` are easy to unit test and contain meaningful logic.

**What to test:**

- **`escapeHtml(text)`** — Correctly escapes `<`, `>`, `&`, `"`, `'`. Handles `null`/`undefined` input. This is security-critical: it's the only XSS protection in the rendering pipeline.
- **`getISOWeek(date)`** — Returns correct `{ year, week }` for known dates. Handles year boundaries correctly (e.g., Dec 31 might be week 1 of the next year). This uses non-trivial arithmetic that is easy to get wrong.
- **`getWeekRange(year, week)`** — Returns the correct Monday-Sunday date range string for a given ISO week.
- **`isCurrentWeek(year, week)`** — Returns `true` only for the current week.
- **`formatDate(iso)` / `formatTime(iso)`** — Handles `null`/empty input. Produces expected format for valid dates.

**Why this matters:** `escapeHtml` is the only defense against XSS in all task card rendering (`createTaskCard` injects its return value into `innerHTML`). If it fails to escape a character, user-supplied task titles/descriptions could execute arbitrary scripts. `getISOWeek` contains date arithmetic that is notoriously tricky at year boundaries.

---

### 4. Frontend API Layer — `public/script.js` (Medium Priority)

The `apiFetch`, `loadTasks`, `createTask`, `updateTask`, and `deleteTask` functions wrap `fetch()` with auth headers and error handling.

**What to test (mocking `fetch` and DOM):**

- **`apiFetch()`** — Attaches `Authorization` header. On 401, calls `logout()` and throws. On other non-OK responses, throws with status.
- **`loadTasks()`** — On success, sets `tasks` state and calls `render()`. On non-401 failure, shows an error toast and sets `tasks = []`.
- **`authenticate(key)`** — On success, stores key in `localStorage` and shows dashboard. On failure, clears key and shows error UI.
- **`logout()`** — Clears state, localStorage, and shows auth screen.

**Why this matters:** The 401-triggers-logout behavior is an important UX flow. If `apiFetch` doesn't properly propagate or catch errors, the UI can get stuck in an inconsistent state (e.g., dashboard visible but no tasks loading).

---

### 5. Frontend Rendering Logic — `public/script.js` (Lower Priority)

Rendering functions are tightly coupled to the DOM, making them harder to test. However, the logic within them is worth covering.

**What to test (using jsdom):**

- **`renderStats()`** — Produces correct counts for each status.
- **`renderKanban()`** — Sorts tasks newest-first. Places tasks in correct columns. Shows "No tasks" empty state when a column is empty.
- **`renderWeeks()`** — Groups tasks by ISO week. Sorts weeks reverse-chronologically. Uses `completedAt` for done tasks, `createdAt` for others.
- **`renderActivity()`** — Shows only done tasks with `completedAt`, limited to 8, sorted newest-first.

**Why this matters:** These are lower priority because rendering bugs are typically caught visually during development. However, the week-grouping logic in `renderWeeks` is complex enough to warrant tests.

---

## Infrastructure Recommendations

### Testing Framework

Install [Vitest](https://vitest.dev/) — it's lightweight, fast, and works well for both Node.js API tests and jsdom-based frontend tests with zero configuration overhead:

```bash
npm install --save-dev vitest
```

Add a test script to `package.json`:

```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest"
}
```

### Test File Structure

```
tests/
  api/
    _db.test.js           # Auth, data mapping, in-memory CRUD
    tasks-index.test.js   # GET/POST endpoint handler
    tasks-id.test.js      # PATCH/DELETE endpoint handler
  client/
    utils.test.js         # escapeHtml, date functions, getISOWeek
    api.test.js           # apiFetch, loadTasks, auth flow (mocking fetch)
    render.test.js        # Rendering logic (jsdom)
```

### CI Integration

The current `auto-merge.yml` workflow merges `claude/*` branches to `main` with **no checks**. A test step should be added:

```yaml
- name: Run tests
  run: npm ci && npm test
```

This prevents broken code from reaching `main`.

### Coverage Targets

A reasonable starting point:

| Area | Target |
|------|--------|
| `api/_db.js` (auth + data mapping) | 90%+ |
| `api/tasks/*.js` (endpoints) | 85%+ |
| `public/script.js` (utilities) | 90%+ |
| `public/script.js` (API layer) | 80%+ |
| `public/script.js` (rendering) | 60%+ |
| **Overall** | **75%+** |

---

## Summary

The highest-value tests to write first are:

1. **`checkAuth`** — it's the security boundary, 6 lines of code, trivial to test.
2. **`toApi` / `toDb`** — data mapping correctness prevents silent data corruption.
3. **In-memory CRUD operations** — verifiable without any external mocking.
4. **API endpoint handlers** — mock `_db`, verify HTTP status codes and response shapes.
5. **`escapeHtml`** — security-critical, 4 lines of code, trivial to test.
6. **`getISOWeek`** — complex date math, historically a source of off-by-one errors.

These six areas cover the most critical logic with the least test-writing effort.
