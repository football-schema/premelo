#!/bin/sh
# premelo's twice-daily update, run by cron on the maintainer's machine (08:00 and 23:40): this season's results from
# football-data (one request a second), UEFA's European cups and matchday's newest results, the ratings and predictions
# rebuilt, and data/ committed and pushed if anything moved. The site is the gh-pages branch as it is: nothing runs on
# GitHub's side.
#   crontab: 0 8 * * * /home/melvin/remote/github.com/football-schema/premelo/scripts/update.sh >> .../logs/update.log 2>&1
set -e
cd "$(dirname "$0")/.."
export PATH="/home/melvin/.nvm/versions/node/v24.16.0/bin:/usr/bin:/bin"
# git pushes through gh, whose token is in the desktop keyring: cron needs the session bus to reach it
export XDG_RUNTIME_DIR="/run/user/$(id -u)" DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$(id -u)/bus"
echo "== $(date -u +%FT%TZ)"
node scripts/fetch.mjs --current
node scripts/fetch-uefa.mjs --current
node scripts/import.mjs
node scripts/backtest.mjs | tail -3
node scripts/build.mjs | tail -3
git add data card.svg card.png
if git diff --cached --quiet; then echo "nothing new"; exit 0; fi
git commit -q -m "Ratings through $(date -u +%F)"
git push -q && echo "pushed $(git log --oneline -1)"
