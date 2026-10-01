#!/usr/bin/env bash
# Update and restart the GCE backend on a VPS (pm2 or systemd).
#
#   ./update.sh               pull, install, restart, health check (rollback if it fails)
#   SKIP_PULL=1 ./update.sh   you already uploaded the new files yourself (scp/rsync/zip)
#   RUN_TESTS=1 ./update.sh   run `npm test` before restarting (aborts on failure)
#
# Optional settings: export them or put them in backend/.deploy.env
#   PROCESS_MANAGER=auto|pm2|systemd   (auto: pm2 if the process exists, else systemd)
#   PM2_NAME=gce-backend               pm2 process name
#   SERVICE_NAME=gce-backend           systemd unit name (without .service)
#   KEEP_BACKUPS=10                    how many data backups to keep

set -Eeuo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
APP_DIR="$(pwd)"

[ -f .deploy.env ] && . ./.deploy.env
PROCESS_MANAGER="${PROCESS_MANAGER:-auto}"
PM2_NAME="${PM2_NAME:-gce-backend}"
SERVICE_NAME="${SERVICE_NAME:-gce-backend}"
KEEP_BACKUPS="${KEEP_BACKUPS:-10}"

log()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!!\033[0m  %s\n' "$*" >&2; }
die()  { printf '\033[1;31mxx\033[0m  %s\n' "$*" >&2; exit 1; }

SUDO=""; [ "$(id -u)" -ne 0 ] && SUDO="sudo"

# values from .env (PORT, GCE_DATA_DIR) without executing the file
env_val() { [ -f .env ] && grep -E "^$1=" .env | tail -1 | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//' || true; }
PORT="${PORT:-$(env_val PORT)}"; PORT="${PORT:-3000}"
DATA_DIR="${GCE_DATA_DIR:-$(env_val GCE_DATA_DIR)}"; DATA_DIR="${DATA_DIR:-$APP_DIR/data}"

command -v node >/dev/null || die "node is not installed"
command -v npm  >/dev/null || die "npm is not installed"
[ -f .env ] || die ".env is missing. Run: cp .env.example .env and set JWT_SECRET"

# ---- which process manager runs the app? -----------------------------------
detect_pm() {
  case "$PROCESS_MANAGER" in
    pm2|systemd) echo "$PROCESS_MANAGER"; return ;;
  esac
  if command -v pm2 >/dev/null && pm2 describe "$PM2_NAME" >/dev/null 2>&1; then echo pm2; return; fi
  if command -v systemctl >/dev/null && systemctl cat "$SERVICE_NAME.service" >/dev/null 2>&1; then echo systemd; return; fi
  echo none
}
PM="$(detect_pm)"
[ "$PM" != none ] || die "No pm2 process '$PM2_NAME' and no systemd unit '$SERVICE_NAME.service' found.
   First start: pm2 start server.js --name $PM2_NAME && pm2 save
   or install a systemd unit, or set PM2_NAME / SERVICE_NAME to your real names."
log "Process manager: $PM"

restart_app() {
  if [ "$PM" = pm2 ]; then
    pm2 reload "$PM2_NAME" --update-env >/dev/null 2>&1 || pm2 restart "$PM2_NAME" --update-env
    pm2 save >/dev/null 2>&1 || true
  else
    $SUDO systemctl restart "$SERVICE_NAME"
  fi
}

health_check() {
  command -v curl >/dev/null || { warn "curl missing, skipping health check"; return 0; }
  for _ in $(seq 1 20); do
    if curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  return 1
}

# ---- 1. back up the data (users, scores, chat, notifications...) -----------
if [ -d "$DATA_DIR" ]; then
  mkdir -p backups
  BACKUP="backups/data-$(date +%Y%m%d-%H%M%S).tar.gz"
  tar -czf "$BACKUP" -C "$(dirname "$DATA_DIR")" "$(basename "$DATA_DIR")"
  log "Data backed up to $BACKUP"
  ls -1t backups/data-*.tar.gz 2>/dev/null | tail -n +"$((KEEP_BACKUPS + 1))" | xargs -r rm -f
fi

# ---- 2. get the new code ----------------------------------------------------
PREV=""; CLEAN=0
if [ "${SKIP_PULL:-0}" != 1 ] && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  PREV="$(git rev-parse HEAD)"
  [ -z "$(git status --porcelain --untracked-files=no)" ] && CLEAN=1
  [ "$CLEAN" = 1 ] || warn "Local changes to tracked files: pulling anyway, automatic code rollback disabled"
  log "git pull (was $(git rev-parse --short HEAD))"
  git pull --ff-only
  log "now at $(git rev-parse --short HEAD)"
else
  log "Skipping git pull"
fi

# ---- 3. dependencies --------------------------------------------------------
log "Installing production dependencies"
if [ -f package-lock.json ]; then npm ci --omit=dev --no-audit --no-fund; else npm install --omit=dev --no-audit --no-fund; fi

if [ "${RUN_TESTS:-0}" = 1 ]; then
  log "Running tests"
  npm test || die "Tests failed, not restarting. The running app is untouched."
fi

# ---- 4. restart + verify ----------------------------------------------------
log "Restarting"
restart_app
if health_check; then
  log "Healthy: http://127.0.0.1:$PORT/api/health"
  [ "$PM" = pm2 ] && pm2 status "$PM2_NAME" 2>/dev/null | tail -n +1 || true
  log "Update finished."
  exit 0
fi

warn "Health check failed."
if [ -n "$PREV" ] && [ "$CLEAN" = 1 ]; then
  warn "Rolling back to ${PREV:0:7}"
  git reset --hard "$PREV"
  if [ -f package-lock.json ]; then npm ci --omit=dev --no-audit --no-fund; else npm install --omit=dev --no-audit --no-fund; fi
  restart_app
  health_check && warn "Rolled back and healthy again. Check the logs for the cause." || warn "Still unhealthy after rollback."
fi
[ "$PM" = pm2 ] && echo "Logs: pm2 logs $PM2_NAME --lines 50" || echo "Logs: journalctl -u $SERVICE_NAME -n 50 --no-pager"
exit 1
