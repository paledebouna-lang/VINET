#!/usr/bin/env bash
# Every night (see /etc/cron.d/monauto): deletes data past its retention period, then backs up.
#   --backup-only  skips the deletion (used before an update).
set -euo pipefail
WEB=/opt/monauto/app/web
DEST=/var/backups/monauto
KEEP_DAYS=14
url=$(grep '^DATABASE_URL=' "$WEB/.env" | cut -d'"' -f2)
url="${url%%\?*}" # psql does not know Prisma's ?schema= option

if [ "${1:-}" != "--backup-only" ]; then
  # Retention, as decided in docs/FEUILLE_DE_ROUTE.md: GPS positions and VINET detections 90 days;
  # positions recorded during a rental, 30 days after it closed. Dates are stored in UTC.
  psql -q -v ON_ERROR_STOP=1 "$url" <<'SQL'
DELETE FROM position WHERE "recordedAt" < (now() AT TIME ZONE 'UTC') - interval '90 days';
DELETE FROM position p USING tracker t, listing l, booking b
 WHERE p."trackerId" = t.id AND l."vehicleId" = t."vehicleId" AND b."listingId" = l.id
   AND b."closedAt" < (now() AT TIME ZONE 'UTC') - interval '30 days'
   AND p."recordedAt" >= b."startDate" AND p."recordedAt" <= b."closedAt";
DELETE FROM detection WHERE "detectedAt" < (now() AT TIME ZONE 'UTC') - interval '90 days';
SQL
fi

stamp=$(date -u +%Y%m%d-%H%M)
mkdir -p "$DEST"
pg_dump -Fc "$url" > "$DEST/db-$stamp.dump"
tar -czf "$DEST/uploads-$stamp.tar.gz" -C /var/lib/monauto uploads
chmod 600 "$DEST"/*-"$stamp".*
find "$DEST" -name 'db-*.dump' -mtime +"$KEEP_DAYS" -delete
find "$DEST" -name 'uploads-*.tar.gz' -mtime +"$KEEP_DAYS" -delete
echo "$(date -u +%FT%TZ) sauvegarde $stamp faite"
