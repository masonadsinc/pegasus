#!/bin/bash
# VPS cron script: checks /api/sync/trigger, runs sync if should_sync=true
# Add to crontab: 0 * * * * /path/to/check-and-sync.sh >> /var/log/meta-sync.log 2>&1

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
API_URL="${PEGASUS_API_URL:-https://hub.ads.inc}"
CRON_SECRET="${CRON_SECRET:-}"

# Check if we should sync
RESPONSE=$(curl -s -H "Authorization: Bearer $CRON_SECRET" "$API_URL/api/sync/trigger")
SHOULD_SYNC=$(echo "$RESPONSE" | grep -o '"should_sync":true')

if [ -z "$SHOULD_SYNC" ]; then
  REASON=$(echo "$RESPONSE" | grep -o '"reason":"[^"]*"' | head -1)
  echo "[$(date)] Skip: $REASON"
  exit 0
fi

echo "[$(date)] Starting Meta data sync..."
cd "$APP_DIR"
node lib/meta/run-sync.js

if [ $? -eq 0 ]; then
  echo "[$(date)] Sync completed successfully"
else
  echo "[$(date)] Sync failed with exit code $?"
fi
