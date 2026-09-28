# Member 2 — Quiz Engine & Scoring Module

Owns quiz questions, server-side grading, and score persistence.

## Endpoints

| Method | Route               | Purpose                                                        |
|--------|----------------------|------------------------------------------------------------------|
| GET    | `/api/quiz/:subjectId` | Get quiz questions for a subject (answers hidden)              |
| POST   | `/api/quiz/submit`     | Body: `{ subjectId, answers: [0,2,null,...] }` (null = unanswered) → returns score; saved under the logged-in user or `guest` |
| POST   | `/api/scores`          | Save a score directly (login required)                                         |
| GET    | `/api/scores/:userId`  | Get your own past quiz history (login required)                                |

## Why grading moved server-side

The original `quiz.html` graded the quiz in the browser using JavaScript.
That meant anyone could open dev tools and edit the script to always score
100%. Now the frontend only sends the user's chosen answer indices; the
server holds the answer key and grades on `POST /api/quiz/submit`.

## Files

- `models/QuizQuestion.js`, `models/Score.js` — data shape reference classes
- `services/QuizGrader.js` — pure grading logic, no HTTP or storage (easy to unit test)
- `controllers/quizController.js` — handles quiz fetch + submission
- `controllers/scoresController.js` — reads/writes `data/scores.json`
- `routes/quiz.js`, `routes/scores.js` — Express routers, mounted by Member 3's `server.js`
- `data/quiz.json` — the quiz question bank (includes correct answers — never sent as-is to the client)
- `data/scores.json` — simple file-based storage for saved scores (swap for a real DB later)

## Your main job

`data/quiz.json` now has 10 sample questions for every subject. Replace them
with real content (keep the `{ id, question, options, correctAnswerIndex }`
shape, exactly 4 options, and a valid index).

## Testing your routes alone

```bash
cd member2-quiz-scoring
node -e "const app=require('express')(); app.use(require('express').json()); app.use('/api/quiz', require('./routes/quiz')); app.use('/api/scores', require('./routes/scores')); app.listen(4002, () => console.log('Member 2 routes on :4002'))"
```
Then test with curl:
```bash
curl http://localhost:4002/api/quiz/mathematics
curl -X POST http://localhost:4002/api/quiz/submit \
  -H "Content-Type: application/json" \
  -d '{"subjectId":"mathematics","answers":[1,2,1,2,1,1,2,2,1,1]}'
```
