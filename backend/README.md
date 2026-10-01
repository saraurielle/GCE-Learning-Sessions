# GCE Learning Session: backend (v2)

Express API with JSON-file storage. It also serves the frontend, so one command runs the whole site.

## Run it

```bash
cd backend
npm install
cp .env.example .env        # then edit JWT_SECRET (and ADMIN_USERNAMES)
npm start                   # http://localhost:3000
npm test                    # 13 chat + 7 gamification + 21 end-to-end API tests
```

## Admins

Register your account normally, put the username in `ADMIN_USERNAMES` (comma separated) in `.env`, restart.
Admins can send announcements to everyone (Notifications page) and delete any chat message.

## What is new in v2

| Area | What it does |
| --- | --- |
| Notifications | In-app list plus live push (SSE). Types: welcome, badge, level, streak, mention, reply, announcement, reminder |
| Chat | Replies, reactions, edit/delete, @mentions, typing indicator, online counts, load earlier messages |
| XP, levels, badges, streaks | Earned on quizzes, daily challenge and studied papers. 10 badges |
| Daily challenge | 5 questions, the same for everyone each UTC day, one XP-earning attempt |
| Leaderboard | This week or all time |
| Saved questions | Bookmark past-paper questions; mark a paper as studied |
| Search | Past-paper questions and subjects |
| Profile | Avatar, bio, daily goal, notification preferences, change password |
| Security | Server-side grading, rate limits, security headers, atomic file writes, production JWT secret check |

### Rules

- XP: 10 per correct answer, +20 for a pass (50% or more), +30 for a perfect score, +25 daily-challenge bonus, +15 first time a paper is marked studied.
- Only the first 3 quiz attempts per subject per UTC day earn XP.
- Level `n` needs `50 * (n-1)^2` XP in total.
- Streaks count UTC days. A reminder is sent once a day after `REMINDER_HOUR_UTC` (default 16) to people whose streak is at risk.

## API overview

All routes are under `/api`. `Bearer <token>` is the JWT from `/auth/login`.

| Route | Auth | Notes |
| --- | --- | --- |
| `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `POST /auth/password` | | usernames: 3-20 chars of `A-Z a-z 0-9 _ . -` |
| `GET /subjects`, `GET /subjects/:id` | | includes `paperCount`, `questionCount` |
| `GET /papers/:subject`, `GET /papers/:subject/:year/:paper` | | |
| `GET /quiz/:subject`, `POST /quiz/submit` | optional | guests are graded but nothing is stored; response includes a review |
| `GET /daily`, `POST /daily/submit` | optional | |
| `GET /scores/:userId` | required | own scores only. **`POST /scores` was removed** (it allowed faked scores) |
| `GET /study`, `POST /study/bookmarks`, `DELETE /study/bookmarks/:id`, `POST /study/completed` | required | |
| `GET /stats/me`, `GET /leaderboard?period=week\|all` | required / optional | |
| `GET /profile`, `PATCH /profile` | required | |
| `GET /search?q=` | | |
| `GET /notifications`, `POST /notifications/:id/read`, `POST /notifications/read-all`, `DELETE /notifications[/:id]` | required | |
| `GET /notifications/stream?token=` | token in query | SSE: `ready`, `notification` |
| `POST /notifications/announce` | admin | `{ title, body?, link? }` |
| `GET /chat/rooms`, `GET /chat/:room/messages`, `GET /chat/:room/stream` | | public read; SSE: `chat edit delete reaction typing presence` |
| `POST /chat/:room/messages`, `PATCH/DELETE /chat/:room/messages/:id`, `POST .../reactions`, `POST /chat/:room/typing` | required | |

## Behaviour changes from v1

- Guest quiz scores are no longer stored (guests can still play).
- `POST /api/scores` is gone; scores are created only by the server when it grades a quiz.
- Usernames are limited to 3-20 letters, numbers and `_ . -`.

## Configuration

See `.env.example`: `PORT`, `JWT_SECRET`, `ADMIN_USERNAMES`, `NODE_ENV`, `CORS_ORIGIN`, `REMINDER_HOUR_UTC`, `GCE_DATA_DIR`, `API_RATE_LIMIT`.
In production (`NODE_ENV=production`) the server refuses to start without a real `JWT_SECRET`.

## Limitations

- Live connections (SSE) and rate limiters live in one Node process. To run several instances, move them to Redis or similar.
- Data is stored in JSON files (`data/*.json`). This is fine for a class or a small community; move to a database for large traffic.
- Streaks and daily challenges use UTC days.
