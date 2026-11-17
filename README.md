# Listing Search Assessment

A Python (FastAPI) API and React + TypeScript frontend for listing search,
relevance ranking, pagination, and city suggestions.

## Quick start

**Prerequisites**

- [Node.js](https://nodejs.org/) 20.19+ or 22.12+ (includes npm)
- [uv](https://docs.astral.sh/uv/getting-started/installation/), the Python
  package manager. It downloads Python 3.13 automatically if needed, so you
  don't need to install Python yourself.

```bash
# macOS / Linux: install uv (skip if you already have it)
curl -LsSf https://astral.sh/uv/install.sh | sh
```

**Install and run** from the project root:

```bash
npm install   # installs root, frontend, and backend dependencies
npm start     # starts the API and the UI together
```

Then open <http://127.0.0.1:5173>.

`npm start` runs both servers in one terminal, with logs labeled `API` and
`UI`. Press **Ctrl+C** once to stop both. Ports 5173 (UI) and 8000 (API) must
be free.

## Commands

All commands run from the project root.

| Command            | What it does                                                  |
| ------------------ | ------------------------------------------------------------- |
| `npm install`      | Install all dependencies from the lockfiles                   |
| `npm start`        | Run the API (port 8000) and UI (port 5173) with live reload   |
| `npm test`         | Backend tests, frontend type-check, and frontend format check |
| `npm run test:api` | Backend tests only (no running server needed)                 |
| `npm run test:ui`  | Frontend type-check and format check only                     |
| `npm run build`    | Type-check and build the frontend into `frontend/dist`        |

Dependencies are pinned by `package-lock.json` (root and `frontend/`) and
`backend/uv.lock`. There is no Python build step. The frontend has no automated
React behavior tests; browser flows were checked by hand against the running API.

Useful URLs while running:

- App: <http://127.0.0.1:5173>
- Interactive API docs: <http://127.0.0.1:8000/docs>
- Health check: <http://127.0.0.1:8000/api/health> (returns `{"status": "ok"}`)

### Troubleshooting

- **`uv: command not found`** right after installing uv: open a new terminal,
  or run `export PATH="$HOME/.local/bin:$PATH"`, then `npm install` again.
- **Port already in use**: stop any servers you started earlier, then rerun
  `npm start`.
- **Running the servers separately**: `cd backend && uv run fastapi dev main.py`
  for the API, and `cd frontend && npm run dev` for the UI.

## Using the app

Enter filters and click **Search listings** to apply them. Paging uses the last
submitted filters; each new search starts at page one. **Reset** clears all
filters. Budget affects relevance, while minimum and maximum prices filter
results. City suggestions come from the API, and you can also enter a city
manually.

## Project structure

- `backend/main.py`: loads the sample dataset at startup and registers routes.
- `backend/models.py`: typed listing data, query validation, and response models.
- `backend/search.py`: plain Python filtering, scoring, sorting, and pagination.
- `backend/tests/`: API and search behavior tests, using FastAPI's test client.
- `frontend/src/App.tsx`: search form and result display.
- `frontend/src/api.ts`: HTTP calls and error handling.
- `frontend/src/interfaces/`: shared TypeScript interfaces, one per file.
- `data/sample_listings.json`: sample listing data loaded by the API.
- `scripts/backend.mjs`: small helper that runs `uv` inside `backend/` from npm
  scripts.

The frontend intentionally uses React state and `fetch` without extra
state-management or data-fetching libraries. Superseded requests are cancelled.
Styling uses local system fonts and needs no external services. In development,
Vite proxies `/api` to the API on port 8000; a production deployment would need
a backend or reverse proxy to serve `/api` alongside the built assets.

Linting and formatting:

```bash
cd backend && uv run ruff check . && uv run ruff format --check .
cd frontend && npm run format
```

## Search API

`GET /api/listings` accepts these optional query parameters:

- `minPrice`, `maxPrice`: inclusive price bounds, each at least zero.
- `minBedrooms`: inclusive minimum, a nonnegative integer.
- `city`: exact match after trimming and case normalization.
- `keyword`: case-insensitive substring match against the description only.
- `targetBudget`: positive number used for ranking, not filtering.
- `page`: one-based page number, defaults to 1.
- `pageSize`: integer from 1 through 100, defaults to 5.

All supplied filters must match. Omit optional numeric inputs when empty. Blank
city and keyword inputs apply no filter. An unknown city returns HTTP 200 with
an empty list. Invalid numbers, reversed price bounds, or invalid pagination
return HTTP 422 with FastAPI's `detail` array of validation errors.

Example request:

```bash
curl 'http://127.0.0.1:8000/api/listings?city=Springfield&minBedrooms=3&targetBudget=525000&page=1&pageSize=5'
```

The response has `items`, `total`, `page`, `pageSize`, and `totalPages`. Each item
contains the original listing fields plus `relevanceScore` (0–100). `total` counts
all matches before pagination. No matches means `totalPages: 0`; a page beyond
the last page returns empty `items` while retaining the total and requested page.
Use `source` and `id` together for React keys, since IDs are unique per feed.

`GET /api/cities` returns a sorted JSON array of distinct city names for a select
input. Both endpoints are documented with schemas and interactive requests at
<http://127.0.0.1:8000/docs>.

## Relevance scoring and trade-offs

Scores favor listings near the target budget and listings posted recently:

```text
age_days = max(0, today - listedDate)
recency = 30 / (30 + age_days)
budget_match = max(0, 1 - abs(price - targetBudget) / targetBudget)
score = 100 * (0.7 * budget_match + 0.3 * recency)
```

If no budget is supplied, the score is `100 * recency`. For a listing exactly
at budget, today's score is 100 and a 30-day-old listing scores 85. Prices equally
above and below the budget get the same budget score; use `maxPrice` for a hard
ceiling. The 70/30 weighting and 30-day decay are explainable choices, not learned
parameters. Future dates count as age zero. Production requests use today's UTC
date; tests pass a fixed date so results do not drift.

Results sort by full-precision score descending, listing date newest first, then
source and ID ascending for deterministic ties. Pagination happens after sorting.
The UI can round scores for display without affecting ranking.

The small JSON dataset is validated once at startup and searched in memory. All
statuses are included. Similar properties from different feeds remain separate;
deduplication and status filtering are not part of the base requirements. Keyword
search is literal: “pets” also matches “no pets.” Data changes require a server
restart. This implementation favors clarity for the supplied dataset; a larger
dataset would need a different storage/search approach.
