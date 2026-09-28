# GCE Learning Session — Backend

Node.js + Express backend for the GCE Learning Session platform, split into
three folders so each of the three backend team members can work
independently with minimal merge conflicts. A fourth teammate owns the
frontend (the existing `index.html`, `pages/*.html`, `css/`, `js/` files).

## Folder structure

```
gce-backend/
├── package.json              <- shared dependencies, run from here
├── .env.example               <- copy to .env and fill in
├── member1-content/           <- Subjects & Papers
├── member2-quiz-scoring/      <- Quiz Engine & Scoring
└── member3-infra-users/       <- Server, Auth, Integration (entry point lives here)
```

Each member folder has its own `README.md` explaining their endpoints,
files, and what to build next.

| Member | Module | Endpoints they own |
|--------|--------|----------------------|
| 1 | Content (Subjects & Papers) | `/api/subjects`, `/api/papers/*` |
| 2 | Quiz Engine & Scoring | `/api/quiz/*`, `/api/scores/*` |
| 3 | Infrastructure, Users & Integration | `/api/auth/*`, plus `server.js` which mounts everything |

## How to run it

```bash
npm install
cp .env.example .env
npm start
```

The server starts on `http://localhost:3000` by default. Try:
```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/subjects
```

For auto-restart while developing:
```bash
npm run dev
```

## Connecting the frontend

The frontend now lives in `../frontend` and is already wired to this API
(`frontend/js/api.js` holds the shared `fetch` helper). `server.js` also
serves it, so one command runs everything:

```bash
npm install
npm start
# open http://localhost:3000
```

You can also open the frontend from a separate dev server (Live Server on
`:5500`, `npx serve`) or straight from `index.html`; `api.js` then calls the
backend at `http://localhost:3000` (CORS is enabled).

| Page | API calls |
|------|-----------|
| `subjects.html` | `GET /api/subjects` |
| `papers.html` | `GET /api/subjects/:id`, `GET /api/papers/:subjectId` |
| `learning.html` | `GET /api/papers/:subjectId/:year/:paper` |
| `quiz.html` | `GET /api/quiz/:subjectId`, `POST /api/quiz/submit` |
| `login.html` | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/scores/:userId` |

## Testing endpoints without a frontend

Use `curl`, Postman, or Thunder Client (VS Code extension):

```bash
curl http://localhost:3000/api/subjects
curl http://localhost:3000/api/papers/mathematics
curl http://localhost:3000/api/papers/mathematics/2025/1
curl http://localhost:3000/api/quiz/mathematics
curl -X POST http://localhost:3000/api/quiz/submit \
  -H "Content-Type: application/json" \
  -d '{"subjectId":"mathematics","answers":[1,2,1,2,1,1,2,2,1,1]}'
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"leprince","password":"secret123"}'
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"leprince","password":"secret123"}'
```

## Storage

All three modules currently store data in flat JSON files under each
folder's `data/`. This is intentional — it lets everyone build and test
without setting up a database first. `member3-infra-users/config/db.js` is
the single place to swap this for SQLite, MongoDB, or Postgres later
without changing how the controllers are called from the routes.

## Access rules

- `POST /api/quiz/submit` works for guests (saved as `guest`). With a valid
  `Authorization: Bearer <token>` the score is saved under that user. A
  `userId` in the body is ignored.
- `GET /api/scores/:userId` and `POST /api/scores` require login, and users can
  only read/write their own scores.
