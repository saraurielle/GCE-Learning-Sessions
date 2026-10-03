@echo off
REM Starts the GCE Learning Session (backend + frontend) on http://localhost:3000
cd /d "%~dp0backend"
if not exist node_modules (
  echo Installing dependencies...
  call npm install
)
if not exist .env copy .env.example .env >nul
start "" http://localhost:3000
node server.js
