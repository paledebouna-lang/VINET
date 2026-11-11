#!/usr/bin/env bash
# Puts the latest version of MonAuto online. Run as root:  sudo bash /opt/monauto/app/deploy/update.sh
set -euo pipefail
APP=/opt/monauto
WEB="$APP/app/web"
as_app() { sudo -u monauto -H env PATH="$APP/node/bin:/usr/bin:/bin" bash -c "$1"; }
[ "$(id -u)" = 0 ] || { echo "Lancez ce script avec sudo."; exit 1; }

# A backup first: a migration that goes wrong can then be undone.
bash "$APP/app/deploy/daily.sh" --backup-only
branch=$(as_app "git -C '$APP/app' rev-parse --abbrev-ref HEAD")
as_app "git -C '$APP/app' fetch --quiet origin '$branch' && git -C '$APP/app' reset --quiet --hard 'origin/$branch'"
# shortcut: the site is built in place, so pages may fail for the minute of the build; build into a second folder if that matters.
as_app "cd '$WEB' && npm ci --no-audit --no-fund && npx prisma migrate deploy && npm run build"
systemctl restart monauto
echo "MonAuto est à jour : $(as_app "git -C '$APP/app' log -1 --format='%h %s'")"
