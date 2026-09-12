#!/usr/bin/env bash
# Host SunbaeHub from this machine: production build on :3100 behind a Cloudflare quick tunnel.
# Usage: scripts/host.sh            (re)starts the tunnel, reusing a running production server
#        scripts/host.sh --rebuild  rebuilds first (after code changes)
#        scripts/host.sh --stop     stops the tunnel and the production server
# The quick-tunnel URL is random and changes on every restart; the laptop must stay awake and online.
set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${PORT:-3100}"

if [[ "${1:-}" == "--stop" ]]; then pkill -f "cloudflared tunnel" 2>/dev/null || true; pkill -f "next start" 2>/dev/null || true; echo "stopped"; exit 0; fi
command -v cloudflared >/dev/null || { echo "cloudflared is missing: brew install cloudflared"; exit 1; }
if [[ "${1:-}" == "--rebuild" ]]; then pkill -f "next start" 2>/dev/null || true; npm run build; fi

if ! curl -s -o /dev/null -m 3 "http://localhost:$PORT/"; then
  [ -d .next ] || npm run build
  (nohup npx next start -p "$PORT" > /tmp/sunbaehub-prod.log 2>&1 &)
  for _ in $(seq 1 20); do curl -s -o /dev/null -m 3 "http://localhost:$PORT/" && break; sleep 1; done
fi

pkill -f "cloudflared tunnel" 2>/dev/null || true; sleep 1
(nohup cloudflared tunnel --url "http://localhost:$PORT" --no-autoupdate > /tmp/sunbaehub-tunnel.log 2>&1 &)
URL=""; for _ in $(seq 1 40); do URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/sunbaehub-tunnel.log | head -1); [ -n "$URL" ] && break; sleep 1; done
[ -n "$URL" ] || { echo "tunnel did not start; see /tmp/sunbaehub-tunnel.log"; exit 1; }
HOST="${URL#https://}"
# Wait for public DNS before any local lookup, so the local resolver never caches a miss.
for _ in $(seq 1 60); do dig +short +time=3 @8.8.8.8 "$HOST" A | grep -q . && break; sleep 2; done
sleep 5
for _ in $(seq 1 6); do [ "$(curl -s -o /dev/null -m 15 -w '%{http_code}' "$URL/")" = "200" ] && break; sleep 5; done
echo "$URL" > /tmp/sunbaehub-public-url
echo "SunbaeHub is live at: $URL"
command -v open >/dev/null && open "$URL" || true
