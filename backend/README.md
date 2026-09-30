# GCE Student Learning Platform - Backend

Node.js + Express API. It also serves the frontend (the `../frontend` folder), so one command runs everything.

## Folder structure

```
backend/
├── server.js          entry point: middleware, routes, static frontend, error handler
├── package.json       dependencies and scripts
├── .env.example       copy to .env and fill in
├── config/db.js       central list of the data file paths (swap here for a real database)
├── middleware/        auth.js (JWT), errorHandler.js
├── routes/            auth, subjects, papers, quiz, scores, chat
├── controllers/       the logic behind each route
├── models/            data shape reference classes
├── services/          QuizGrader.js (grading), ChatHub.js (live chat updates)
├── data/              JSON files used as the database
└── test/              chat.test.js  (run with: npm test)
```

## Run it

```bash
npm install
cp .env.example .env     # set JWT_SECRET to a long random string
npm start                # http://localhost:3000
```
`npm run dev` restarts automatically while you edit. Check it works: `curl http://localhost:3000/api/health`

The frontend lives in `../frontend`; backend and frontend folders must sit side by side.
You can also open the frontend from another dev server (Live Server on :5500); `js/api.js` then calls the API on `http://localhost:3000`.

## Endpoints

| Method | Route | Access | Purpose |
|--------|-------|--------|---------|
| GET | `/api/health` | public | Server check |
| GET | `/api/subjects`, `/api/subjects/:id` | public | The 9 subjects |
| GET | `/api/papers/:subjectId` | public | Years and papers available for a subject |
| GET | `/api/papers/:subjectId/:year/:paper` | public | Questions of one paper |
| GET | `/api/quiz/:subjectId` | public | Quiz questions (answers hidden) |
| POST | `/api/quiz/submit` | guest or login | `{ subjectId, answers: [0,2,null,...] }` -> graded on the server; saved under the logged-in user, or `guest` |
| POST | `/api/auth/register`, `/api/auth/login` | public | Create account, get a JWT (7 days) |
| GET | `/api/auth/me` | login | Current user |
| GET | `/api/scores/:userId` | login (own only) | Your quiz history |
| POST | `/api/scores` | login | Save a score directly |
| GET | `/api/chat/rooms` | public | General + one room per subject |
| GET | `/api/chat/:room/messages` | public | Recent messages (`?limit=50&before=<ISO date>`) |
| GET | `/api/chat/:room/stream` | public | Live updates (Server-Sent Events: `chat`, `delete`, `presence`) |
| POST | `/api/chat/:room/messages` | login | `{ text }`, max 500 characters, 5 messages per 10 s |
| DELETE | `/api/chat/:room/messages/:id` | login (owner) | Delete your own message |

## Good to know

- **Grading is server-side.** `quiz.json` holds the answer key; `GET /api/quiz/:subjectId` strips it, so nobody can read answers from the network.
- **Data shapes:** `papers.json` is `{ subjectId: { year: { paperNumber: [ [title, prompt, explanation], ... ] } } }`; `quiz.json` questions are `{ id, question, options (4), correctAnswerIndex }`. Add content by extending the JSON; no code changes needed.
- **Storage** is JSON files under `data/` (users, scores and chat messages are written there; each chat room keeps its latest 500 messages). Move to SQLite/MongoDB/Postgres by starting in `config/db.js`.
- **Chat live updates** and the chat rate limiter live in one Node process. Running several instances would need something shared (e.g. Redis).
- The questions are sample content. Replace them with GCE material you are allowed to use.
- Not built yet: chat moderation (report, admin delete, word filter).

## Tests

```bash
npm test     # community chat checks, no server needed
```
