# GCE Learn - Frontend

HTML, CSS and vanilla JavaScript. All data comes from the backend API
(`../backend`); there is no hardcoded question data any more.

## Main flow
Home -> Subjects -> Year/Paper -> Learning -> Quiz -> Score (graded on the server)

Also: `pages/login.html` (register, log in, and see your score history).

## How to run
Start the backend (see the top-level README), then open http://localhost:3000.

`js/api.js` is the single place that knows the API address. It uses relative
URLs when served by the backend, and `http://localhost:3000` when the pages
are opened from `file://` or another dev server.

## Important
The questions are sample content. Replace them with GCE materials you are
legally permitted to use (edit the JSON files in `backend/member1-content/data`
and `backend/member2-quiz-scoring/data`).
