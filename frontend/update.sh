#!/usr/bin/env bash
# Update the GCE frontend on a VPS behind nginx.
#
#   ./update.sh               git pull, then publish to WEB_ROOT (if set), then reload nginx
#   SKIP_PULL=1 ./update.sh   you already uploaded the new files yourself
#
# Two ways to serve the frontend:
#   A) The backend serves ../frontend itself (nginx just proxies to it): leave WEB_ROOT empty.
#      The files are used in place, nothing to copy, no restart needed.
#   B) nginx serves the files directly from a folder, e.g. /var/www/gce:
#      export WEB_ROOT=/var/www/gce  (or put it in frontend/.deploy.env)
#      The files are copied there and script/style links get a ?v=<version> suffix,
#      so browsers never keep an old copy.
#
# Optional settings (export or put in frontend/.deploy.env):
#   WEB_ROOT=/var/www/gce      target folder for mode B
#   NGINX_RELOAD=1             run `nginx -t` then reload nginx afterwards (default 1)

set -Eeuo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
SRC="$(pwd)"

[ -f .deploy.env ] && . ./.deploy.env
WEB_ROOT="${WEB_ROOT:-}"
NGINX_RELOAD="${NGINX_RELOAD:-1}"

log()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!!\033[0m  %s\n' "$*" >&2; }
die()  { printf '\033[1;31mxx\033[0m  %s\n' "$*" >&2; exit 1; }
SUDO=""; [ "$(id -u)" -ne 0 ] && SUDO="sudo"

# ---- 1. get the new code ----------------------------------------------------
if [ "${SKIP_PULL:-0}" != 1 ] && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  log "git pull (was $(git rev-parse --short HEAD))"
  git pull --ff-only
  log "now at $(git rev-parse --short HEAD)"
else
  log "Skipping git pull"
fi

for f in index.html css/style.css js/api.js js/shell.js; do [ -f "$f" ] || die "$f is missing, is this the frontend folder?"; done
for f in js/*.js js/pages/*.js; do node --check "$f" 2>/dev/null || { command -v node >/dev/null && die "Syntax error in $f"; break; }; done

# ---- 2. publish -------------------------------------------------------------
if [ -n "$WEB_ROOT" ] && [ "$(readlink -f "$WEB_ROOT")" != "$SRC" ]; then
  VER="$( (git rev-parse --short HEAD 2>/dev/null) || date +%s )"
  log "Publishing to $WEB_ROOT (version $VER)"
  $SUDO mkdir -p "$WEB_ROOT"
  TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
  cp -a ./. "$TMP"/
  rm -rf "$TMP/.git" "$TMP/update.sh" "$TMP/.deploy.env" "$TMP/.gitignore" "$TMP/README.md"
  # cache-busting: css/js links in every html page get ?v=<version>
  find "$TMP" -name '*.html' -print0 | xargs -0 sed -i -E "s#(src|href)=\"([^\"?]*\.(js|css))(\?v=[^\"]*)?\"#\1=\"\2?v=$VER\"#g"
  $SUDO find "$WEB_ROOT" -mindepth 1 -delete
  $SUDO cp -a "$TMP"/. "$WEB_ROOT"/
  WEB_USER="$(stat -c '%U:%G' "$(dirname "$WEB_ROOT")" 2>/dev/null || echo)"
  [ "$(id -u)" -eq 0 ] && chown -R "${WEB_USER:-www-data:www-data}" "$WEB_ROOT" 2>/dev/null || true
else
  log "Serving in place from $SRC (no copy needed)"
fi

# ---- 3. nginx ---------------------------------------------------------------
if [ "$NGINX_RELOAD" = 1 ] && command -v nginx >/dev/null; then
  log "Checking nginx config"
  $SUDO nginx -t
  $SUDO systemctl reload nginx 2>/dev/null || $SUDO nginx -s reload
  log "nginx reloaded"
fi

log "Frontend updated."
