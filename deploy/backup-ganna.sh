#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Nightly MySQL dump, keeping 14 days.
#
# Install on the server:
#   cp deploy/backup-ganna.sh ~/backup-ganna.sh && chmod 700 ~/backup-ganna.sh
#   mkdir -p ~/backups
#   ( crontab -l 2>/dev/null | grep -v backup-ganna.sh ; \
#     echo '30 2 * * * /home/ubuntu/backup-ganna.sh >> /home/ubuntu/backups/backup.log 2>&1' ) | crontab -
#
# Restore from a dump:
#   zcat ~/backups/ganna-YYYY-MM-DD.sql.gz | mysql -u ganna -p ganna
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

cd "$HOME/GannaApp"

# Read the password from the app's .env so it is never written into crontab,
# into this script, or into the shell history.
DB_PASSWORD=$(grep '^DB_PASSWORD=' .env | cut -d= -f2-)

OUT="$HOME/backups/ganna-$(date +%F).sql.gz"

# --no-tablespaces: the 'ganna' user deliberately lacks the global PROCESS
# privilege, which mysqldump would otherwise require just to read tablespace
# metadata it does not need for a single-schema dump.
mysqldump -u ganna -p"$DB_PASSWORD" \
  --single-transaction \
  --no-tablespaces \
  ganna | gzip > "$OUT"

find "$HOME/backups" -name 'ganna-*.sql.gz' -mtime +14 -delete

echo "$(date -Is) backed up to $OUT ($(du -h "$OUT" | cut -f1))"
