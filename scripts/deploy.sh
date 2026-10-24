#!/bin/sh
# Copy the site to https://melvin.me/public/premelo/ (JSS on melvin.me), a mirror of the gh-pages one: the page, its
# script and the one lib/ module it imports, style, card and data/. The rest of lib/, the scripts and cache/ stay on
# this machine. Run by update.sh, or by hand.
set -e
cd "$(dirname "$0")/.."
DEST=${DEPLOY_DEST:-ubuntu@melvin.me:/home/ubuntu/www/melvin.me/public/premelo/}
rsync -az --delete -e 'ssh -o BatchMode=yes -o ConnectTimeout=20' \
  --exclude '*.acl' \
  --include 'lib/' --include 'lib/goals.mjs' --exclude 'lib/*' \
  index.html app.js style.css card.png data lib "$DEST"
echo "deployed to $DEST"
