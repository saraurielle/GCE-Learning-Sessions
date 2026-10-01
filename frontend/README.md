# GCE Learning Session: frontend (v2)

Plain HTML, CSS and JavaScript. No build step.

## Run it

Start the backend (`npm start` in `backend/`) and open http://localhost:3000. The backend serves this folder.

To host the frontend elsewhere, set `window.GCE_API_BASE = "https://your-api.example"` in a small script before `js/api.js`, and set `CORS_ORIGIN` on the backend.
When opened from `file://` or a dev server on another port (for example Live Server on 5500), it calls the backend on `http://localhost:3000`.

## Structure

```
index.html              guest welcome page / logged-in "Today" dashboard
pages/                  subjects, papers, learning, quiz, daily, chat, progress,
                        leaderboard, saved, notifications, login, profile
css/style.css           the whole design system (colours are variables at the top; dark theme included)
js/api.js               API helper, login state, small utilities, icons
js/shell.js             top bar, side menu, search, notification bell, toasts
js/quiz-ui.js           quiz experience shared by quiz and daily challenge
js/pages/*.js           one script per page
```

Each page sets `<body data-nav="...">` to highlight its menu item and contains only its own `<main class="container">`; `shell.js` builds the rest.

## Design

The look is an exam hall: ruled exercise-book paper with a red margin line, blue pen for what you do, a teacher's red pen for marks, highlighter yellow for rewards. Quiz results appear as a marked script. Fonts: Bricolage Grotesque, Figtree and Caveat (Google Fonts, with system fallbacks). Light and dark themes follow the system and can be toggled.

## Features

Search (press `/`), live notifications, daily challenge, quizzes with timer and keyboard shortcuts (1-4 or A-D, arrow keys), XP, levels, streaks and badges, leaderboard, saved questions, community chat with replies, reactions, mentions and typing indicator, profile settings, responsive layout, keyboard-friendly and reduced-motion aware.
